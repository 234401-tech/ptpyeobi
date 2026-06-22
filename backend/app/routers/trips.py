"""출장 CRUD + 검색·필터 + XLSX export(Phase 6)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from pydantic import BaseModel

from app.auth import get_current_user
from app.db import get_db
from app.models import PublicReceipt, Trip
from app.schemas import TripCreate, TripOut, TripUpdate
from app.services.exporter import trips_to_xlsx
from app.services.importer import ImportError as TripImportError, parse_xlsx


class BulkDeleteIn(BaseModel):
    ids: list[int]

# 모든 trips 엔드포인트는 로그인 필수
router = APIRouter(
    prefix="/api/trips",
    tags=["trips"],
    dependencies=[Depends(get_current_user)],
)


def _next_no(db: Session) -> int:
    """다음 출장대장 번호 자동 채번 (max+1, 없으면 1)."""
    max_no = db.query(func.max(Trip.no)).scalar()
    return (max_no or 0) + 1


def _trip_with_receipts(db: Session, trip_id: int) -> Trip:
    trip = (
        db.query(Trip)
        .options(selectinload(Trip.public_receipts))
        .filter(Trip.id == trip_id)
        .first()
    )
    if not trip:
        raise HTTPException(404, "trip not found")
    return trip


# ────────────────────────── 목록 / 단건 ──────────────────────────


@router.get("", response_model=list[TripOut])
def list_trips(
    q: str | None = Query(None, description="제목 · 출장자 검색"),
    fund: str | None = Query(None, description="회계시스템 (통장|e나라|RCMS|보탬e|지방비)"),
    month: str | None = Query(None, description="YYYY-MM, 자금집행월 기준"),
    db: Session = Depends(get_db),
):
    query = db.query(Trip).options(selectinload(Trip.public_receipts))

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Trip.title.ilike(like), Trip.traveler_name.ilike(like)))
    if fund:
        query = query.filter(Trip.fund_system == fund)
    if month:
        try:
            y, m = map(int, month.split("-"))
        except ValueError:
            raise HTTPException(400, "month 형식은 YYYY-MM")
        # 자금집행일 기준 월 필터
        query = query.filter(
            func.strftime("%Y", Trip.fund_date) == f"{y:04d}",
            func.strftime("%m", Trip.fund_date) == f"{m:02d}",
        )

    return query.order_by(Trip.no.desc().nullslast(), Trip.id.desc()).all()


@router.get("/export")
def export_trips(
    q: str | None = Query(None),
    fund: str | None = Query(None),
    month: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """현재 필터와 동일한 조건으로 XLSX 다운로드."""
    query = db.query(Trip)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Trip.title.ilike(like), Trip.traveler_name.ilike(like)))
    if fund:
        query = query.filter(Trip.fund_system == fund)
    if month:
        try:
            y, m = map(int, month.split("-"))
        except ValueError:
            raise HTTPException(400, "month 형식은 YYYY-MM")
        query = query.filter(
            func.strftime("%Y", Trip.fund_date) == f"{y:04d}",
            func.strftime("%m", Trip.fund_date) == f"{m:02d}",
        )

    trips = query.order_by(Trip.no.asc().nullsfirst(), Trip.id.asc()).all()
    data = trips_to_xlsx(trips)
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    filename = f"travel_ledger_{stamp}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/{trip_id}", response_model=TripOut)
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    return _trip_with_receipts(db, trip_id)


# ────────────────────────── 생성 / 수정 / 삭제 ──────────────────────────


@router.post("", response_model=TripOut, status_code=201)
def create_trip(body: TripCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"public_receipts"})
    trip = Trip(no=_next_no(db), **data)
    for r in body.public_receipts:
        trip.public_receipts.append(PublicReceipt(**r.model_dump()))
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return _trip_with_receipts(db, trip.id)


@router.patch("/{trip_id}", response_model=TripOut)
def update_trip(trip_id: int, body: TripUpdate, db: Session = Depends(get_db)):
    trip = _trip_with_receipts(db, trip_id)
    payload = body.model_dump(exclude_unset=True)
    receipts = payload.pop("public_receipts", None)
    for k, v in payload.items():
        setattr(trip, k, v)
    if receipts is not None:
        # 영수증은 전체 교체
        trip.public_receipts.clear()
        for r in receipts:
            trip.public_receipts.append(PublicReceipt(**r))
    db.commit()
    db.refresh(trip)
    return _trip_with_receipts(db, trip.id)


@router.delete("/{trip_id}", status_code=204)
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = _trip_with_receipts(db, trip_id)
    db.delete(trip)
    db.commit()
    return None


@router.post("/bulk-delete")
def bulk_delete(body: BulkDeleteIn, db: Session = Depends(get_db)):
    """여러 출장 행을 한 번에 삭제. 응답: { deleted: N }."""
    if not body.ids:
        return {"deleted": 0}
    rows = db.query(Trip).filter(Trip.id.in_(body.ids)).all()
    for r in rows:
        db.delete(r)
    db.commit()
    return {"deleted": len(rows)}


@router.post("/import")
async def import_trips(
    file: UploadFile = File(...),
    dry_run: bool = Query(True, description="true 면 파싱만, false 면 실제 저장"),
    db: Session = Depends(get_db),
):
    """XLSX 파일로 출장대장 일괄 업로드.

    - dry_run=true: 파싱 결과만 반환 (미리보기)
    - dry_run=false: 실제 DB 저장. No 컬럼 비어있으면 자동 채번.
    """
    name = (file.filename or "").lower()
    if not name.endswith(".xlsx"):
        raise HTTPException(400, "XLSX 파일만 지원합니다")
    content = await file.read()

    try:
        parsed, warnings = parse_xlsx(content)
    except TripImportError as e:
        raise HTTPException(400, str(e))

    if dry_run:
        # 미리보기 — 앞 20건만 + 경고
        return {
            "total": len(parsed),
            "preview": parsed[:20],
            "warnings": warnings,
        }

    if not parsed:
        return {"created": 0, "warnings": warnings}

    # 실제 저장. No 가 비어있는 행은 _next_no 로 채번 (충돌 회피).
    next_no = _next_no(db)
    used_nos: set[int] = set()
    created_count = 0
    for trip_data in parsed:
        # 명시된 no 가 이미 존재하면 새로 채번
        explicit_no = trip_data.get("no")
        if explicit_no:
            exists = db.query(Trip).filter(Trip.no == explicit_no).first()
            if exists or explicit_no in used_nos:
                trip_data["no"] = next_no
                used_nos.add(next_no)
                next_no += 1
            else:
                used_nos.add(explicit_no)
        else:
            trip_data["no"] = next_no
            used_nos.add(next_no)
            next_no += 1
        db.add(Trip(**trip_data))
        created_count += 1
    db.commit()
    return {"created": created_count, "warnings": warnings}
