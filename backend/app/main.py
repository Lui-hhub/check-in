import json
import io
import math
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from openpyxl import load_workbook
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import create_token, require_any, require_role
from .config import get_settings
from .db import get_db
from .models import Checkin, Student
from .schemas import CheckinResponse, LoginRequest, StudentFields, StudentImportResponse, StudentResponse, TokenResponse

settings = get_settings()
media_root = Path(settings.media_dir).resolve()
@asynccontextmanager
async def lifespan(_: FastAPI):
    media_root.mkdir(parents=True, exist_ok=True)
    yield

app = FastAPI(title="补习班签到 API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
async def health(): return {"status": "ok"}

@app.post("/api/auth/{kind}-login", response_model=TokenResponse)
async def login(kind: str, body: LoginRequest):
    passwords = {"viewer": settings.viewer_password, "uploader": settings.uploader_password, "admin": settings.admin_password}
    if kind not in passwords or body.password != passwords[kind]:
        raise HTTPException(status_code=401, detail="密码错误")
    return TokenResponse(access_token=create_token(kind), role=kind)

def student_out(s: Student) -> StudentResponse:
    return StudentResponse(id=s.id, grade=s.grade, name=s.name, subject=s.subject, display_name=s.display_name, is_deleted=s.is_deleted)

async def unique_display_name(db: AsyncSession, grade: str, name: str, subject: str, exclude_id: int | None = None) -> str:
    query = select(Student).where(Student.grade == grade, Student.name == name, Student.subject == subject)
    if exclude_id is not None: query = query.where(Student.id != exclude_id)
    result = await db.execute(query)
    existing = list(result.scalars())
    if not existing: return name
    return f"{name}-{max([int(s.display_name.rsplit('-', 1)[1]) for s in existing if s.display_name.startswith(name + '-') and s.display_name.rsplit('-', 1)[1].isdigit()] or [1]) + 1}"

async def save_upload(upload: UploadFile, folder: str) -> str:
    suffix = ".jpg"
    relative = f"{folder}/{uuid.uuid4().hex}{suffix}"
    target = media_root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    data = await upload.read()
    if len(data) > 8 * 1024 * 1024: raise HTTPException(413, "图片过大")
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            if image.width > 640 or image.height > 640:
                raise HTTPException(400, "上传照片尺寸不能超过 640 像素")
            image.convert("RGB").save(target, format="JPEG", quality=80, optimize=True)
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(400, "请上传有效的 JPEG 照片") from exc
    return relative

def parse_embedding(raw: str) -> list[float]:
    try: value = json.loads(raw)
    except json.JSONDecodeError as exc: raise HTTPException(400, "特征格式错误") from exc
    if not isinstance(value, list) or len(value) != 128 or not all(isinstance(x, (int, float)) for x in value): raise HTTPException(400, "特征必须是 128 维数组")
    return [float(x) for x in value]

def distance(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))

@app.get("/api/students", response_model=list[StudentResponse])
async def list_students(include_deleted: bool = False, _: dict = Depends(require_any("uploader", "admin")), db: AsyncSession = Depends(get_db)):
    query = select(Student).order_by(Student.grade, Student.display_name)
    if not include_deleted: query = query.where(Student.is_deleted.is_(False))
    return [student_out(s) for s in (await db.execute(query)).scalars()]

async def create_student(db: AsyncSession, grade: str, name: str, subject: str, embedding: list[float], image_path: str | None):
    student = Student(grade=grade, name=name, subject=subject, display_name=await unique_display_name(db, grade, name, subject), face_embedding=embedding, face_image_path=image_path)
    db.add(student); await db.commit(); await db.refresh(student); return student

@app.post("/api/students", response_model=StudentResponse)
async def add_student(grade: Annotated[str, Form()], name: Annotated[str, Form()], subject: Annotated[str, Form()], embedding: Annotated[str, Form()], face_image: Annotated[UploadFile, File()], _: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    path = await save_upload(face_image, "students")
    return student_out(await create_student(db, grade, name, subject, parse_embedding(embedding), path))

@app.post("/api/students/import", response_model=StudentImportResponse)
async def import_students(file: Annotated[UploadFile, File()], _: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(400, "请上传 .xlsx 格式的 Excel 文件")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Excel 文件不能超过 5MB")
    try:
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        sheet = workbook.active
        rows = sheet.iter_rows(values_only=True)
        headers = next(rows, None)
        if not headers:
            raise HTTPException(400, "Excel 文件没有表头")
        aliases = {"年级": "grade", "grade": "grade", "姓名": "name", "name": "name", "补课科目": "subject", "科目": "subject", "subject": "subject"}
        columns = {aliases.get(str(value).strip().lower()): index for index, value in enumerate(headers) if value is not None and aliases.get(str(value).strip().lower())}
        missing = [label for label, key in (("年级", "grade"), ("姓名", "name"), ("补课科目", "subject")) if key not in columns]
        if missing:
            raise HTTPException(400, f"Excel 缺少列：{', '.join(missing)}")
        created = 0
        errors: list[str] = []
        for row_number, row in enumerate(rows, start=2):
            values = {key: str(row[index]).strip() if index < len(row) and row[index] is not None else "" for key, index in columns.items()}
            if not any(values.values()):
                continue
            missing_values = [label for label, key in (("年级", "grade"), ("姓名", "name"), ("补课科目", "subject")) if not values[key]]
            if missing_values:
                errors.append(f"第 {row_number} 行缺少：{', '.join(missing_values)}")
                continue
            student = Student(grade=values["grade"], name=values["name"], subject=values["subject"], display_name=await unique_display_name(db, values["grade"], values["name"], values["subject"]), face_embedding=[], face_image_path=None)
            db.add(student)
            await db.flush()
            created += 1
        await db.commit()
        workbook.close()
        return StudentImportResponse(created=created, errors=errors)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, "无法读取 Excel 文件，请确认文件未损坏且为 .xlsx 格式") from exc

@app.patch("/api/students/{student_id}", response_model=StudentResponse)
async def edit_student(student_id: int, fields: StudentFields, _: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    student = await db.get(Student, student_id)
    if not student: raise HTTPException(404, "学生不存在")
    changed_identity = (student.grade, student.name, student.subject) != (fields.grade, fields.name, fields.subject)
    student.grade, student.name, student.subject = fields.grade, fields.name, fields.subject
    if changed_identity:
        student.display_name = await unique_display_name(db, fields.grade, fields.name, fields.subject, exclude_id=student.id)
    await db.commit(); await db.refresh(student); return student_out(student)

@app.post("/api/students/{student_id}/face", response_model=StudentResponse)
async def replace_face(student_id: int, embedding: Annotated[str, Form()], face_image: Annotated[UploadFile, File()], _: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    student = await db.get(Student, student_id)
    if not student: raise HTTPException(404, "学生不存在")
    student.face_embedding = parse_embedding(embedding); student.face_image_path = await save_upload(face_image, "students")
    await db.commit(); await db.refresh(student); return student_out(student)

@app.delete("/api/students/{student_id}")
async def delete_student(student_id: int, _: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    student = await db.get(Student, student_id)
    if not student: raise HTTPException(404, "学生不存在")
    student.is_deleted = True; await db.commit(); return {"ok": True}

@app.post("/api/checkins", response_model=CheckinResponse)
async def add_checkin(embedding: Annotated[str, Form()], photo: Annotated[UploadFile, File()], student_id: Annotated[int | None, Form()] = None, _: dict = Depends(require_role("uploader")), db: AsyncSession = Depends(get_db)):
    vector = parse_embedding(embedding)
    student = await db.get(Student, student_id) if student_id else None
    if student and student.is_deleted: raise HTTPException(422, "学生已删除")
    matched_distance = None
    if not student:
        students = [student for student in (await db.execute(select(Student).where(Student.is_deleted.is_(False)))).scalars() if len(student.face_embedding or []) == 128]
        if not students: raise HTTPException(422, "暂无学生资料")
        student, matched_distance = min(((s, distance(vector, s.face_embedding)) for s in students), key=lambda x: x[1])
        if matched_distance > settings.face_match_threshold: raise HTTPException(422, "未识别到学生")
    if student.is_deleted: raise HTTPException(422, "学生已删除")
    path = await save_upload(photo, "checkins")
    checkin = Checkin(student_id=student.id, photo_path=path, grade_snapshot=student.grade, name_snapshot=student.display_name, subject_snapshot=student.subject)
    db.add(checkin); await db.flush()
    old = list((await db.execute(select(Checkin).where(Checkin.student_id == student.id).order_by(desc(Checkin.created_at), desc(Checkin.id)))).scalars())
    for record in old[10:]:
        try: (media_root / record.photo_path).unlink(missing_ok=True)
        except OSError: pass
        await db.delete(record)
    await db.commit(); await db.refresh(checkin)
    return CheckinResponse(id=checkin.id, student_id=student.id, photo_url=f"/media/{path}", grade=checkin.grade_snapshot, name=checkin.name_snapshot, subject=checkin.subject_snapshot, created_at=checkin.created_at, distance=matched_distance)

@app.get("/api/checkins", response_model=list[CheckinResponse])
async def list_checkins(_: dict = Depends(require_any("viewer", "admin")), db: AsyncSession = Depends(get_db)):
    records = list((await db.execute(select(Checkin).order_by(desc(Checkin.created_at), desc(Checkin.id)))).scalars())
    return [CheckinResponse(id=r.id, student_id=r.student_id, photo_url=f"/media/{r.photo_path}", grade=r.grade_snapshot, name=r.name_snapshot, subject=r.subject_snapshot, created_at=r.created_at) for r in records]

@app.get("/media/{path:path}")
async def media(path: str, _: dict = Depends(require_any("viewer", "uploader", "admin"))):
    target = (media_root / path).resolve()
    if media_root not in target.parents or not target.is_file(): raise HTTPException(404, "文件不存在")
    return FileResponse(target)
