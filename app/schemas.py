from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import date, datetime

# --- Users ---
class UserBase(BaseModel):
    email: EmailStr
    role: str = Field(..., pattern="^(new_employee|mentor|hr|admin)$")

class UserCreate(UserBase):
    password: str

class User(UserBase):
    user_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Employees ---
class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    hire_date: date
    position: str
    department: str

# Схема для создания сотрудника через HR
class NewEmployeeCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    hire_date: date
    position: str
    department: str

class EmployeeCreate(EmployeeBase):
    user_id: int  # предполагается, что user уже создан
    mentor_id: Optional[int] = None

class Employee(EmployeeBase):
    employee_id: int
    mentor_id: Optional[int] = None

    class Config:
        from_attributes = True

# --- Onboarding Tracks ---
class OnboardingTrackBase(BaseModel):
    name: str
    description: Optional[str] = None
    target_position: str
    duration_days: int = 30
    is_active: bool = True

class OnboardingTrackCreate(OnboardingTrackBase):
    pass

class OnboardingTrack(OnboardingTrackBase):
    track_id: int
    created_by: int

    class Config:
        from_attributes = True

# --- Tasks ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: str = Field(..., pattern="^(document|meeting|training|system)$")
    expected_duration_days: int = 3
    task_order: int
    is_mandatory: bool = True

class TaskCreate(TaskBase):
    pass

class Task(TaskBase):
    task_id: int
    track_id: int

    class Config:
        from_attributes = True

# --- Onboarding & Completions ---
class EmployeeOnboardingBase(BaseModel):
    start_date: date
    expected_end_date: date

class EmployeeCreateForOnboarding(BaseModel):
    first_name: str
    last_name: str
    hire_date: date
    position: str
    department: str

class EmployeeOnboardingCreate(EmployeeOnboardingBase):
    employee_id: int
    track_id: int

class EmployeeOnboarding(EmployeeOnboardingBase):
    onboarding_id: int
    status: str
    progress_percentage: int
    actual_end_date: Optional[date] = None

    class Config:
        from_attributes = True

class TaskCompletionBase(BaseModel):
    status: str = "pending"
    due_date: date
    notes: Optional[str] = None
    attachment_url: Optional[str] = None

class TaskCompletionCreate(TaskCompletionBase):
    onboarding_id: int
    task_id: int

class TaskCompletion(TaskCompletionBase):
    completion_id: int
    task_id: int
    completed_date: Optional[date] = None

    class Config:
        from_attributes = True


class EmployeeOnboardingTask(BaseModel):
    """Задача трека с прогрессом — удобно для UI нового сотрудника."""

    task_id: int
    title: str
    description: Optional[str] = None
    task_type: str
    task_order: int
    expected_duration_days: int = 3
    completion_id: Optional[int] = None
    status: str
    due_date: date
    completed_date: Optional[date] = None
    notes: Optional[str] = None
    attachment_url: Optional[str] = None

# --- Auth ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None