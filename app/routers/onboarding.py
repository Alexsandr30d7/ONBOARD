from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date, timedelta

from app import schemas, crud, models
from app.database import get_db
from app.dependencies import get_current_user, require_role


router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


# === 1. Назначение адаптации (HR) ===
@router.post(
    "/start",
    response_model=schemas.EmployeeOnboarding,
    status_code=status.HTTP_201_CREATED,
    summary=""
)
async def start_employee_onboarding(
    onboarding: schemas.EmployeeOnboardingCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("hr"))  # Только HR может запускать
):
    # Проверка: у сотрудника ещё нет активной адаптации
    active_onb = await crud.get_active_onboardings_by_employee(db, onboarding.employee_id)
    if active_onb:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="У этого сотрудника уже есть активная адаптация"
        )

    # Проверка существования сотрудника и трека
    employee = await crud.get_employee_by_id(db, onboarding.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    track = await crud.get_track_by_id(db, onboarding.track_id)
    if not track or not track.is_active:
        raise HTTPException(status_code=404, detail="Активный трек адаптации не найден")

    # Автоматический расчёт expected_end_date, если не указан
    if not onboarding.expected_end_date:
        onboarding.expected_end_date = onboarding.start_date + timedelta(days=track.duration_days)

    return await crud.create_employee_onboarding(db, onboarding)


# === 2. Получить свою адаптацию (новый сотрудник) ===
@router.get(
    "/my",
    response_model=schemas.EmployeeOnboarding,
    summary=""
)
async def get_my_onboarding(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "new_employee":
        raise HTTPException(status_code=403, detail="Доступно только новым сотрудникам")

    # Найти сотрудника по user_id
    employee = await crud.get_employee_by_user_id(db, current_user.user_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    onboarding = await crud.get_active_onboardings_by_employee(db, employee.employee_id)
    if not onboarding:
        raise HTTPException(status_code=404, detail="Активная адаптация не найдена")

    return onboarding


# === 3. Получить все задачи в моей адаптации ===
@router.get(
    "/my/tasks",
    response_model=List[schemas.TaskCompletion],
    summary=""
)
async def get_my_onboarding_tasks(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "new_employee":
        raise HTTPException(status_code=403, detail="Доступно только новым сотрудникам")

    employee = await crud.get_employee_by_user_id(db, current_user.user_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    onboarding = await crud.get_active_onboardings_by_employee(db, employee.employee_id)
    if not onboarding:
        raise HTTPException(status_code=404, detail="Адаптация не найдена")

    # Получаем все задачи трека + статус выполнения
    tasks = await crud.get_tasks_by_track(db, onboarding.track_id)
    completions = []
    for task in tasks:
        comp = await crud.get_completion_by_onboarding_and_task(db, onboarding.onboarding_id, task.task_id)
        if comp:
            completions.append(comp)
        else:
            # Создаём "заглушку" для невыполненных задач
            completions.append(
                models.TaskCompletion(
                    onboarding_id=onboarding.onboarding_id,
                    task_id=task.task_id,
                    status="pending",
                    due_date=onboarding.start_date + timedelta(days=task.expected_duration_days)
                )
            )
    return completions


# === 4. Завершить задачу ===
@router.post(
    "/tasks/{task_id}/complete",
    response_model=schemas.TaskCompletion,
    summary=""
)
async def complete_task(
    task_id: int,
    notes: Optional[str] = None,
    attachment_url: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "new_employee":
        raise HTTPException(status_code=403, detail="Только новый сотрудник может завершать задачи")

    employee = await crud.get_employee_by_user_id(db, current_user.user_id)
    onboarding = await crud.get_active_onboardings_by_employee(db, employee.employee_id)

    if not onboarding:
        raise HTTPException(status_code=404, detail="Адаптация не найдена")

    # Проверка, что задача принадлежит треку
    task = await crud.get_task_by_id(db, task_id)
    if not task or task.track_id != onboarding.track_id:
        raise HTTPException(status_code=404, detail="Задача не найдена в вашем треке")

    # Проверка, не завершена ли уже
    existing = await crud.get_completion_by_onboarding_and_task(db, onboarding.onboarding_id, task_id)
    if existing and existing.status == "completed":
        raise HTTPException(status_code=400, detail="Задача уже завершена")

    completion_data = schemas.TaskCompletionCreate(
        onboarding_id=onboarding.onboarding_id,
        task_id=task_id,
        status="completed",
        due_date=existing.due_date if existing else date.today(),
        notes=notes,
        attachment_url=attachment_url
    )

    if existing:
        return await crud.update_task_completion_status(
            db, existing.completion_id, "completed", completed_date=date.today()
        )
    else:
        return await crud.create_task_completion(db, completion_data)


# === 5. Отправить обратную связь (анкету) ===
@router.post(
    "/feedback",
    status_code=status.HTTP_201_CREATED,
    summary=""
)
async def submit_feedback(
    survey_type: str = Query(..., regex="^(7_days|30_days|90_days)$"),
    responses: dict = ...,  # FastAPI автоматически парсит JSON тело
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "new_employee":
        raise HTTPException(status_code=403, detail="Обратная связь доступна только новым сотрудникам")

    employee = await crud.get_employee_by_user_id(db, current_user.user_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    # Проверка: не отправлял ли уже
    # (опционально — можно разрешить несколько)

    await crud.create_feedback(db, employee.employee_id, survey_type, responses)
    return {"message": "Спасибо за обратную связь!"}