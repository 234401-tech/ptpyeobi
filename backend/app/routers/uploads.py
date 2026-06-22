"""증빙 업로드 + OCR 어댑터 호출.

- POST /api/uploads                  파일 저장 → attachment row 생성
- POST /api/uploads/{id}/extract     OCR 어댑터로 추출 → trips 후보값
"""

from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.db import get_db
from app.models import Attachment
from app.schemas import ExtractOut, PublicReceiptIn, UploadOut
from app.services.ocr.base import TripExtraction
from app.services.ocr.factory import get_ocr

router = APIRouter(
    prefix="/api/uploads",
    tags=["uploads"],
    dependencies=[Depends(get_current_user)],
)

ALLOWED = {".pdf", ".jpg", ".jpeg", ".png"}


@router.post("", response_model=UploadOut, status_code=201)
def upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"허용 확장자: {sorted(ALLOWED)}")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    save_path = Path(settings.upload_dir) / safe_name
    with save_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    att = Attachment(
        filename=file.filename or safe_name,
        file_path=str(save_path),
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return UploadOut(upload_id=att.id, filename=att.filename, pages=None)


@router.post("/{upload_id}/extract", response_model=ExtractOut)
def extract(upload_id: int, db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(Attachment.id == upload_id).first()
    if not att:
        raise HTTPException(404, "upload not found")

    try:
        adapter = get_ocr()
    except RuntimeError as e:
        raise HTTPException(501, str(e))

    try:
        result: TripExtraction = adapter.extract(att.file_path)
    except RuntimeError as e:
        raise HTTPException(502, f"OCR 어댑터 호출 실패: {e}")
    except Exception as e:  # 파싱 실패 등
        raise HTTPException(500, f"OCR 처리 중 오류: {e}")

    # 디버깅용 raw 저장
    att.ocr_result_json = json.dumps(
        {
            "provider": adapter.name,
            "trip_date": result.trip_date.isoformat() if result.trip_date else None,
            "place": result.place,
            "distance_km": result.distance_km,
            "receipts": [
                {"label": r.label, "amount": r.amount, "confidence": r.confidence}
                for r in result.receipts
            ],
            "confidence": result.confidence,
        },
        ensure_ascii=False,
    )
    db.commit()

    return ExtractOut(
        traveler=result.traveler,
        dept=result.dept,
        trip_date=result.trip_date,
        depart_time=result.depart_time,
        return_time=result.return_time,
        place=result.place,
        distance_km=result.distance_km,
        mode_suggested=result.mode_suggested,
        public_receipts=[
            PublicReceiptIn(label=r.label, amount=r.amount, ocr_confidence=r.confidence)
            for r in result.receipts
        ],
        companion_names=list(result.companion_names),
        confidence=result.confidence,
    )
