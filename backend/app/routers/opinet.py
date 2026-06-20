"""오파넷 유가 — DB 캐시 우선, 누락분만 API 호출."""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FuelPrice
from app.schemas import FuelPriceOut
from app.services.opinet_client import (
    OpinetError,
    OpinetNotConfigured,
    fetch_recent_prices,
    weekday_ko,
)

router = APIRouter(prefix="/api/opinet", tags=["opinet"])


def _parse_date(s: str) -> date:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, f"잘못된 날짜 형식: {s} (YYYY-MM-DD)")


def _attach_deltas(rows: list[FuelPrice]) -> list[FuelPriceOut]:
    """직전일 대비 ▲▼ 계산. rows 는 날짜 오름차순 가정."""
    out: list[FuelPriceOut] = []
    prev = None
    for r in rows:
        delta = None if prev is None else r.price - prev
        out.append(
            FuelPriceOut(date=r.date, weekday=r.weekday, price=r.price, delta=delta)
        )
        prev = r.price
    return out


async def _refresh_recent(db: Session) -> int:
    """오파넷 최근 7일치를 한 번에 받아 캐시에 upsert. 반환: 새로 저장한 행 수."""
    try:
        prices = await fetch_recent_prices()
    except (OpinetNotConfigured, OpinetError):
        return 0
    saved = 0
    for d, price in prices.items():
        existing = db.query(FuelPrice).filter(FuelPrice.date == d).first()
        if existing:
            existing.price = price
            existing.weekday = weekday_ko(d)
        else:
            db.add(FuelPrice(date=d, weekday=weekday_ko(d), price=price))
            saved += 1
    db.commit()
    return saved


async def _ensure_cached(db: Session, target: date) -> FuelPrice | None:
    """캐시 우선, 없으면 오파넷 호출 (7일치 일괄) 후 저장. 실패 시 None."""
    cached = db.query(FuelPrice).filter(FuelPrice.date == target).first()
    if cached:
        return cached
    await _refresh_recent(db)
    return db.query(FuelPrice).filter(FuelPrice.date == target).first()


# ────────────────────────── 엔드포인트 ──────────────────────────


@router.get("/prices", response_model=list[FuelPriceOut])
async def list_prices(
    from_: str = Query(..., alias="from", description="YYYY-MM-DD"),
    to: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """기간 내 유가. 캐시에 없는 날짜는 오파넷 API 호출."""
    d_from = _parse_date(from_)
    d_to = _parse_date(to)
    if d_from > d_to:
        raise HTTPException(400, "from > to")
    if (d_to - d_from).days > 90:
        raise HTTPException(400, "기간은 최대 90일")

    # 캐시 미스가 있으면 한 번만 오파넷을 호출 (7일치 일괄 갱신)
    missing = (
        db.query(FuelPrice)
        .filter(FuelPrice.date >= d_from, FuelPrice.date <= d_to)
        .count()
    ) < (d_to - d_from).days + 1
    if missing:
        await _refresh_recent(db)

    rows = (
        db.query(FuelPrice)
        .filter(FuelPrice.date >= d_from, FuelPrice.date <= d_to)
        .order_by(FuelPrice.date.asc())
        .all()
    )
    out = _attach_deltas(rows)
    # 디자인 미리보기는 최신이 위 → desc 정렬해서 반환
    return list(reversed(out))


@router.get("/prices/{target}", response_model=FuelPriceOut)
async def get_price(target: str, db: Session = Depends(get_db)):
    d = _parse_date(target)
    row = await _ensure_cached(db, d)
    if not row:
        raise HTTPException(503, "오파넷 API 미설정 또는 호출 실패 (캐시에도 없음)")
    return FuelPriceOut(date=row.date, weekday=row.weekday, price=row.price)


@router.post("/sync")
async def sync_recent(db: Session = Depends(get_db)):
    """오파넷 최근 7일치 동기화 (수동). 캐시에 이미 있어도 최신값으로 덮어씀."""
    saved_new = await _refresh_recent(db)
    return {"saved_new": saved_new, "ok": True}
