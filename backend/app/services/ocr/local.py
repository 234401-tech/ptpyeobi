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
import tempfile
from datetime import date
from pathlib import Path

from .base import OCRAdapter, ReceiptExtraction, TripExtraction

_RX_DATE = re.compile(r"(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})")
_RX_TIME = re.compile(r"(\d{1,2}):(\d{2})")
_RX_DIST = re.compile(r"(\d+(?:\.\d+)?)\s*km", re.IGNORECASE)
_RX_AMOUNT = re.compile(r"([\d,]{3,})\s*원")
# 정상 천단위 구분자 (콤마 또는 점 — OCR이 콤마를 점으로 잘못 읽는 케이스 보정).
# 앞뒤로 숫자/콤마/점이 더 붙어 있으면 매칭 안 함 → 234,506002638 같은 잡음 배제.
# 날짜 (2026.04.09) 는 3자리 그룹이 아니라 매칭 안 됨.
_RX_AMOUNT_KOMMA = re.compile(r"(?<![\d,.])(\d{1,3}(?:[,.]\d{3})+)(?![\d,.])")
# 사업자번호 (xxx-xx-xxxxx) / 카드번호 마스킹 패턴 — 영수증 금액 아닌 메타 정보
_RX_BIZ_NO = re.compile(r"\d{3}-\d{2}-\d{5}")
_RX_CARD_MASK = re.compile(r"\d{4}-?\*+")

# 라벨 기반 추출: "출 장 자" 처럼 띄어진 경우도 흡수, 콜론 유무 무관
_RX_LABEL_TRAVELER = re.compile(r"출\s*장?\s*자\s*[:：]?\s*(.+)")
_RX_LABEL_PLACE = re.compile(r"출\s*장?\s*지\s*[:：]?\s*(.+)")
_RX_LABEL_DATETIME = re.compile(r"출\s*장?\s*일?\s*시\s*[:：]?\s*(.+)")
# 한국어 인명 후보 (콤마/공백/그리고 로 구분, 각 2~5자 한글)
_RX_KOR_NAMES = re.compile(r"[가-힣]{2,5}(?:\s*[,및과/\s]\s*[가-힣]{2,5})*")

_OCR = None


def _get_ocr():
    global _OCR
    if _OCR is None:
        from rapidocr_onnxruntime import RapidOCR

        _OCR = RapidOCR()
    return _OCR


def _preprocess(file_path: str) -> str:
    """작은 한글 인식률 개선: 2배 업스케일 + 콘트라스트 강화.

    원본은 건드리지 않고 임시 파일에 저장 후 경로 반환.
    PIL/Pillow 는 rapidocr-onnxruntime 의존성으로 이미 설치돼 있음.
    """
    try:
        from PIL import Image, ImageEnhance, ImageOps
    except ImportError:
        return file_path

    img = Image.open(file_path)
    if img.mode not in ("L", "RGB"):
        img = img.convert("RGB")
    # 그레이스케일은 노이즈를 줄이지만 컬러 도장/스탬프를 잃음. RGB 유지.
    img = ImageEnhance.Contrast(img).enhance(1.4)
    img = ImageEnhance.Sharpness(img).enhance(1.3)
    if img.width < 2000:
        scale = max(2, 2400 // img.width)
        img = img.resize((img.width * scale, img.height * scale), Image.LANCZOS)
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp.close()
    img.save(tmp.name, "PNG")
    return tmp.name


class LocalOCR(OCRAdapter):
    name = "local"

    def extract(self, file_path: str) -> TripExtraction:
        ext = Path(file_path).suffix.lower()
        if ext not in {".png", ".jpg", ".jpeg"}:
            raise RuntimeError(
                f"local OCR 은 이미지만 지원 (입력: {ext}). PDF는 claude_vision/upstage 사용."
            )

        # 작은 한글 잘 잡히도록 이미지 전처리
        preprocessed = _preprocess(file_path)
        ocr = _get_ocr()
        try:
            result, _ = ocr(preprocessed)
        finally:
            if preprocessed != file_path:
                Path(preprocessed).unlink(missing_ok=True)

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


def _label_value(lines: list[tuple[str, float]], rx) -> str | None:
    """라벨 정규식으로 같은 줄에서 값 추출. 같은 줄에 값이 없으면 다음 줄."""
    for i, (t, _) in enumerate(lines):
        m = rx.search(t)
        if not m:
            continue
        value = m.group(1).strip(" :：·-()[]").strip()
        if value:
            return value
        # 같은 줄이 비었으면 바로 다음 줄 값 후보
        if i + 1 < len(lines):
            nxt = lines[i + 1][0].strip(" :：·-()[]").strip()
            if nxt:
                return nxt
    return None


def _parse(lines: list[tuple[str, float]]) -> TripExtraction:
    blob = "\n".join(t for t, _ in lines)

    # 출장자 — "출장자" 라벨 뒤의 값에서 한국어 이름들만 추출
    traveler = None
    raw = _label_value(lines, _RX_LABEL_TRAVELER)
    if raw:
        names = _RX_KOR_NAMES.findall(raw)
        # findall 은 그룹 결과만 — 전체 매치 다시 찾기
        matches = list(re.finditer(r"[가-힣]{2,5}(?:\s*[,및과/\s]\s*[가-힣]{2,5})*", raw))
        if matches:
            traveler = matches[0].group(0).strip()

    # 출장지 — "출장지" 라벨 뒤의 값 그대로 (괄호 안 기관명 포함)
    place = _label_value(lines, _RX_LABEL_PLACE)
    if place:
        place = place[:80]  # 너무 길면 자름

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

    # 영수증 후보: "원" 표기가 있는 줄 우선, 없으면 천단위 콤마 숫자.
    # 거리(km)·TEL·사업자번호·카드 마스킹 줄은 제외.
    receipts: list[ReceiptExtraction] = []
    seen_amounts: dict[int, float] = {}  # 같은 금액은 가장 신뢰도 높은 것만 유지
    seen_pairs: set[tuple[int, str]] = set()  # 동일 라인의 같은 금액 중복 방지
    for t, conf in lines:
        low = t.lower()
        if "km" in low or "tel" in low:
            continue
        if _RX_BIZ_NO.search(t) or _RX_CARD_MASK.search(t):
            continue

        # 1) "…원" 패턴 — 더 신뢰도 높음
        matches = [(m.group(1), True) for m in _RX_AMOUNT.finditer(t)]
        # 2) 천단위 콤마 — "원" 키워드 없어도 영수증 후보
        if not matches:
            matches = [(m.group(1), False) for m in _RX_AMOUNT_KOMMA.finditer(t)]

        for raw, has_won in matches:
            try:
                amt = int(raw.replace(",", "").replace(".", ""))
            except ValueError:
                continue
            if not (500 <= amt <= 1_000_000):
                continue
            key = (amt, t)
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            # 같은 금액이 다른 라인에 반복되면 (예: KTX 영수증의 결제금액 = 총영수금액)
            # 첫 매치만 유지 (1장 = 1건)
            if amt in seen_amounts:
                continue
            seen_amounts[amt] = conf
            label = _RX_AMOUNT.sub("", t).strip(" :·-") if has_won else t.strip()
            label = re.sub(r"\d[\d,]*", "", label).strip(" :·-()[]")[:60]
            # 의미 있는 문자가 3자 미만이면 "영수증"으로 폴백 (한자/기호만 남는 경우)
            if len(re.sub(r"[\s:·\-—_·.]+", "", label)) < 3:
                label = "영수증"
            # 천단위 콤마만 매칭은 신뢰도 약간 낮춤
            receipt_conf = conf if has_won else conf * 0.85
            receipts.append(ReceiptExtraction(label, amt, receipt_conf))
        if len(receipts) >= 10:
            break

    # 신뢰도: 라인 평균 — 단, 잡힌 필드 수에 따라 가중
    avg_conf = sum(c for _, c in lines) / max(1, len(lines))
    field_hits = sum(bool(x) for x in (trip_date, distance_km, depart_time))
    overall = min(0.95, avg_conf * (0.5 + 0.15 * field_hits))

    return TripExtraction(
        traveler=traveler,
        place=place,
        trip_date=trip_date,
        depart_time=depart_time,
        return_time=return_time,
        distance_km=distance_km,
        receipts=receipts,
        confidence=overall,
    )
