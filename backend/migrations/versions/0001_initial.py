"""Initial student and check-in tables."""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("grade", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("subject", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("face_embedding", sa.JSON(), nullable=False),
        sa.Column("face_image_path", sa.String(255), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_students_is_deleted", "students", ["is_deleted"])
    op.create_table(
        "checkins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("photo_path", sa.String(255), nullable=False),
        sa.Column("grade_snapshot", sa.String(50), nullable=False),
        sa.Column("name_snapshot", sa.String(120), nullable=False),
        sa.Column("subject_snapshot", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_checkins_student_id", "checkins", ["student_id"])
    op.create_index("ix_checkins_created_at", "checkins", ["created_at"])

def downgrade():
    op.drop_table("checkins")
    op.drop_table("students")
