from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/check_in"
    viewer_password: str = "view-password"
    uploader_password: str = "upload-password"
    admin_password: str = "admin-password"
    jwt_secret: str = "change-me"
    face_match_threshold: float = 0.60
    media_dir: str = "./data/media"
    frontend_origin: str = "http://localhost:3000"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings() -> Settings:
    return Settings()
