"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-09

Target: MySQL 8.0+. Character columns use utf8mb4_bin; times are DATETIME(3).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('item_bank_versions',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('label', sa.String(length=32), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('label'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('items',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('item_code', sa.String(length=32), nullable=False),
    sa.Column('lexicality', sa.Enum('real', 'pseudo', name='lexicality'), nullable=False),
    sa.Column('character', sa.String(length=8).with_variant(mysql.VARCHAR(charset='utf8mb4', collation='utf8mb4_bin', length=8), 'mysql'), nullable=True),
    sa.Column('image_path', sa.String(length=255), nullable=False),
    sa.Column('image_sha256', sa.String(length=64), nullable=False),
    sa.Column('attributes', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('item_code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('participants',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('public_id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('public_id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('bank_version_items',
    sa.Column('version_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('item_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
    sa.ForeignKeyConstraint(['version_id'], ['item_bank_versions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('version_id', 'item_id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('participant_identities',
    sa.Column('participant_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('name', sa.String(length=128), nullable=True),
    sa.Column('student_id', sa.String(length=64), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('external_code', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=False),
    sa.ForeignKeyConstraint(['participant_id'], ['participants.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('participant_id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('test_forms',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('version_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('mode', sa.Enum('research', 'formal', name='formmode'), nullable=False),
    sa.Column('randomize', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=False),
    sa.ForeignKeyConstraint(['version_id'], ['item_bank_versions.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('form_items',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('form_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('item_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('role', sa.Enum('practice', 'test', name='itemrole'), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['form_id'], ['test_forms.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('form_id', 'item_id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('test_sessions',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('form_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('label', sa.String(length=128), nullable=True),
    sa.Column('is_open', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=False),
    sa.ForeignKeyConstraint(['form_id'], ['test_forms.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('test_runs',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('public_id', sa.String(length=36), nullable=False),
    sa.Column('participant_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('session_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('form_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('version_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('consent_version', sa.String(length=32), nullable=False),
    sa.Column('consented_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=False),
    sa.Column('started_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=False),
    sa.Column('finished_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=True),
    sa.Column('user_agent', sa.String(length=512), nullable=True),
    sa.ForeignKeyConstraint(['form_id'], ['test_forms.id'], ),
    sa.ForeignKeyConstraint(['participant_id'], ['participants.id'], ),
    sa.ForeignKeyConstraint(['session_id'], ['test_sessions.id'], ),
    sa.ForeignKeyConstraint(['version_id'], ['item_bank_versions.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('public_id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('scores',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('run_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('method', sa.String(length=32), nullable=False),
    sa.Column('formula_version', sa.Integer(), nullable=False),
    sa.Column('value', sa.Numeric(precision=7, scale=4), nullable=False),
    sa.Column('details', sa.JSON(), nullable=False),
    sa.Column('computed_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=False),
    sa.ForeignKeyConstraint(['run_id'], ['test_runs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('run_id', 'method', 'formula_version'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('trials',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('run_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('role', sa.Enum('practice', 'test', name='itemrole'), nullable=False),
    sa.Column('response', sa.Enum('yes', 'no', name='response'), nullable=True),
    sa.Column('is_correct', sa.Boolean(), nullable=True),
    sa.Column('rt_ms', sa.Integer(), nullable=True),
    sa.Column('response_source', sa.String(length=16), nullable=True),
    sa.Column('presented_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=True),
    sa.Column('received_at', sa.DateTime().with_variant(mysql.DATETIME(fsp=3), 'mysql'), nullable=True),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
    sa.ForeignKeyConstraint(['run_id'], ['test_runs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('run_id', 'position'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_engine='InnoDB'
    )


def downgrade() -> None:
    op.drop_table('trials')
    op.drop_table('scores')
    op.drop_table('test_runs')
    op.drop_table('test_sessions')
    op.drop_table('form_items')
    op.drop_table('test_forms')
    op.drop_table('participant_identities')
    op.drop_table('bank_version_items')
    op.drop_table('participants')
    op.drop_table('items')
    op.drop_table('item_bank_versions')
