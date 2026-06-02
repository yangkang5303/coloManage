from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext

from app.core.config import get_settings


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
ALGORITHM = "HS256"


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": subject, "exp": expires}, settings.secret_key, algorithm=ALGORITHM)
