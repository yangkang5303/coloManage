"""add topic evidence contract scope

Revision ID: 0002_add_topic_evidence_contract_id
Revises: 0001_initial
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_add_topic_evidence_contract_id"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("topic_evidence") as batch_op:
        batch_op.add_column(sa.Column("contract_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_topic_evidence_contract_id_contracts",
            "contracts",
            ["contract_id"],
            ["id"],
        )

    op.execute(
        """
        UPDATE topic_evidence
        SET contract_id = (
            SELECT documents.contract_id
            FROM documents
            WHERE documents.id = topic_evidence.document_id
        )
        """
    )
    op.create_index(op.f("ix_topic_evidence_contract_id"), "topic_evidence", ["contract_id"], unique=False)
    op.create_index(
        "ix_topic_evidence_topic_contract",
        "topic_evidence",
        ["topic_key", "contract_id"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_topic_evidence_topic_contract", table_name="topic_evidence")
    op.drop_index(op.f("ix_topic_evidence_contract_id"), table_name="topic_evidence")
    with op.batch_alter_table("topic_evidence") as batch_op:
        batch_op.drop_constraint("fk_topic_evidence_contract_id_contracts", type_="foreignkey")
        batch_op.drop_column("contract_id")
