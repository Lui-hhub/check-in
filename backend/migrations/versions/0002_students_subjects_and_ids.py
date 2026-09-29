"""Use annual eight digit student ids and separate subjects."""
from alembic import op
import sqlalchemy as sa

revision = "0002_students_subjects_and_ids"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("student_subjects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("subject", sa.String(100), nullable=False))
    op.create_index("ix_student_subjects_student_id", "student_subjects", ["student_id"])
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("INSERT INTO student_subjects (student_id, subject) SELECT id, subject FROM students")
    else:
        rows = bind.execute(sa.text("SELECT id, subject FROM students")).fetchall()
        for student_id, subject in rows:
            bind.execute(sa.text("INSERT INTO student_subjects (student_id, subject) VALUES (:id, :subject)"), {"id": student_id, "subject": subject})
    with op.batch_alter_table("students") as batch:
        batch.drop_column("subject")

def downgrade():
    with op.batch_alter_table("students") as batch:
        batch.add_column(sa.Column("subject", sa.String(100), nullable=False, server_default=""))
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE students SET subject = COALESCE((SELECT subject FROM student_subjects WHERE student_subjects.student_id = students.id LIMIT 1), '')"))
    op.drop_index("ix_student_subjects_student_id", table_name="student_subjects")
    op.drop_table("student_subjects")
