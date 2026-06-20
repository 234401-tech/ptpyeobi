"""Upstage Document AI 어댑터 (한국어 강함).

API: https://api.upstage.ai/v1/document-ai/extraction
- 키는 settings.upstage_api_key
- 응답 구조는 모델별로 다르므로 _parse() 에서 매핑 보정
- 현재는 raw 텍스트만 받아 간단 휴리스틱으로 필드 채움 (실서비스에서는 schema 추출 권장)
"""

from __future__ import annotations

import json
import re
from datetime import date

import httpx

from app.config import settings

from .base import OCRAdapter, ReceiptExtraction, TripExtraction

UPSTAGE_URL = "https://api.upstage.ai/v1/document-ai/extraction"


class UpstageOCR(OCRAdapter):
    name = "upstage"

    def extract(self, file_path: str) -> TripExtraction:
        if not settings.upstage_api_key:
            raise RuntimeError("UPSTAGE_API_KEY 미설정")

        headers = {"Authorization": f"Bearer {settings.upstage_api_key}"}
        with open(file_path, "rb") as f:
            files = {"document": (file_path, f)}
            resp = httpx.post(UPSTAGE_URL, headers=headers, files=files, timeout=60)
            resp.raise_for_status()

        return _parse(resp.json())


def _parse(data: dict) -> TripExtraction:
    """raw 응답 → TripExtraction. 응답 형식이 달라지면 이 함수만 손보면 됨."""
    text = json.dumps(data, ensure_ascii=False)

    # 거리 (km) — "139 km", "139km"
    dist = None
    if m := re.search(r"(\d+(?:\.\d+)?)\s*km", text):
        dist = float(m.group(1))

    # 날짜 — "2026-05-21" / "2026.05.21" / "2026/05/21"
    trip_date = None
    if m := re.search(r"(20\d{2})[-./](\d{1,2})[-./](\d{1,2})", text):
        trip_date = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))

    # 영수증 후보 (label, amount) — 간단 휴리스틱: "KTX … 53,600원"
    receipts: list[ReceiptExtraction] = []
    for m in re.finditer(r"([가-힣A-Za-z0-9·\-→ ]{3,40})\s*([\d,]{3,})\s*원", text):
        amount = int(m.group(2).replace(",", ""))
        if 1_000 <= amount <= 1_000_000:
            receipts.append(ReceiptExtraction(m.group(1).strip(), amount, 0.6))

    return TripExtraction(
        trip_date=trip_date,
        distance_km=dist,
        receipts=receipts[:10],
        confidence=0.7,
    )
