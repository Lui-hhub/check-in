"""Add pgvector storage and index for face embeddings."""
from alembic import op
import sqlalchemy as sa

revision = "0002_face_embedding_vector"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column("students", sa.Column("face_embedding_vector", sa.Text(), nullable=True))
    # Use raw SQL because the PostgreSQL vector type is provided by the extension.
    op.execute("ALTER TABLE students ALTER COLUMN face_embedding_vector TYPE vector(128) USING NULL::vector")
    op.execute(
        """
        UPDATE students
        SET face_embedding_vector = face_embedding::text::vector
        WHERE jsonb_array_length(face_embedding::jsonb) = 128
        """
    )
    op.execute(
        "CREATE INDEX ix_students_face_embedding_vector_l2 "
        "ON students USING hnsw (face_embedding_vector vector_l2_ops) "
        "WHERE is_deleted = false AND face_embedding_vector IS NOT NULL"
    )


def downgrade():
    op.drop_index("ix_students_face_embedding_vector_l2", table_name="students")
    op.drop_column("students", "face_embedding_vector")
