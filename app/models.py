from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, CheckConstraint, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)

    employee = relationship("Employee", back_populates="user", uselist=False)
    created_tracks = relationship("OnboardingTrack", back_populates="creator")
    __table_args__ = (
        CheckConstraint("role IN ('new_employee', 'mentor', 'hr', 'admin')", name="chk_user_role"),
    )

class Employee(Base):
    __tablename__ = "employees"
    employee_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), unique=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    hire_date = Column(Date, nullable=False)
    position = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    mentor_id = Column(Integer, ForeignKey("employees.employee_id"))

    user = relationship("User", back_populates="employee")
    mentor = relationship("Employee", remote_side=[employee_id])
    onboardings = relationship("EmployeeOnboarding", back_populates="employee")
    feedbacks = relationship("Feedback", back_populates="employee")

class OnboardingTrack(Base):
    __tablename__ = "onboarding_tracks"
    track_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    target_position = Column(String(100), nullable=False)
    duration_days = Column(Integer, default=30)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.user_id"))

    creator = relationship("User", back_populates="created_tracks")
    tasks = relationship("Task", back_populates="track", cascade="all, delete-orphan")
    onboardings = relationship("EmployeeOnboarding", back_populates="track")

class Task(Base):
    __tablename__ = "tasks"
    task_id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("onboarding_tracks.track_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    task_type = Column(String(20), nullable=False)
    expected_duration_days = Column(Integer, default=3)
    task_order = Column(Integer, nullable=False)
    is_mandatory = Column(Boolean, default=True)

    track = relationship("OnboardingTrack", back_populates="tasks")
    completions = relationship("TaskCompletion", back_populates="task", cascade="all, delete-orphan")
    __table_args__ = (
        CheckConstraint("task_type IN ('document', 'meeting', 'training', 'system')", name="chk_task_type"),
        Index("idx_tasks_track_order", "track_id", "task_order"),
    )

class EmployeeOnboarding(Base):
    __tablename__ = "employee_onboardings"
    onboarding_id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.employee_id"), nullable=False)
    track_id = Column(Integer, ForeignKey("onboarding_tracks.track_id"), nullable=False)
    start_date = Column(Date, nullable=False)
    expected_end_date = Column(Date, nullable=False)
    actual_end_date = Column(Date)
    status = Column(String(20), default="in_progress")
    progress_percentage = Column(Integer, default=0)

    employee = relationship("Employee", back_populates="onboardings")
    track = relationship("OnboardingTrack", back_populates="onboardings")
    task_completions = relationship("TaskCompletion", back_populates="onboarding", cascade="all, delete-orphan")
    __table_args__ = (
        CheckConstraint("status IN ('in_progress', 'completed', 'terminated')", name="chk_onboarding_status"),
        CheckConstraint("progress_percentage BETWEEN 0 AND 100", name="chk_progress"),
        # Partial unique index not supported in SQLAlchemy core → implement in DB migration if needed
    )

class TaskCompletion(Base):
    __tablename__ = "task_completions"
    completion_id = Column(Integer, primary_key=True, index=True)
    onboarding_id = Column(Integer, ForeignKey("employee_onboardings.onboarding_id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.task_id"), nullable=False)
    status = Column(String(20), default="pending")
    due_date = Column(Date, nullable=False)
    completed_date = Column(Date)
    notes = Column(Text)
    attachment_url = Column(String(500))

    onboarding = relationship("EmployeeOnboarding", back_populates="task_completions")
    task = relationship("Task", back_populates="completions")
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'in_progress', 'completed', 'overdue')", name="chk_completion_status"),
    )

class Feedback(Base):
    __tablename__ = "feedback"
    feedback_id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.employee_id"), nullable=False)
    survey_type = Column(String(20), nullable=False)
    responses = Column(Text, nullable=False)  # or JSONB if using PostgreSQL JSON
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    anonymity_level = Column(String(20), default="partial")

    employee = relationship("Employee", back_populates="feedbacks")
    __table_args__ = (
        CheckConstraint("survey_type IN ('7_days', '30_days', '90_days')", name="chk_survey_type"),
        CheckConstraint("anonymity_level IN ('full', 'partial', 'none')", name="chk_anonymity"),
    )