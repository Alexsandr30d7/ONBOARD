from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, models, schemas
from app.database import get_db
from app.dependencies import require_any_role, require_role
from app.services.ews import OnboardingEWSService

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


@router.get("/onboarding-risk", response_model=List[schemas.OnboardingRisk])
async def get_onboarding_risk_list(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role("hr", "mentor")),
):
    ews_service = OnboardingEWSService(db)
    return await ews_service.list_risks()


@router.get("/onboarding-risk/{onboarding_id}", response_model=schemas.OnboardingRiskDetail)
async def get_onboarding_risk_detail(
    onboarding_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_any_role("hr", "mentor")),
):
    _ = current_user
    ews_service = OnboardingEWSService(db)
    detail = await ews_service.get_risk_detail(onboarding_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Активная адаптация не найдена")
    return detail


@router.post(
    "/onboarding-risk/{onboarding_id}/action",
    response_model=schemas.OnboardingRiskActionResponse,
)
async def take_risk_action(
    onboarding_id: int,
    action_type: str = Query(..., pattern="^(plan_1on1|send_nudge)$"),
    comment: str = Query(default="", max_length=1000),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role("hr", "mentor")),
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
        comment=comment.strip() or None,
    )