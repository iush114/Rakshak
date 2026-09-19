"""initial schema baseline for scans and findings

Revision ID: 0e4b1a8d9f2c
Revises:
Create Date: 2026-09-16 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e4b1a8d9f2c'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'scans',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('target_path', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='completed'),
        sa.Column('code_scanning', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('dependency_scanning', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('secret_detection', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('container_scanning', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('total_findings', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('critical_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('high_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('medium_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('low_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('overall_risk', sa.Float(), nullable=False, server_default='0'),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'findings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('scan_id', sa.String(length=36), nullable=False),
        sa.Column('vulnerability_id', sa.String(length=200), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tool', sa.String(length=100), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False),
        sa.Column('priority', sa.String(length=50), nullable=True),
        sa.Column('risk_score', sa.Float(), nullable=False, server_default='0'),
        sa.Column('exploitability', sa.Float(), nullable=False, server_default='0'),
        sa.Column('target', sa.String(length=500), nullable=True),
        sa.Column('package_name', sa.String(length=300), nullable=True),
        sa.Column('installed_version', sa.String(length=100), nullable=True),
        sa.Column('fixed_version', sa.String(length=100), nullable=True),
        sa.Column('fix_available', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('production', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('affected_packages', sa.JSON(), nullable=True),
        sa.Column('ai_explanation', sa.Text(), nullable=True),
        sa.Column('potential_impact', sa.Text(), nullable=True),
        sa.Column('recommended_action', sa.Text(), nullable=True),
        sa.Column('risk_summary', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['scan_id'], ['scans.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('findings')
    op.drop_table('scans')
