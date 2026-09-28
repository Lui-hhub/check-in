from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from .config import get_settings

bearer = HTTPBearer(auto_error=False)
ALGORITHM = "HS256"

def create_token(role: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"role": role, "iat": now, "exp": now + timedelta(hours=8)}, get_settings().jwt_secret, algorithm=ALGORITHM)

def require_role(role: str):
    async def dependency(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
        if not credentials:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="需要登录")
        try:
            payload = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=[ALGORITHM])
        except JWTError as exc:
            raise HTTPException(status_code=401, detail="登录已过期") from exc
        if payload.get("role") != role:
            raise HTTPException(status_code=403, detail="权限不足")
        return payload
    return dependency

def require_any(*roles: str):
    async def dependency(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
        if not credentials:
            raise HTTPException(status_code=401, detail="需要登录")
        try:
            payload = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=[ALGORITHM])
        except JWTError as exc:
            raise HTTPException(status_code=401, detail="登录已过期") from exc
        if payload.get("role") not in roles:
            raise HTTPException(status_code=403, detail="权限不足")
        return payload
    return dependency
