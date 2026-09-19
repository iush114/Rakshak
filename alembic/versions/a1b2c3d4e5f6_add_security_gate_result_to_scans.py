"""add security gate result to scans

Revision ID: a1b2c3d4e5f6
Revises: 8f6c9b7d2e11
Create Date: 2026-09-16 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "8f6c9b7d2e11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("scans", sa.Column("security_gate_status", sa.String(length=20), nullable=True))
    op.add_column("scans", sa.Column("security_gate_reason", sa.Text(), nullable=True))
    op.create_index("ix_scans_security_gate_status", "scans", ["security_gate_status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_scans_security_gate_status", table_name="scans")
    op.drop_column("scans", "security_gate_reason")
    op.drop_column("scans", "security_gate_status")
