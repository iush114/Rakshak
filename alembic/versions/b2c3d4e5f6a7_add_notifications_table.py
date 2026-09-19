"""add notifications table

Revision ID: b2c3d4e5f6a7
Revises: f7a1b9c2d4e6
Create Date: 2026-09-19 23:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "f7a1b9c2d4e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(bind, name: str) -> bool:
    return sa.inspect(bind).has_table(name)


def _has_index(bind, table: str, index: str) -> bool:
    insp = sa.inspect(bind)
    return index in [idx["name"] for idx in insp.get_indexes(table)]


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_table(bind, "notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("scan_id", sa.String(length=36), nullable=True),
            sa.Column("finding_id", sa.Integer(), nullable=True),
            sa.Column("notification_type", sa.String(length=50), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("severity", sa.String(length=20), nullable=True),
            sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
                name="fk_notifications_user_id_users",
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["scan_id"],
                ["scans.id"],
                name="fk_notifications_scan_id_scans",
                ondelete="SET NULL",
            ),
            sa.ForeignKeyConstraint(
                ["finding_id"],
                ["findings.id"],
                name="fk_notifications_finding_id_findings",
                ondelete="SET NULL",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id",
                "scan_id",
                "notification_type",
                name="uq_notifications_user_scan_type",
            ),
        )

    if not _has_index(bind, "notifications", "ix_notifications_user_id"):
        op.create_index(
            op.f("ix_notifications_user_id"),
            "notifications",
            ["user_id"],
            unique=False,
        )
    if not _has_index(bind, "notifications", "ix_notifications_scan_id"):
        op.create_index(
            op.f("ix_notifications_scan_id"),
            "notifications",
            ["scan_id"],
            unique=False,
        )
    if not _has_index(bind, "notifications", "ix_notifications_finding_id"):
        op.create_index(
            op.f("ix_notifications_finding_id"),
            "notifications",
            ["finding_id"],
            unique=False,
        )
    if not _has_index(bind, "notifications", "ix_notifications_notification_type"):
        op.create_index(
            op.f("ix_notifications_notification_type"),
            "notifications",
            ["notification_type"],
            unique=False,
        )
    if not _has_index(bind, "notifications", "ix_notifications_is_read"):
        op.create_index(
            op.f("ix_notifications_is_read"),
            "notifications",
            ["is_read"],
            unique=False,
        )
    if not _has_index(bind, "notifications", "ix_notifications_created_at"):
        op.create_index(
            op.f("ix_notifications_created_at"),
            "notifications",
            ["created_at"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_created_at"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_is_read"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_notification_type"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_finding_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_scan_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")
