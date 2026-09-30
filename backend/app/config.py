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
    log_level: str = "INFO"
    db_pool_size: int = 10
    db_max_overflow: int = 10
    db_pool_timeout: int = 10
    rate_limit_auth_per_minute: int = 20
    rate_limit_checkins_per_minute: int = 60
    rate_limit_api_per_minute: int = 240
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings() -> Settings:
    return Settings()
