"""add chat messages and mentor assignments

Revision ID: 7d2a9d4b1f62
Revises: 2c4f5b7f9a01
Create Date: 2026-05-13 11:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d2a9d4b1f62"
down_revision: Union[str, Sequence[str], None] = "2c4f5b7f9a01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mentor_assignments",
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("mentor_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.employee_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mentor_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("assignment_id"),
        sa.UniqueConstraint("employee_id", name="uq_mentor_assignment_employee"),
    )
    op.create_index("ix_mentor_assignments_assignment_id", "mentor_assignments", ["assignment_id"], unique=False)
    op.create_index("ix_mentor_assignments_employee_id", "mentor_assignments", ["employee_id"], unique=False)
    op.create_index("ix_mentor_assignments_mentor_user_id", "mentor_assignments", ["mentor_user_id"], unique=False)
    op.create_index("idx_mentor_assignment_mentor", "mentor_assignments", ["mentor_user_id"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("mentor_user_id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.employee_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mentor_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("message_id"),
    )
    op.create_index("ix_chat_messages_message_id", "chat_messages", ["message_id"], unique=False)
    op.create_index("ix_chat_messages_employee_id", "chat_messages", ["employee_id"], unique=False)
    op.create_index("ix_chat_messages_mentor_user_id", "chat_messages", ["mentor_user_id"], unique=False)
    op.create_index("ix_chat_messages_sender_user_id", "chat_messages", ["sender_user_id"], unique=False)
    op.create_index("idx_chat_employee_created", "chat_messages", ["employee_id", "created_at"], unique=False)
    op.create_index("idx_chat_mentor_created", "chat_messages", ["mentor_user_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_chat_mentor_created", table_name="chat_messages")
    op.drop_index("idx_chat_employee_created", table_name="chat_messages")
    op.drop_index("ix_chat_messages_sender_user_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_mentor_user_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_employee_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_message_id", table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index("idx_mentor_assignment_mentor", table_name="mentor_assignments")
    op.drop_index("ix_mentor_assignments_mentor_user_id", table_name="mentor_assignments")
    op.drop_index("ix_mentor_assignments_employee_id", table_name="mentor_assignments")
    op.drop_index("ix_mentor_assignments_assignment_id", table_name="mentor_assignments")
    op.drop_table("mentor_assignments")
