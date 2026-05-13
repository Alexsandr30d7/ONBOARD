from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.database import get_db
from app.dependencies import get_current_user


router = APIRouter(prefix="/knowledge-base", tags=["Knowledge Base"])
UPLOAD_ROOT = Path("uploads/knowledge_base")


def _to_schema(item) -> schemas.KnowledgeBaseItem:
    file_url = f"/api/v1/knowledge-base/{item.item_id}/file" if item.file_path else None
    return schemas.KnowledgeBaseItem(
        item_id=item.item_id,
        title=item.title,
        content=item.content,
        file_name=item.file_name,
        file_url=file_url,
        file_mime_type=item.file_mime_type,
        created_by=item.created_by,
        created_at=item.created_at,
    )


def _save_uploaded_file(file: UploadFile) -> tuple[str, str | None, str]:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "").suffix
    safe_name = f"{uuid4().hex}{ext}"
    target = UPLOAD_ROOT / safe_name
    data = file.file.read()
    target.write_bytes(data)
    return (file.filename or safe_name, file.content_type, str(target.resolve()))


def _unlink_file(path: str | None) -> None:
    if not path:
        return
    file_path = Path(path)
    try:
        if file_path.exists():
            file_path.unlink()
    except OSError:
        # Do not fail request if disk cleanup failed.
        pass


@router.get("", response_model=List[schemas.KnowledgeBaseItem])
async def list_knowledge_base(
    q: str = Query(default="", max_length=255),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _ = current_user
    items = await crud.list_knowledge_base_items(db, query=q.strip() or None)
    return [_to_schema(item) for item in items]


@router.get("/{item_id}", response_model=schemas.KnowledgeBaseItem)
async def get_knowledge_base_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _ = current_user
    item = await crud.get_knowledge_base_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Материал базы знаний не найден")
    return _to_schema(item)


@router.get("/{item_id}/file")
async def download_knowledge_base_file(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _ = current_user
    item = await crud.get_knowledge_base_item_by_id(db, item_id)
    if not item or not item.file_path:
        raise HTTPException(status_code=404, detail="Файл не найден")

    path = Path(item.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден на диске")

    return FileResponse(
        path=path,
        filename=item.file_name or path.name,
        media_type=item.file_mime_type or "application/octet-stream",
    )


@router.post("", response_model=schemas.KnowledgeBaseItem, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base_item(
    title: str = Form(...),
    content: str = Form(""),
    file: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in {"hr", "mentor"}:
        raise HTTPException(status_code=403, detail="Создавать базу знаний могут только HR и менторы")

    if not title.strip():
        raise HTTPException(status_code=400, detail="Название обязательно")

    if not content.strip() and file is None:
        raise HTTPException(status_code=400, detail="Добавьте текст или файл")

    file_name = None
    file_path = None
    file_mime_type = None

    if file is not None:
        file_name, file_mime_type, file_path = _save_uploaded_file(file)

    item = await crud.create_knowledge_base_item(
        db=db,
        title=title.strip(),
        content=content.strip() or None,
        created_by=current_user.user_id,
        file_name=file_name,
        file_path=file_path,
        file_mime_type=file_mime_type,
    )
    return _to_schema(item)


@router.put("/{item_id}", response_model=schemas.KnowledgeBaseItem)
async def update_knowledge_base_item(
    item_id: int,
    title: str = Form(...),
    content: str = Form(""),
    remove_file: bool = Form(False),
    file: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in {"hr", "mentor"}:
        raise HTTPException(status_code=403, detail="Редактировать базу знаний могут только HR и менторы")

    item = await crud.get_knowledge_base_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Материал базы знаний не найден")

    if not title.strip():
        raise HTTPException(status_code=400, detail="Название обязательно")

    current_file_name = item.file_name
    current_file_path = item.file_path
    current_file_mime_type = item.file_mime_type

    if remove_file:
        _unlink_file(current_file_path)
        current_file_name = None
        current_file_path = None
        current_file_mime_type = None

    if file is not None:
        _unlink_file(current_file_path)
        current_file_name, current_file_mime_type, current_file_path = _save_uploaded_file(file)

    if not content.strip() and not current_file_path:
        raise HTTPException(status_code=400, detail="Добавьте текст или файл")

    updated = await crud.update_knowledge_base_item(
        db=db,
        item=item,
        title=title.strip(),
        content=content.strip() or None,
        file_name=current_file_name,
        file_path=current_file_path,
        file_mime_type=current_file_mime_type,
    )
    return _to_schema(updated)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in {"hr", "mentor"}:
        raise HTTPException(status_code=403, detail="Удалять базу знаний могут только HR и менторы")

    item = await crud.get_knowledge_base_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Материал базы знаний не найден")

    _unlink_file(item.file_path)
    await crud.delete_knowledge_base_item(db, item)
