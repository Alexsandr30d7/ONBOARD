# app/crud.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
from typing import List, Optional
from datetime import date

from app import models, schemas
from app.core.security import get_password_hash


# === Users ===
async def get_user_by_email(db: AsyncSession, email: str) -> Optional[models.User]:
    result = await db.execute(select(models.User).where(models.User.email == email))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.UserCreate) -> models.User:
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        password_hash=hashed_password,
        role=user.role,
        is_active=True
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[models.User]:
    result = await db.execute(select(models.User).where(models.User.user_id == user_id))
    return result.scalars().first()


async def update_user(
    db: AsyncSession,
    user: models.User,
    payload: schemas.UserUpdate,
) -> models.User:
    user.email = payload.email
    user.role = payload.role
    user.is_active = payload.is_active
    if payload.password:
        user.password_hash = get_password_hash(payload.password)
    await db.commit()
    await db.refresh(user)
    return user

async def toggle_user_active_status(
    db: AsyncSession, 
    user_id: int, 
    is_active: bool,
    current_user_id: int
) -> models.User:
    result = await db.execute(select(models.User).where(models.User.user_id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise ValueError("Пользователь не найден")
    
    if user.user_id == current_user_id:
        raise ValueError("Нельзя изменить статус самого себя")
    
    if user.role == "admin" and user.user_id != current_user_id:
        raise ValueError("Нельзя изменить статус других админов")
    
    user.is_active = is_active
    await db.commit()
    await db.refresh(user)
    return user


# === Employees ===
async def create_employee(db: AsyncSession, emp: schemas.EmployeeCreate) -> models.Employee:
    db_emp = models.Employee(**emp.model_dump())
    db.add(db_emp)
    await db.commit()
    await db.refresh(db_emp)
    return db_emp

async def get_employee_by_id(db: AsyncSession, employee_id: int) -> Optional[models.Employee]:
    result = await db.execute(select(models.Employee).where(models.Employee.employee_id == employee_id))
    return result.scalars().first()

async def get_employee_by_user_id(db: AsyncSession, user_id: int) -> Optional[models.Employee]:
    result = await db.execute(select(models.Employee).where(models.Employee.user_id == user_id))
    return result.scalars().first()

# === Onboarding Tracks ===
async def create_track(
    db: AsyncSession,
    track: schemas.OnboardingTrackCreate,
    created_by: int
) -> models.OnboardingTrack:
    db_track = models.OnboardingTrack(
        **track.model_dump(),
        created_by=created_by
    )
    db.add(db_track)
    await db.commit()
    await db.refresh(db_track)
    return db_track

async def get_track_by_id(db: AsyncSession, track_id: int) -> Optional[models.OnboardingTrack]:
    result = await db.execute(select(models.OnboardingTrack).where(models.OnboardingTrack.track_id == track_id))
    return result.scalars().first()

async def get_all_tracks(db: AsyncSession) -> List[models.OnboardingTrack]:
    result = await db.execute(select(models.OnboardingTrack).order_by(models.OnboardingTrack.track_id))
    return result.scalars().all()

async def get_active_tracks(db: AsyncSession) -> List[models.OnboardingTrack]:
    result = await db.execute(
        select(models.OnboardingTrack).where(models.OnboardingTrack.is_active == True)
    )
    return result.scalars().all()


# === Tasks ===
async def create_task(
    db: AsyncSession,
    task: schemas.TaskCreate,
    track_id: int
) -> models.Task:
    db_task = models.Task(
        **task.model_dump(),
        track_id=track_id
    )
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    return db_task

async def get_tasks_by_track(db: AsyncSession, track_id: int) -> List[models.Task]:
    result = await db.execute(
        select(models.Task)
        .where(models.Task.track_id == track_id)
        .order_by(models.Task.task_order)
    )
    return result.scalars().all()

async def get_task_by_id(db: AsyncSession, task_id: int) -> Optional[models.Task]:
    result = await db.execute(select(models.Task).where(models.Task.task_id == task_id))
    return result.scalars().first()


# === Employee Onboarding ===
async def create_employee_onboarding(
    db: AsyncSession,
    onboarding: schemas.EmployeeOnboardingCreate
) -> models.EmployeeOnboarding:
    db_onb = models.EmployeeOnboarding(**onboarding.model_dump())
    db.add(db_onb)
    await db.commit()
    await db.refresh(db_onb)
    return db_onb

async def get_onboarding_by_id(db: AsyncSession, onboarding_id: int) -> Optional[models.EmployeeOnboarding]:
    result = await db.execute(
        select(models.EmployeeOnboarding).where(models.EmployeeOnboarding.onboarding_id == onboarding_id)
    )
    return result.scalars().first()

async def get_all_onboardings(db: AsyncSession) -> List[models.EmployeeOnboarding]:
    result = await db.execute(
        select(models.EmployeeOnboarding).order_by(models.EmployeeOnboarding.start_date.desc())
    )
    return result.scalars().all()

async def get_active_onboardings_by_employee(db: AsyncSession, employee_id: int) -> Optional[models.EmployeeOnboarding]:
    result = await db.execute(
        select(models.EmployeeOnboarding)
        .where(
            and_(
                models.EmployeeOnboarding.employee_id == employee_id,
                models.EmployeeOnboarding.status == "in_progress"
            )
        )
    )
    return result.scalars().first()


# === Task Completions ===
async def create_task_completion(
    db: AsyncSession,
    completion: schemas.TaskCompletionCreate
) -> models.TaskCompletion:
    db_comp = models.TaskCompletion(**completion.model_dump())
    db.add(db_comp)
    await db.commit()
    await db.refresh(db_comp)
    return db_comp

async def get_completion_by_onboarding_and_task(
    db: AsyncSession,
    onboarding_id: int,
    task_id: int
) -> Optional[models.TaskCompletion]:
    result = await db.execute(
        select(models.TaskCompletion)
        .where(
            models.TaskCompletion.onboarding_id == onboarding_id,
            models.TaskCompletion.task_id == task_id
        )
    )
    return result.scalars().first()

async def update_task_completion_status(
    db: AsyncSession,
    completion_id: int,
    status: str,
    completed_date: Optional[date] = None
) -> Optional[models.TaskCompletion]:
    completion = await get_completion_by_id(db, completion_id)
    if not completion:
        return None
    completion.status = status
    if status == "completed" and completed_date:
        completion.completed_date = completed_date
    await db.commit()
    await db.refresh(completion)
    return completion

async def get_completion_by_id(db: AsyncSession, completion_id: int) -> Optional[models.TaskCompletion]:
    result = await db.execute(
        select(models.TaskCompletion).where(models.TaskCompletion.completion_id == completion_id)
    )
    return result.scalars().first()


# === Feedback ===
async def create_feedback(
    db: AsyncSession,
    employee_id: int,
    survey_type: str,
    responses: dict
) -> models.Feedback:
    db_fb = models.Feedback(
        employee_id=employee_id,
        survey_type=survey_type,
        responses=str(responses)  # или json.dumps(responses), если используешь JSONB
    )
    db.add(db_fb)
    await db.commit()
    await db.refresh(db_fb)
    return db_fb


# === Knowledge Base ===
async def list_knowledge_base_items(
    db: AsyncSession, query: Optional[str] = None
) -> List[models.KnowledgeBaseItem]:
    stmt = select(models.KnowledgeBaseItem)
    if query:
        stmt = stmt.where(models.KnowledgeBaseItem.title.ilike(f"%{query}%"))
    stmt = stmt.order_by(models.KnowledgeBaseItem.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_knowledge_base_item_by_id(
    db: AsyncSession, item_id: int
) -> Optional[models.KnowledgeBaseItem]:
    result = await db.execute(
        select(models.KnowledgeBaseItem).where(models.KnowledgeBaseItem.item_id == item_id)
    )
    return result.scalars().first()


async def create_knowledge_base_item(
    db: AsyncSession,
    title: str,
    content: Optional[str],
    created_by: int,
    file_name: Optional[str] = None,
    file_path: Optional[str] = None,
    file_mime_type: Optional[str] = None,
) -> models.KnowledgeBaseItem:
    db_item = models.KnowledgeBaseItem(
        title=title,
        content=content,
        created_by=created_by,
        file_name=file_name,
        file_path=file_path,
        file_mime_type=file_mime_type,
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item


# === Mentor assignments & Chat ===
async def list_mentor_users(db: AsyncSession) -> List[models.User]:
    result = await db.execute(select(models.User).where(models.User.role == "mentor"))
    return result.scalars().all()


async def upsert_mentor_assignment(db: AsyncSession, employee_id: int, mentor_user_id: int) -> models.MentorAssignment:
    result = await db.execute(select(models.MentorAssignment).where(models.MentorAssignment.employee_id == employee_id))
    existing = result.scalars().first()
    if existing:
        existing.mentor_user_id = mentor_user_id
        await db.commit()
        await db.refresh(existing)
        return existing
    assignment = models.MentorAssignment(employee_id=employee_id, mentor_user_id=mentor_user_id)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


async def get_mentor_assignment_by_employee_id(
    db: AsyncSession, employee_id: int
) -> Optional[models.MentorAssignment]:
    result = await db.execute(select(models.MentorAssignment).where(models.MentorAssignment.employee_id == employee_id))
    return result.scalars().first()


async def list_assigned_employees_for_mentor(
    db: AsyncSession, mentor_user_id: int
) -> List[models.Employee]:
    result = await db.execute(select(models.MentorAssignment).where(models.MentorAssignment.mentor_user_id == mentor_user_id))
    assigns = result.scalars().all()
    if not assigns:
        return []
    employee_ids = [a.employee_id for a in assigns]
    emp_result = await db.execute(select(models.Employee).where(models.Employee.employee_id.in_(employee_ids)))
    return emp_result.scalars().all()


async def list_chat_messages(
    db: AsyncSession,
    employee_id: int,
    mentor_user_id: int,
    after_id: Optional[int] = None,
    limit: int = 200,
) -> List[models.ChatMessage]:
    stmt = select(models.ChatMessage).where(
        models.ChatMessage.employee_id == employee_id,
        models.ChatMessage.mentor_user_id == mentor_user_id,
    )
    if after_id:
        stmt = stmt.where(models.ChatMessage.message_id > after_id)
    stmt = stmt.order_by(models.ChatMessage.message_id.asc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def create_chat_message(
    db: AsyncSession,
    employee_id: int,
    mentor_user_id: int,
    sender_user_id: int,
    text: str,
) -> models.ChatMessage:
    msg = models.ChatMessage(
        employee_id=employee_id,
        mentor_user_id=mentor_user_id,
        sender_user_id=sender_user_id,
        text=text,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def update_knowledge_base_item(
    db: AsyncSession,
    item: models.KnowledgeBaseItem,
    title: str,
    content: Optional[str],
    file_name: Optional[str],
    file_path: Optional[str],
    file_mime_type: Optional[str],
) -> models.KnowledgeBaseItem:
    item.title = title
    item.content = content
    item.file_name = file_name
    item.file_path = file_path
    item.file_mime_type = file_mime_type
    await db.commit()
    await db.refresh(item)
    return item


async def delete_knowledge_base_item(db: AsyncSession, item: models.KnowledgeBaseItem) -> None:
    await db.delete(item)
    await db.commit()