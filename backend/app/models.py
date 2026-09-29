from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    grade: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(120))
    face_embedding: Mapped[list[float]] = mapped_column(JSON)
    face_image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    checkins: Mapped[list["Checkin"]] = relationship(back_populates="student")
    subjects: Mapped[list["StudentSubject"]] = relationship(back_populates="student", cascade="all, delete-orphan")

class StudentSubject(Base):
    __tablename__ = "student_subjects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    subject: Mapped[str] = mapped_column(String(100))
    student: Mapped[Student] = relationship(back_populates="subjects")

class Checkin(Base):
    __tablename__ = "checkins"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    photo_path: Mapped[str] = mapped_column(String(255))
    grade_snapshot: Mapped[str] = mapped_column(String(50))
    name_snapshot: Mapped[str] = mapped_column(String(120))
    subject_snapshot: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    student: Mapped[Student] = relationship(back_populates="checkins")
