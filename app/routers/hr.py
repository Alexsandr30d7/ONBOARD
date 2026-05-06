# app/routers/hr.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
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