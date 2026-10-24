"""add email auth and verification tokens

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-20 12:55:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(bind, name: str) -> bool:
    return sa.inspect(bind).has_table(name)


def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    return column in [col["name"] for col in insp.get_columns(table)]


def _has_index(bind, table: str, index: str) -> bool:
    insp = sa.inspect(bind)
    return index in [idx["name"] for idx in insp.get_indexes(table)]


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Update users table columns
    if _has_table(bind, "users"):
        # Make github_user_id and github_login nullable if on PostgreSQL
        if bind.dialect.name != "sqlite":
            op.alter_column("users", "github_user_id", existing_type=sa.BigInteger(), nullable=True)
            op.alter_column("users", "github_login", existing_type=sa.String(length=100), nullable=True)

        if not _has_column(bind, "users", "email"):
            op.add_column("users", sa.Column("email", sa.String(length=255), nullable=True))
        if not _has_column(bind, "users", "hashed_password"):
            op.add_column("users", sa.Column("hashed_password", sa.String(length=255), nullable=True))
        if not _has_column(bind, "users", "is_verified"):
            op.add_column("users", sa.Column("is_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False))

        # Backfill existing GitHub users as verified
        op.execute("UPDATE users SET is_verified = true WHERE github_user_id IS NOT NULL")

        if not _has_index(bind, "users", "ix_users_email"):
            op.create_index(
                op.f("ix_users_email"),
                "users",
                ["email"],
                unique=True,
            )

    # 2. Create email_verification_tokens table
    if not _has_table(bind, "email_verification_tokens"):
        op.create_table(
            "email_verification_tokens",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("token_hash", sa.String(length=128), nullable=False),
            sa.Column("token_type", sa.String(length=30), server_default="email_verification", nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
                name="fk_email_verification_tokens_user_id_users",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _has_index(bind, "email_verification_tokens", "ix_email_verification_tokens_user_id"):
        op.create_index(
            op.f("ix_email_verification_tokens_user_id"),
            "email_verification_tokens",
            ["user_id"],
            unique=False,
        )
    if not _has_index(bind, "email_verification_tokens", "ix_email_verification_tokens_token_hash"):
        op.create_index(
            op.f("ix_email_verification_tokens_token_hash"),
            "email_verification_tokens",
            ["token_hash"],
            unique=False,
        )
    if not _has_index(bind, "email_verification_tokens", "ix_email_verification_tokens_expires_at"):
        op.create_index(
            op.f("ix_email_verification_tokens_expires_at"),
            "email_verification_tokens",
            ["expires_at"],
            unique=False,
        )
    if not _has_index(bind, "email_verification_tokens", "ix_email_verification_tokens_created_at"):
        op.create_index(
            op.f("ix_email_verification_tokens_created_at"),
            "email_verification_tokens",
            ["created_at"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_email_verification_tokens_created_at"), table_name="email_verification_tokens")
    op.drop_index(op.f("ix_email_verification_tokens_expires_at"), table_name="email_verification_tokens")
    op.drop_index(op.f("ix_email_verification_tokens_token_hash"), table_name="email_verification_tokens")
    op.drop_index(op.f("ix_email_verification_tokens_user_id"), table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_column("users", "is_verified")
    op.drop_column("users", "hashed_password")
    op.drop_column("users", "email")
