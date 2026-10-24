"""add firebase_uid to users

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-23 23:50:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    return column in [col["name"] for col in insp.get_columns(table)]


def _has_index(bind, table: str, index: str) -> bool:
    insp = sa.inspect(bind)
    return index in [idx["name"] for idx in insp.get_indexes(table)]


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_column(bind, "users", "firebase_uid"):
        op.add_column("users", sa.Column("firebase_uid", sa.String(length=128), nullable=True))

    if not _has_index(bind, "users", "ix_users_firebase_uid"):
        op.create_index(
            op.f("ix_users_firebase_uid"),
            "users",
            ["firebase_uid"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_index(bind, "users", "ix_users_firebase_uid"):
        op.drop_index(op.f("ix_users_firebase_uid"), table_name="users")
    if _has_column(bind, "users", "firebase_uid"):
        op.drop_column("users", "firebase_uid")
