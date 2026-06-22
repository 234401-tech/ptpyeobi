"""인증 유틸리티 — 비번 해시(bcrypt) + JWT 토큰 발급/검증 + FastAPI 의존성.

사용 패턴:
  - 라우터에서:  user: User = Depends(require_admin)
  - 로그인:      hash_password / verify_password
  - 토큰 발급:    create_access_token(user_id, username)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User

# bcrypt 5.x 직접 사용 (passlib 호환성 이슈 회피). 72바이트 제한은 수동 절단.

# /api/auth/login 으로 token 발급 — FastAPI 문서의 Authorize 버튼 연동도 가능
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

ALGO = "HS256"
EXPIRES_HOURS = 12


def hash_password(plain: str) -> str:
    pw = plain.encode("utf-8")[:72]  # bcrypt 72바이트 한계
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        pw = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pw, hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: int, username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=EXPIRES_HOURS)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGO)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "토큰 만료")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 토큰")


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """모든 보호 라우터의 기본 의존성. 토큰 없거나 비활성 사용자면 401."""
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다")
    payload = _decode(token)
    uid_raw = payload.get("sub")
    try:
        uid = int(uid_raw)
    except (TypeError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 토큰")
    user = db.query(User).filter(User.id == uid).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "사용자 없음 또는 비활성")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """관리자 권한 — 현재는 모든 활성 사용자가 admin."""
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "관리자 권한 필요")
    return user
