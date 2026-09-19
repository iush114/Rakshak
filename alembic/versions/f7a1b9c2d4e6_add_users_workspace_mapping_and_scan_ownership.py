"""add users, workspace mapping tables and scan ownership

Revision ID: f7a1b9c2d4e6
Revises: a1b2c3d4e5f6
Create Date: 2026-09-16 22:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7a1b9c2d4e6"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
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


def _has_foreign_key(bind, table: str, name: str) -> bool:
    insp = sa.inspect(bind)
    return name in [fk["name"] for fk in insp.get_foreign_keys(table)]


def upgrade() -> None:
    bind = op.get_bind()

    # --- users: internal Rakshak workspace identity -------------------------
    # Guards make this migration idempotent so it converges cleanly even when
    # the objects already exist (e.g. an environment provisioned directly from
    # Base.metadata). This migration never drops data.
    if not _has_table(bind, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("github_user_id", sa.BigInteger(), nullable=False),
            sa.Column("github_login", sa.String(length=100), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=True),
            sa.Column("avatar_url", sa.String(length=500), nullable=True),
            sa.Column("html_url", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("last_seen_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _has_index(bind, "users", "ix_users_github_user_id"):
        op.create_index(
            op.f("ix_users_github_user_id"),
            "users",
            ["github_user_id"],
            unique=True,
        )

    # --- user_installations: GitHub App installation -> workspace -----------
    if not _has_table(bind, "user_installations"):
        op.create_table(
            "user_installations",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("installation_id", sa.BigInteger(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("last_seen_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
                name="fk_user_installations_user_id_users",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("installation_id", name="uq_user_installations_installation_id"),
        )
    if not _has_index(bind, "user_installations", "ix_user_installations_installation_id"):
        op.create_index(
            op.f("ix_user_installations_installation_id"),
            "user_installations",
            ["installation_id"],
            unique=True,
        )
    if not _has_index(bind, "user_installations", "ix_user_installations_user_id"):
        op.create_index(
            op.f("ix_user_installations_user_id"),
            "user_installations",
            ["user_id"],
            unique=False,
        )

    # --- user_repositories: workspace <-> repository mapping ----------------
    # A repository may be associated with multiple workspaces, so uniqueness
    # is (user_id, repository_full_name) — never the repository name alone.
    if not _has_table(bind, "user_repositories"):
        op.create_table(
            "user_repositories",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("repository_full_name", sa.String(length=255), nullable=False),
            sa.Column("installation_id", sa.BigInteger(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("last_seen_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
                name="fk_user_repositories_user_id_users",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id",
                "repository_full_name",
                name="uq_user_repositories_user_repo",
            ),
        )
    if not _has_index(bind, "user_repositories", "ix_user_repositories_user_id"):
        op.create_index(
            op.f("ix_user_repositories_user_id"),
            "user_repositories",
            ["user_id"],
            unique=False,
        )
    if not _has_index(bind, "user_repositories", "ix_user_repositories_repository_full_name"):
        op.create_index(
            op.f("ix_user_repositories_repository_full_name"),
            "user_repositories",
            ["repository_full_name"],
            unique=False,
        )

    # --- scans.user_id: workspace ownership ---------------------------------
    # Nullable: existing scans keep NULL ownership and are treated as
    # historical/system data — visible to no workspace, never deleted.
    if not _has_column(bind, "scans", "user_id"):
        op.add_column("scans", sa.Column("user_id", sa.Integer(), nullable=True))
    if not _has_foreign_key(bind, "scans", "fk_scans_user_id_users"):
        op.create_foreign_key(
            "fk_scans_user_id_users",
            "scans",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )
    if not _has_index(bind, "scans", "ix_scans_user_id"):
        op.create_index(op.f("ix_scans_user_id"), "scans", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_scans_user_id"), table_name="scans")
    op.drop_constraint("fk_scans_user_id_users", "scans", type_="foreignkey")
    op.drop_column("scans", "user_id")

    op.drop_index(op.f("ix_user_repositories_repository_full_name"), table_name="user_repositories")
    op.drop_index(op.f("ix_user_repositories_user_id"), table_name="user_repositories")
    op.drop_table("user_repositories")

    op.drop_index(op.f("ix_user_installations_user_id"), table_name="user_installations")
    op.drop_index(op.f("ix_user_installations_installation_id"), table_name="user_installations")
    op.drop_table("user_installations")

    op.drop_index(op.f("ix_users_github_user_id"), table_name="users")
    op.drop_table("users")
