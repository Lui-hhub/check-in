from datetime import datetime
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    password: str

class TokenResponse(BaseModel):
    access_token: str
    role: str

class StudentResponse(BaseModel):
    id: int
    grade: str
    name: str
    subject: str
    display_name: str
    is_deleted: bool

class CheckinResponse(BaseModel):
    id: int
    student_id: int
    photo_url: str
    grade: str
    name: str
    subject: str
    created_at: datetime
    distance: float | None = None

class StudentFields(BaseModel):
    grade: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    subject: str = Field(min_length=1, max_length=100)

class StudentImportResponse(BaseModel):
    created: int
    errors: list[str]
