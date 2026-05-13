from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.database import get_db
from app.dependencies import get_current_user, require_any_role


router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get("/mentors", response_model=List[schemas.MentorContact])
async def list_mentors(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_any_role("hr", "admin")),
):
    _ = current_user
    mentors = await crud.list_mentor_users(db)
    return [schemas.MentorContact(mentor_user_id=m.user_id, mentor_email=m.email) for m in mentors]


@router.put("/assignments", status_code=status.HTTP_204_NO_CONTENT)
async def upsert_assignment(
    payload: schemas.MentorAssignmentUpsert,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_any_role("hr", "admin")),
):
    _ = current_user
    employee = await crud.get_employee_by_id(db, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    mentor = await crud.get_user_by_id(db, payload.mentor_user_id)
    if not mentor or mentor.role != "mentor":
        raise HTTPException(status_code=404, detail="Ментор не найден")
    await crud.upsert_mentor_assignment(db, payload.employee_id, payload.mentor_user_id)
    return None


@router.get("/contacts", response_model=List[schemas.EmployeeContact] | schemas.MentorContact)
async def my_contacts(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == "new_employee":
        employee = await crud.get_employee_by_user_id(db, current_user.user_id)
        if not employee:
            raise HTTPException(status_code=404, detail="Сотрудник не найден")
        assignment = await crud.get_mentor_assignment_by_employee_id(db, employee.employee_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Ментор не назначен")
        mentor = await crud.get_user_by_id(db, assignment.mentor_user_id)
        if not mentor:
            raise HTTPException(status_code=404, detail="Ментор не найден")
        return schemas.MentorContact(employee_id=employee.employee_id, mentor_user_id=mentor.user_id, mentor_email=mentor.email)

    if current_user.role == "mentor":
        employees = await crud.list_assigned_employees_for_mentor(db, current_user.user_id)
        contacts: list[schemas.EmployeeContact] = []
        for emp in employees:
            u = await crud.get_user_by_id(db, emp.user_id)
            if not u:
                continue
            contacts.append(
                schemas.EmployeeContact(
                    employee_id=emp.employee_id,
                    employee_name=f"{emp.first_name} {emp.last_name}",
                    user_id=u.user_id,
                    user_email=u.email,
                )
            )
        return contacts

    raise HTTPException(status_code=403, detail="Чат доступен только сотруднику и ментору")


@router.get("/messages", response_model=List[schemas.ChatMessage])
async def list_messages(
    employee_id: int = Query(..., ge=1),
    after_id: Optional[int] = Query(default=None, ge=1),
    limit: int = Query(default=200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    assignment = await crud.get_mentor_assignment_by_employee_id(db, employee_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Ментор не назначен")

    if current_user.role == "new_employee":
        employee = await crud.get_employee_by_user_id(db, current_user.user_id)
        if not employee or employee.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому чату")
    elif current_user.role == "mentor":
        if assignment.mentor_user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому чату")
    else:
        raise HTTPException(status_code=403, detail="Нет доступа к этому чату")

    msgs = await crud.list_chat_messages(db, employee_id=employee_id, mentor_user_id=assignment.mentor_user_id, after_id=after_id, limit=limit)
    return [schemas.ChatMessage(message_id=m.message_id, sender_user_id=m.sender_user_id, text=m.text, created_at=m.created_at) for m in msgs]


@router.post("/messages", response_model=schemas.ChatMessage, status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: schemas.ChatSendPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Текст сообщения пустой")

    assignment = await crud.get_mentor_assignment_by_employee_id(db, payload.employee_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Ментор не назначен")

    if current_user.role == "new_employee":
        employee = await crud.get_employee_by_user_id(db, current_user.user_id)
        if not employee or employee.employee_id != payload.employee_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому чату")
    elif current_user.role == "mentor":
        if assignment.mentor_user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому чату")
    else:
        raise HTTPException(status_code=403, detail="Нет доступа к этому чату")

    msg = await crud.create_chat_message(
        db=db,
        employee_id=payload.employee_id,
        mentor_user_id=assignment.mentor_user_id,
        sender_user_id=current_user.user_id,
        text=text,
    )
    return schemas.ChatMessage(message_id=msg.message_id, sender_user_id=msg.sender_user_id, text=msg.text, created_at=msg.created_at)

