"""add finding lifecycle tracking

Revision ID: 8f6c9b7d2e11
Revises: 62a5783d3735
Create Date: 2026-09-16 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8f6c9b7d2e11"
down_revision: Union[str, Sequence[str], None] = "62a5783d3735"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "finding_lifecycles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("finding_key", sa.String(length=64), nullable=False),
        sa.Column("context", sa.String(length=500), nullable=False),
        sa.Column("scanner_type", sa.String(length=30), nullable=False),
        sa.Column("vulnerability_id", sa.String(length=200), nullable=False),
        sa.Column("package_name", sa.String(length=300), nullable=False),
        sa.Column("target", sa.String(length=500), nullable=False),
        sa.Column("lifecycle_status", sa.String(length=20), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.Column("fixed_at", sa.DateTime(), nullable=True),
        sa.Column("reopened_at", sa.DateTime(), nullable=True),
        sa.Column("occurrence_count", sa.Integer(), nullable=False),
        sa.Column("first_seen_scan_id", sa.String(length=36), nullable=False),
        sa.Column("last_seen_scan_id", sa.String(length=36), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("finding_key"),
    )
    op.create_index("ix_finding_lifecycles_finding_key", "finding_lifecycles", ["finding_key"], unique=True)
    op.create_index("ix_finding_lifecycles_context", "finding_lifecycles", ["context"], unique=False)
    op.create_index("ix_finding_lifecycles_scanner_type", "finding_lifecycles", ["scanner_type"], unique=False)
    op.create_index("ix_finding_lifecycles_lifecycle_status", "finding_lifecycles", ["lifecycle_status"], unique=False)

    op.add_column("findings", sa.Column("finding_key", sa.String(length=64), nullable=True))
    op.add_column("findings", sa.Column("scanner_type", sa.String(length=30), nullable=True))
    op.add_column("findings", sa.Column("lifecycle_status", sa.String(length=20), nullable=True))
    op.add_column("findings", sa.Column("first_seen_at", sa.DateTime(), nullable=True))
    op.add_column("findings", sa.Column("last_seen_at", sa.DateTime(), nullable=True))
    op.add_column("findings", sa.Column("fixed_at", sa.DateTime(), nullable=True))
    op.add_column("findings", sa.Column("reopened_at", sa.DateTime(), nullable=True))
    op.add_column("findings", sa.Column("occurrence_count", sa.Integer(), nullable=True))
    op.execute("UPDATE findings SET scanner_type = 'unknown', lifecycle_status = 'new', occurrence_count = 1")
    op.alter_column("findings", "scanner_type", existing_type=sa.String(length=30), nullable=False)
    op.alter_column("findings", "lifecycle_status", existing_type=sa.String(length=20), nullable=False)
    op.alter_column("findings", "occurrence_count", existing_type=sa.Integer(), nullable=False)
    op.create_index("ix_findings_finding_key", "findings", ["finding_key"], unique=False)
    op.create_index("ix_findings_scanner_type", "findings", ["scanner_type"], unique=False)
    op.create_index("ix_findings_lifecycle_status", "findings", ["lifecycle_status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_findings_lifecycle_status", table_name="findings")
    op.drop_index("ix_findings_scanner_type", table_name="findings")
    op.drop_index("ix_findings_finding_key", table_name="findings")
    op.drop_column("findings", "occurrence_count")
    op.drop_column("findings", "reopened_at")
    op.drop_column("findings", "fixed_at")
    op.drop_column("findings", "last_seen_at")
    op.drop_column("findings", "first_seen_at")
    op.drop_column("findings", "lifecycle_status")
    op.drop_column("findings", "scanner_type")
    op.drop_column("findings", "finding_key")
    op.drop_index("ix_finding_lifecycles_lifecycle_status", table_name="finding_lifecycles")
    op.drop_index("ix_finding_lifecycles_scanner_type", table_name="finding_lifecycles")
    op.drop_index("ix_finding_lifecycles_context", table_name="finding_lifecycles")
    op.drop_index("ix_finding_lifecycles_finding_key", table_name="finding_lifecycles")
    op.drop_table("finding_lifecycles")
