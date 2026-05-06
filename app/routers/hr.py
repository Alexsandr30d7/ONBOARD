# app/routers/hr.py
import ast
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app import crud, models, schemas
from app.database import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/hr", tags=["HR"])

@router.post("/employees", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def create_new_employee(
    employee: schemas.NewEmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("hr"))
):
    # Проверка уникальности email
    existing_user = await crud.get_user_by_email(db, email=employee.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    # 1. Создаём пользователя
    user_create = schemas.UserCreate(
        email=employee.email,
        password=employee.password,
        role="new_employee"
    )
    user = await crud.create_user(db, user_create)
    
    # 2. Создаём запись в employees
    emp_create = schemas.EmployeeCreate(
        user_id=user.user_id,
        first_name=employee.first_name,
        last_name=employee.last_name,
        hire_date=employee.hire_date,
        position=employee.position,
        department=employee.department
    )
    await crud.create_employee(db, emp_create)
    
    return user

@router.get("/employees", response_model=List[schemas.Employee])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("hr"))
):
    # Получаем всех сотрудников (можно добавить фильтрацию позже)
    result = await db.execute(select(models.Employee))
    return result.scalars().all()


@router.get("/tracks", response_model=List[schemas.OnboardingTrack])
async def list_active_tracks_for_hr(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("hr")),
):
    return await crud.get_active_tracks(db)


@router.post("/tracks", response_model=schemas.OnboardingTrack, status_code=status.HTTP_201_CREATED)
async def create_onboarding_track_for_hr(
    track: schemas.OnboardingTrackCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("hr")),
):
    return await crud.create_track(db, track, created_by=current_user.user_id)


@router.post("/tracks/{track_id}/tasks", response_model=schemas.Task, status_code=status.HTTP_201_CREATED)
async def add_task_to_track_for_hr(
    track_id: int,
    task: schemas.TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("hr")),
):
    track = await crud.get_track_by_id(db, track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Трек не найден")

    return await crud.create_task(db, task, track_id=track_id)


def _risk_level(score: int) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _has_negative_feedback(raw_responses: str) -> bool:
    lowered = raw_responses.lower()
    if any(word in lowered for word in ["bad", "poor", "awful", "плохо", "ужасно", "стресс", "тяжело"]):
        return True

    try:
        parsed = ast.literal_eval(raw_responses)
    except (ValueError, SyntaxError):
        return False

    if isinstance(parsed, dict):
        for value in parsed.values():
            if isinstance(value, (int, float)) and value <= 2:
                return True
            if isinstance(value, str):
                v = value.lower()
                if v in {"bad", "poor", "negative", "плохо"}:
                    return True
    return False


@router.get("/onboarding-risk", response_model=List[schemas.OnboardingRisk])
async def get_onboarding_risk_list(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("hr")),
):
    result = await db.execute(
        select(models.EmployeeOnboarding).where(models.EmployeeOnboarding.status == "in_progress")
    )
    active_onboardings = result.scalars().all()

    rows: list[schemas.OnboardingRisk] = []
    today = date.today()

    for onb in active_onboardings:
        employee = await crud.get_employee_by_id(db, onb.employee_id)
        track = await crud.get_track_by_id(db, onb.track_id)
        if not employee or not track:
            continue

        tasks = await crud.get_tasks_by_track(db, onb.track_id)
        total_tasks = len(tasks)
        task_ids = {task.task_id for task in tasks}

        completions_result = await db.execute(
            select(models.TaskCompletion).where(models.TaskCompletion.onboarding_id == onb.onboarding_id)
        )
        completions = completions_result.scalars().all()
        relevant_completions = [c for c in completions if c.task_id in task_ids]

        completed_count = sum(1 for c in relevant_completions if c.status == "completed")
        overdue_count = sum(
            1 for c in relevant_completions if c.status != "completed" and c.due_date < today
        )

        overdue_ratio = int(round((overdue_count / total_tasks) * 100)) if total_tasks else 0

        elapsed_days = max((today - onb.start_date).days, 0)
        expected_ratio = min(1.0, elapsed_days / max(track.duration_days, 1))
        actual_ratio = (completed_count / total_tasks) if total_tasks else 0.0
        pace_drop = int(round(max(0.0, expected_ratio - actual_ratio) * 100))

        completed_dates = [c.completed_date for c in relevant_completions if c.completed_date]
        if completed_dates:
            inactivity_days = max((today - max(completed_dates)).days, 0)
        else:
            inactivity_days = elapsed_days
        inactivity_norm = min(100, inactivity_days * 5)

        feedback_result = await db.execute(
            select(models.Feedback)
            .where(models.Feedback.employee_id == employee.employee_id)
            .order_by(models.Feedback.submitted_at.desc())
            .limit(1)
        )
        latest_feedback = feedback_result.scalars().first()
        negative_feedback = _has_negative_feedback(latest_feedback.responses) if latest_feedback else False
        negative_feedback_score = 100 if negative_feedback else 0

        score = int(
            round(
                0.35 * overdue_ratio
                + 0.25 * pace_drop
                + 0.20 * inactivity_norm
                + 0.20 * negative_feedback_score
            )
        )
        score = min(100, max(0, score))

        rows.append(
            schemas.OnboardingRisk(
                onboarding_id=onb.onboarding_id,
                employee_id=employee.employee_id,
                employee_name=f"{employee.first_name} {employee.last_name}",
                track_name=track.name,
                risk_score=score,
                risk_level=_risk_level(score),
                factors=schemas.OnboardingRiskFactors(
                    overdue_ratio=overdue_ratio,
                    pace_drop=pace_drop,
                    inactivity_days=inactivity_days,
                    negative_feedback=negative_feedback,
                ),
            )
        )

    rows.sort(key=lambda item: item.risk_score, reverse=True)
    return rows


@router.post(
    "/onboarding-risk/{onboarding_id}/action",
    response_model=schemas.OnboardingRiskActionResponse,
)
async def take_risk_action(
    onboarding_id: int,
    action_type: str = Query(..., pattern="^(plan_1on1|send_nudge)$"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role("hr")),
):
    onboarding = await crud.get_onboarding_by_id(db, onboarding_id)
    if not onboarding or onboarding.status != "in_progress":
        raise HTTPException(status_code=404, detail="Активная адаптация не найдена")

    employee = await crud.get_employee_by_id(db, onboarding.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    full_name = f"{employee.first_name} {employee.last_name}"
    if action_type == "plan_1on1":
        message = f"Запланируйте 1:1 с {full_name} в течение 48 часов."
    else:
        message = f"Отправьте {full_name} мягкое напоминание по текущим задачам."

    return schemas.OnboardingRiskActionResponse(
        onboarding_id=onboarding_id,
        action_type=action_type,
        message=message,
    )