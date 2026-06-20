"""로컬 OCR 어댑터 — RapidOCR (PaddleOCR 모델, ONNX Runtime).

완전 무료 / 망분리 환경 OK / Python 3.13 호환.
PDF는 지원하지 않음 (이미지: PNG/JPG/JPEG만). PDF 지원 필요 시 pymupdf 등 추가.

추출 전략:
  1) RapidOCR 로 줄 단위 텍스트 + 신뢰도 받음
  2) 정규식으로 거리(km)·날짜·시간·금액 후보 파싱
  3) 출장자/지/모드는 자유 텍스트라 자동 추정 어려움 → null 반환 (담당자가 직접 입력)
  4) 금액 라인 중 "원" 포함된 것을 영수증 후보로
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path

from .base import OCRAdapter, ReceiptExtraction, TripExtraction

_RX_DATE = re.compile(r"(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})")
_RX_TIME = re.compile(r"(\d{1,2}):(\d{2})")
_RX_DIST = re.compile(r"(\d+(?:\.\d+)?)\s*km", re.IGNORECASE)
_RX_AMOUNT = re.compile(r"([\d,]{3,})\s*원")
_RX_AMOUNT_BARE = re.compile(r"\b([\d,]{4,})\b")

_OCR = None


def _get_ocr():
    global _OCR
    if _OCR is None:
        from rapidocr_onnxruntime import RapidOCR

        _OCR = RapidOCR()
    return _OCR


class LocalOCR(OCRAdapter):
    name = "local"

    def extract(self, file_path: str) -> TripExtraction:
        ext = Path(file_path).suffix.lower()
        if ext not in {".png", ".jpg", ".jpeg"}:
            raise RuntimeError(
                f"local OCR 은 이미지만 지원 (입력: {ext}). PDF는 claude_vision/upstage 사용."
            )

        ocr = _get_ocr()
        result, _ = ocr(file_path)
        if not result:
            return TripExtraction(confidence=0.0)

        # 줄 단위 (text, confidence) 로 변환 — box 정보는 미사용
        lines: list[tuple[str, float]] = []
        for row in result:
            try:
                _, text, conf = row[0], row[1], float(row[2])
            except (IndexError, ValueError, TypeError):
                continue
            lines.append((text.strip(), conf))

        return _parse(lines)


def _parse(lines: list[tuple[str, float]]) -> TripExtraction:
    blob = "\n".join(t for t, _ in lines)

    # 날짜: 가장 먼저 등장하는 유효 날짜
    trip_date: date | None = None
    for t, _ in lines:
        if m := _RX_DATE.search(t):
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            try:
                trip_date = date(y, mo, d)
                break
            except ValueError:
                continue

    # 시간: 첫 두 개를 출발/복귀로 추정
    times = []
    for t, _ in lines:
        for m in _RX_TIME.finditer(t):
            hh, mm = int(m.group(1)), int(m.group(2))
            if 0 <= hh <= 23 and 0 <= mm <= 59:
                times.append(f"{hh:02d}:{mm:02d}")
                if len(times) >= 2:
                    break
        if len(times) >= 2:
            break
    depart_time = times[0] if times else None
    return_time = times[1] if len(times) > 1 else None

    # 거리 (km) — 가장 큰 km 값을 채택 (작은 단위는 거리 표기 아닐 수 있음)
    distances = []
    for t, _ in lines:
        for m in _RX_DIST.finditer(t):
            try:
                v = float(m.group(1))
                if 1 <= v <= 2000:
                    distances.append(v)
            except ValueError:
                pass
    distance_km = max(distances) if distances else None

    # 영수증 후보: "원"이 포함된 라인의 금액 추출
    receipts: list[ReceiptExtraction] = []
    for t, conf in lines:
        if "원" not in t:
            continue
        for m in _RX_AMOUNT.finditer(t):
            try:
                amt = int(m.group(1).replace(",", ""))
            except ValueError:
                continue
            if 500 <= amt <= 1_000_000:
                # 금액 토큰 제거한 나머지를 label 로
                label = _RX_AMOUNT.sub("", t).strip(" :·-")[:60] or "영수증"
                receipts.append(ReceiptExtraction(label, amt, conf))
        if len(receipts) >= 10:
            break

    # 신뢰도: 라인 평균 — 단, 잡힌 필드 수에 따라 가중
    avg_conf = sum(c for _, c in lines) / max(1, len(lines))
    field_hits = sum(bool(x) for x in (trip_date, distance_km, depart_time))
    overall = min(0.95, avg_conf * (0.5 + 0.15 * field_hits))

    return TripExtraction(
        trip_date=trip_date,
        depart_time=depart_time,
        return_time=return_time,
        distance_km=distance_km,
        receipts=receipts,
        confidence=overall,
    )
