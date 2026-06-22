"""사업명 → 회계시스템 매핑 CRUD.

CMS 의 "사업명·시스템" 탭에서 추가/수정/삭제.
출장 입력 카드의 사업명 datalist 도 이 목록을 동적 로드.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import BizSystem

router = APIRouter(
    prefix="/api/biz-systems",
    tags=["biz-systems"],
    dependencies=[Depends(get_current_user)],
)


class BizSystemIn(BaseModel):
    biz_name: str
    fund_system: str
    note: str | None = None
    sort_order: int = 0


class BizSystemOut(BizSystemIn):
    id: int

    class Config:
        from_attributes = True


@router.get("", response_model=list[BizSystemOut])
def list_biz_systems(db: Session = Depends(get_db)):
    return (
        db.query(BizSystem)
        .order_by(BizSystem.sort_order.asc(), BizSystem.id.asc())
        .all()
    )


@router.post("", response_model=BizSystemOut, status_code=201)
def create_biz_system(body: BizSystemIn, db: Session = Depends(get_db)):
    if not body.biz_name.strip():
        raise HTTPException(400, "사업명은 비울 수 없습니다")
    existing = db.query(BizSystem).filter(BizSystem.biz_name == body.biz_name).first()
    if existing:
        raise HTTPException(400, f"이미 존재하는 사업명: {body.biz_name}")
    row = BizSystem(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{row_id}", response_model=BizSystemOut)
def update_biz_system(row_id: int, body: BizSystemIn, db: Session = Depends(get_db)):
    row = db.query(BizSystem).filter(BizSystem.id == row_id).first()
    if not row:
        raise HTTPException(404, "해당 매핑이 없습니다")
    # 사업명 변경 시 중복 체크
    if body.biz_name != row.biz_name:
        dup = db.query(BizSystem).filter(BizSystem.biz_name == body.biz_name).first()
        if dup:
            raise HTTPException(400, f"이미 존재하는 사업명: {body.biz_name}")
    for k, v in body.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{row_id}", status_code=204)
def delete_biz_system(row_id: int, db: Session = Depends(get_db)):
    row = db.query(BizSystem).filter(BizSystem.id == row_id).first()
    if not row:
        raise HTTPException(404, "해당 매핑이 없습니다")
    db.delete(row)
    db.commit()
    return None
