# app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app import crud, schemas, models
from app.database import get_db
from app.dependencies import require_role
from app.services.ews import EWSWeights, OnboardingEWSService, get_current_ews_weights, set_current_ews_weights

router = APIRouter(prefix="/admin", tags=["Admin"])

# --- Профиль ---
@router.get("/me", response_model=schemas.User)
async def read_admin_profile(
    current_user = Depends(require_role("admin"))
):
    return current_user

# --- Пользователи ---
@router.post("/users/hr", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def create_hr_user(
    user_create: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    if user_create.role != "hr":
        raise HTTPException(
            status_code=400,
            detail="Этот эндпоинт создаёт только HR-пользователей"
        )
    # Проверка уникальности email
    existing = await crud.get_user_by_email(db, email=user_create.email)
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    return await crud.create_user(db, user_create)

@router.post("/users/mentor", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def create_mentor(
    user_create: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    if user_create.role != "mentor":
        raise HTTPException(
            status_code=400,
            detail="Этот эндпоинт создаёт только менторов"
        )
    # Проверка уникальности email
    existing = await crud.get_user_by_email(db, email=user_create.email)
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    return await crud.create_user(db, user_create)



@router.get("/users", response_model=List[schemas.User])
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    result = await db.execute(select(models.User))
    return result.scalars().all()


@router.put("/users/{user_id}", response_model=schemas.User)
async def edit_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    user = await crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    existing = await crud.get_user_by_email(db, payload.email)
    if existing and existing.user_id != user_id:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    if payload.role == "admin" and user.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Нельзя повышать другого пользователя до администратора")

    if user.user_id == current_user.user_id and not payload.is_active:
        raise HTTPException(status_code=400, detail="Нельзя деактивировать самого себя")

    if user.role == "admin" and user.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Нельзя изменять других администраторов")

    return await crud.update_user(db, user, payload)

# Деактивация пользователя
@router.put("/users/{user_id}/deactivate", response_model=schemas.User)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    # Нельзя деактивировать самого себя
    if current_user.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя деактивировать самого себя"
        )
    
    result = await db.execute(select(models.User).where(models.User.user_id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Нельзя деактивировать других админов
    if user.role == "admin" and user.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нельзя деактивировать других администраторов"
        )
    
    user.is_active = False
    await db.commit()
    await db.refresh(user)
    return user

# Активация пользователя
@router.put("/users/{user_id}/activate", response_model=schemas.User)
async def activate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    result = await db.execute(select(models.User).where(models.User.user_id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user.is_active = True
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/tracks", response_model=List[schemas.OnboardingTrack])
async def list_all_tracks(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    return await crud.get_all_tracks(db)

# --- Все адаптации ---
@router.get("/onboardings", response_model=List[schemas.EmployeeOnboarding])
async def list_all_onboardings(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    return await crud.get_all_onboardings(db)


@router.get("/ews/weights", response_model=schemas.EWSWeightsPayload)
async def get_ews_weights(
    current_user=Depends(require_role("admin")),
):
    _ = current_user
    w = get_current_ews_weights()
    return schemas.EWSWeightsPayload(
        overdue_ratio=w.overdue_ratio,
        pace_drop=w.pace_drop,
        inactivity=w.inactivity,
        negative_feedback=w.negative_feedback,
    )


@router.put("/ews/weights", response_model=schemas.EWSWeightsPayload)
async def update_ews_weights(
    payload: schemas.EWSWeightsPayload,
    current_user=Depends(require_role("admin")),
):
    _ = current_user
    total = payload.overdue_ratio + payload.pace_drop + payload.inactivity + payload.negative_feedback
    if abs(total - 1.0) > 0.001:
        raise HTTPException(status_code=400, detail="Сумма весов должна быть равна 1.0")

    updated = set_current_ews_weights(
        EWSWeights(
            overdue_ratio=payload.overdue_ratio,
            pace_drop=payload.pace_drop,
            inactivity=payload.inactivity,
            negative_feedback=payload.negative_feedback,
        )
    )
    return schemas.EWSWeightsPayload(
        overdue_ratio=updated.overdue_ratio,
        pace_drop=updated.pace_drop,
        inactivity=updated.inactivity,
        negative_feedback=updated.negative_feedback,
    )


@router.post("/ews/recalculate", response_model=schemas.EWSDistributionPreview)
async def recalculate_ews(
    payload: schemas.EWSWeightsPayload | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    _ = current_user
    weights = get_current_ews_weights()
    if payload:
        total = payload.overdue_ratio + payload.pace_drop + payload.inactivity + payload.negative_feedback
        if abs(total - 1.0) > 0.001:
            raise HTTPException(status_code=400, detail="Сумма весов должна быть равна 1.0")
        weights = EWSWeights(
            overdue_ratio=payload.overdue_ratio,
            pace_drop=payload.pace_drop,
            inactivity=payload.inactivity,
            negative_feedback=payload.negative_feedback,
        )

    service = OnboardingEWSService(db=db, score_calculator=None)
    return await service.preview_distribution(weights=weights)