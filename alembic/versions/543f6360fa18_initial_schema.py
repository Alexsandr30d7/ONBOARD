"""initial schema

Revision ID: 543f6360fa18
Revises:
Create Date: 2026-05-06 08:51:15.698072

Creates all application tables from SQLAlchemy models. Use this on an empty database.
If the database already matched an older ad-hoc schema, run `alembic stamp 543f6360fa18`
after aligning the schema, or migrate data to a fresh DB and `alembic upgrade head`.
"""
from typing import Sequence, Union

from alembic import op

from app.database import Base
import app.models  # noqa: F401 — register models on metadata

revision: str = "543f6360fa18"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
