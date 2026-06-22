"""관리자 전용 — 시스템 설정 (API 키 등) + 사용자 관리.

모든 엔드포인트는 require_admin 통과 필요.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import settings_store
from app.auth import hash_password, require_admin
from app.db import get_db
from app.models import User
from app.services.ocr.factory import get_ocr

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


# ──────────────── 시스템 설정 ────────────────

ALLOWED_KEYS = ("upstage_api_key", "opinet_api_key", "ocr_provider", "anthropic_api_key")


class SettingUpdate(BaseModel):
    key: str
    value: str


@router.get("/settings")
def list_settings():
    return settings_store.snapshot_masked()


@router.patch("/settings")
def update_setting(body: SettingUpdate):
    if body.key not in ALLOWED_KEYS:
        raise HTTPException(400, f"허용되지 않은 키: {body.key}")
    settings_store.set_value(body.key, body.value or "")
    # ocr_provider 변경이면 어댑터 캐시도 클리어
    if body.key == "ocr_provider":
        get_ocr.cache_clear()
    return {"ok": True}


# ──────────────── 사용자 관리 ────────────────


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "admin"


class UserUpdate(BaseModel):
    is_active: bool | None = None
    role: str | None = None


class PasswordReset(BaseModel):
    new_password: str


class UserAdminOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/users", response_model=list[UserAdminOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id.asc()).all()


@router.post("/users", response_model=UserAdminOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    if len(body.password) < 4:
        raise HTTPException(400, "비밀번호는 4자 이상이어야 합니다")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, f"이미 존재하는 아이디: {body.username}")
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserAdminOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    if user.id == me.id and body.is_active is False:
        raise HTTPException(400, "본인 계정을 비활성화할 수 없습니다")
    if body.is_active is not None:
        user.is_active = 1 if body.is_active else 0
    if body.role:
        user.role = body.role
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    body: PasswordReset,
    db: Session = Depends(get_db),
):
    if len(body.new_password) < 4:
        raise HTTPException(400, "비밀번호는 4자 이상이어야 합니다")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
):
    if user_id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "본인 계정은 삭제할 수 없습니다")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    db.delete(user)
    db.commit()
    return None
