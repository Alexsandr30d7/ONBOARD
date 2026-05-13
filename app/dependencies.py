# app/dependencies.py
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.core.security import decode_access_token
from app import crud
import re

# Кастомная схема для cookie + header
class OAuth2CookieBearer:
    def __init__(self, auto_error: bool = True):
        self.auto_error = auto_error

    async def __call__(self, request: Request) -> Optional[str]:
        # Сначала ищем в Cookie
        token = request.cookies.get("access_token")
        if token:
            # Формат: "Bearer <token>"
            match = re.match(r"Bearer\s+(.+)", token)
            if match:
                return match.group(1)
        # Потом в заголовке (для Swagger)
        auth = request.headers.get("Authorization")
        if auth:
            match = re.match(r"Bearer\s+(.+)", auth)
            if match:
                return match.group(1)
        if self.auto_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None

oauth2_scheme = OAuth2CookieBearer()

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    email = decode_access_token(token)
    if not email:
        raise credentials_exception
    user = await crud.get_user_by_email(db, email=email)
    if not user or not user.is_active:
        raise credentials_exception
    return user

def require_role(required_role: str):
    def role_checker(current_user=Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker


def require_any_role(*required_roles: str):
    def role_checker(current_user=Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker