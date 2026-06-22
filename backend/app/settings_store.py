"""런타임 설정값 헬퍼.

CMS 에서 변경 가능한 키들(API 키 등)은 app_settings 테이블에 저장.
조회 우선순위: DB > .env. 매 호출마다 DB 조회하지 않도록 메모리 캐시 + 무효화 지원.
"""

from __future__ import annotations

from app.config import settings
from app.db import SessionLocal
from app.models import AppSetting

# CMS 에서 변경 가능한 키 목록 — 화이트리스트
ALLOWED_KEYS = ("upstage_api_key", "opinet_api_key", "ocr_provider", "anthropic_api_key")

# 인메모리 캐시. None = 아직 로드 안 됨. invalidate() 로 비움.
_cache: dict[str, str] | None = None


def _env_value(key: str) -> str:
    return getattr(settings, key, "") or ""


def _load_cache() -> dict[str, str]:
    """DB 의 app_settings 를 한 번에 읽어 dict 으로. 누락된 키는 .env 폴백."""
    db = SessionLocal()
    try:
        rows = {r.key: r.value for r in db.query(AppSetting).all()}
    finally:
        db.close()
    out: dict[str, str] = {}
    for k in ALLOWED_KEYS:
        out[k] = rows.get(k) or _env_value(k)
    return out


def get(key: str) -> str:
    global _cache
    if key not in ALLOWED_KEYS:
        # 화이트리스트 밖이면 그냥 .env 값
        return _env_value(key)
    if _cache is None:
        _cache = _load_cache()
    return _cache.get(key, "")


def set_value(key: str, value: str) -> None:
    """DB 업데이트 후 캐시 무효화."""
    if key not in ALLOWED_KEYS:
        raise ValueError(f"허용되지 않은 설정 키: {key}")
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(AppSetting(key=key, value=value))
        db.commit()
    finally:
        db.close()
    invalidate()


def invalidate() -> None:
    global _cache
    _cache = None


def snapshot_masked() -> dict[str, dict]:
    """관리자 페이지 조회용 — 값 일부 마스킹 + 출처 표시."""
    if _cache is None:
        _load_and_set()
    out: dict[str, dict] = {}
    for k in ALLOWED_KEYS:
        val = get(k)
        env_val = _env_value(k)
        from_env = (not _has_db_value(k)) and bool(env_val)
        out[k] = {
            "value": _mask(val),
            "has_value": bool(val),
            "source": "env" if from_env else ("db" if val else "none"),
        }
    return out


def _has_db_value(key: str) -> bool:
    db = SessionLocal()
    try:
        return db.query(AppSetting).filter(AppSetting.key == key).first() is not None
    finally:
        db.close()


def _load_and_set() -> None:
    global _cache
    _cache = _load_cache()


def _mask(s: str) -> str:
    if not s:
        return ""
    if len(s) <= 8:
        return "•" * len(s)
    return s[:4] + "•" * (len(s) - 8) + s[-4:]
