"""OCR 어댑터 프로토콜 + 공용 dataclass.

증빙(PDF/이미지) 한 건에서 두 종류의 정보를 추출:
  1) TripExtraction      — 출장 기본정보 (출장자/일시/지/거리/모드 추정)
  2) ReceiptExtraction   — 영수증 줄들 (대중교통비 자동 입력용)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Protocol


@dataclass
class ReceiptExtraction:
    label: str
    amount: int
    confidence: float | None = None


@dataclass
class TripExtraction:
    traveler: str | None = None
    dept: str | None = None
    trip_date: date | None = None
    depart_time: str | None = None
    return_time: str | None = None
    place: str | None = None
    distance_km: float | None = None
    mode_suggested: str | None = None  # self_drive | self_passenger | company_car | public_transit
    receipts: list[ReceiptExtraction] = field(default_factory=list)
    confidence: float | None = None


class OCRAdapter(Protocol):
    name: str

    def extract(self, file_path: str) -> TripExtraction:
        """파일 경로를 받아 출장+영수증 정보를 한 번에 반환."""
        ...
