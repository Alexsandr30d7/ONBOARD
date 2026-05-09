"""add knowledge base items

Revision ID: 2c4f5b7f9a01
Revises: 543f6360fa18
Create Date: 2026-05-09 17:25:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2c4f5b7f9a01"
down_revision: Union[str, Sequence[str], None] = "543f6360fa18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_base_items",
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=True),
        sa.Column("file_mime_type", sa.String(length=100), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("item_id"),
    )
    op.create_index("ix_knowledge_base_items_item_id", "knowledge_base_items", ["item_id"], unique=False)
    op.create_index("ix_knowledge_base_items_title", "knowledge_base_items", ["title"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_knowledge_base_items_title", table_name="knowledge_base_items")
    op.drop_index("ix_knowledge_base_items_item_id", table_name="knowledge_base_items")
    op.drop_table("knowledge_base_items")
