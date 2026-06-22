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

from ._image_split import cleanup, merge_extractions, split_if_composite
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
# 동승자 — "동 승 자", "동승인", "동승자명"
_RX_LABEL_COMPANIONS = re.compile(r"동\s*승\s*(?:자|인)\s*(?:명)?\s*[:：]?\s*(.+)")
# 한 인명 — "김승모" / "김 승 모" / "김 승 · 모" / "김.승.모"
# 한글 사이에 OCR 잡음(공백·가운데점·점·콤마·하이픈·슬래시)이 끼어도 한 이름으로 인식.
# 합친 결과에서 한글만 남기면 "김승모".
_RX_KOR_NAME_ONE = re.compile(r"[가-힣](?:[\s·•.,/\-]*[가-힣]){1,4}")

# 영수증 종류 분류용 키워드
# 대중교통 = 사용자가 자기 차로 안 갔다는 증거
PUBLIC_TRANSIT_KEYWORDS = (
    "KTX", "SRT", "ITX", "새마을", "무궁화", "누리로", "코레일", "기차", "열차", "승차권",
    "시외", "고속버스", "우등", "버스", "택시", "지하철", "메트로",
    "항공", "비행기", "대한항공", "아시아나", "제주항공", "진에어",
)
# 자가차량 = 자기 차로 갔다는 증거 (대중교통으로 추정하면 안 됨)
SELF_DRIVE_KEYWORDS = (
    # 통행료/하이패스
    "하이패스", "HiPass", "Hi-Pass", "톨게이트", "통행료",
    "한국도로공사", "도로공사", "고속도로", "민자고속도로", "영업소",
    # 주유 — 발행처/업종
    "주유소", "주유", "셀프주유", "휘발유", "경유", "유류대", "유류비",
    "S-OIL", "S-Oil", "에쓰오일", "GS칼텍스", "SK에너지", "현대오일뱅크",
    "알뜰주유", "오일뱅크",
    # 주차
    "주차", "주차장", "공영주차장",
)


# "○○영업소" / "○○주유소" 같은 발행지명 추출용
_RX_TOLL_PLAZA = re.compile(r"([가-힣A-Za-z0-9]{2,15}\s*영업소)")
_RX_GAS_STATION = re.compile(r"([가-힣A-Za-z0-9]{2,15}주유소)")
# 의미 없는 / 너무 짧은 라벨로 간주할 후보 (자동 라벨로 덮어씀)
_VAGUE_LABELS = {"", "영수증", "원", "공급가액", "부가세", "합계"}


def _enhance_toll_labels(receipts: list, blob: str) -> None:
    """영수증 라벨이 비거나 무의미한데 본문에 '통행료/하이패스' 신호가 있으면
    "통행료 (○○영업소)" 형태로 라벨을 덮어쓴다.

    주유 영수증도 같은 처리 — '○○주유소' / 'S-OIL' 등의 정보로 라벨 보강.
    """
    has_toll = any(kw in blob for kw in ("하이패스", "통행료", "한국도로공사", "톨게이트"))
    has_fuel = any(kw in blob for kw in ("주유", "휘발유", "경유", "S-OIL", "에쓰오일"))
    if not (has_toll or has_fuel):
        return

    plazas = _RX_TOLL_PLAZA.findall(blob)
    stations = _RX_GAS_STATION.findall(blob)

    for r in receipts:
        label_clean = r.label.strip(" :·-()[]")
        # 의미있는 라벨이 이미 있으면 그대로 둠
        if label_clean and label_clean not in _VAGUE_LABELS and len(label_clean) >= 3:
            continue

        if has_toll:
            if plazas:
                # 영업소 정보가 여러 개면 첫 두 개를 → 형태로 ("포항영업소 → 청통와촌영업소")
                first = re.sub(r"\s+", "", plazas[0])
                if len(plazas) >= 2:
                    second = re.sub(r"\s+", "", plazas[1])
                    r.label = f"통행료 ({first} → {second})"
                else:
                    r.label = f"통행료 ({first})"
            else:
                r.label = "통행료"
        elif has_fuel:
            if stations:
                r.label = f"유류대 ({stations[0]})"
            elif "S-OIL" in blob.upper():
                r.label = "유류대 (S-OIL)"
            else:
                r.label = "유류대"


def _classify_receipts(receipts_text: str) -> str | None:
    """영수증 라벨/원문에서 키워드 매칭해서 mode 추정.

    반환:
      "public_transit" — 대중교통 키워드만 있거나 우세
      "self_drive"     — 자가차량 키워드만 있거나 우세
      None             — 단서 없음 (호출자가 거리 등 다른 단서로 판단)
    """
    if not receipts_text:
        return None
    text = receipts_text.upper()
    public_hits = sum(1 for kw in PUBLIC_TRANSIT_KEYWORDS if kw.upper() in text)
    self_hits = sum(1 for kw in SELF_DRIVE_KEYWORDS if kw.upper() in text)
    if public_hits == 0 and self_hits == 0:
        return None
    if self_hits > public_hits:
        return "self_drive"
    if public_hits > 0:
        return "public_transit"
    return None


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

        # 좌우 합친 영수증이면 분할해서 각각 OCR → 머지
        parts = split_if_composite(file_path)
        try:
            results = [self._extract_one(p) for p in parts]
            return merge_extractions(results)
        finally:
            cleanup(parts, file_path)

    def _extract_one(self, file_path: str) -> TripExtraction:
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

        return parse_lines(lines)


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


def parse_lines(lines: list[tuple[str, float]]) -> TripExtraction:
    """OCR 어댑터 공용 파서 — (text, confidence) 줄 리스트를 받아 TripExtraction 반환.

    upstage / claude_vision 같은 다른 어댑터도 같은 정규식·키워드 로직 재사용 가능.
    """
    blob = "\n".join(t for t, _ in lines)

    # 출장자 — "출장자" 라벨 뒤에서 인명 1명 추출.
    # 한글 사이의 잡음(공백/점/중점/콤마/하이픈) 모두 제거하고 한글만 남김.
    def _clean_name(s: str) -> str:
        return re.sub(r"[^가-힣]", "", s)

    traveler = None
    raw = _label_value(lines, _RX_LABEL_TRAVELER)
    if raw:
        m = _RX_KOR_NAME_ONE.search(raw)
        if m:
            traveler = _clean_name(m.group(0))

    # 동승자 — 콤마/공백 구분된 여러 명 추출
    companion_names: list[str] = []
    raw_comp = _label_value(lines, _RX_LABEL_COMPANIONS)
    if raw_comp:
        for m in _RX_KOR_NAME_ONE.finditer(raw_comp):
            name = _clean_name(m.group(0))
            if name and name != traveler:
                companion_names.append(name)

    # 출장지 — "출장지" 라벨 뒤의 값. OCR 이 표 경계선을 화살표(←~⇿) 나
    # 닫는 인용부호(』」)로 잘못 잡는 경우가 있어 잡음 문자는 제거.
    place = _label_value(lines, _RX_LABEL_PLACE)
    if place:
        place = re.sub(r"[←-⇿」』]+", "", place).strip()
        place = place.strip(" :：·-")[:80]

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
    #
    # dedup 전략: 같은 금액이 한 영수증 안에서 "결제금액"+"총 영수 금액" 처럼
    # 두 번 나오는 건 1건으로 묶고, 다른 영수증(라인이 멀리 떨어진 동일 금액)은
    # 별개로 보존한다. 왕복 KTX 같이 두 장이 동일 가격일 때 합쳐지지 않도록.
    NEAR_LINE_GAP = 6  # 같은 영수증으로 간주할 라인 거리
    receipts: list[ReceiptExtraction] = []
    last_idx_by_amt: dict[int, int] = {}  # 금액 → 마지막으로 본 라인 인덱스
    # 한 라인 안에서 같은 금액이 두 번 정규식 매칭되는 케이스만 막음 (라인 위치 포함).
    seen_per_line: set[tuple[int, int]] = set()
    for idx, (t, conf) in enumerate(lines):
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
            per_line_key = (idx, amt)
            if per_line_key in seen_per_line:
                continue
            seen_per_line.add(per_line_key)
            # 같은 금액이 최근에 본 라인(같은 영수증) 안에서 또 나오면 스킵.
            # 멀리 떨어진 라인이면 새 영수증으로 등록.
            prev_idx = last_idx_by_amt.get(amt)
            if prev_idx is not None and idx - prev_idx <= NEAR_LINE_GAP:
                last_idx_by_amt[amt] = idx  # 최신 위치로 갱신
                continue
            last_idx_by_amt[amt] = idx
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

    # 모드 자동 추정: 영수증 텍스트의 키워드로 분류.
    # 강한 신호(KTX/하이패스/주유/한국도로공사 등)가 있을 때만 모드를 제안.
    # 카페·식당 등 중립 영수증은 어떤 교통수단에서도 발생할 수 있으므로
    # 단서 없으면 None 을 반환해 사용자의 토글 선택을 유지한다.
    receipts_blob = " ".join(r.label for r in receipts) + "\n" + blob
    mode_suggested = _classify_receipts(receipts_blob)

    # 영수증 라벨 자동 보강 — 하이패스/통행료 영수증은 라벨이 빈/무의미로 잡힌다.
    # 본문에서 영업소·발행기관 정보를 찾아 "통행료 (○○영업소)" 형태로 채움.
    _enhance_toll_labels(receipts, blob)

    return TripExtraction(
        traveler=traveler,
        place=place,
        trip_date=trip_date,
        depart_time=depart_time,
        return_time=return_time,
        distance_km=distance_km,
        mode_suggested=mode_suggested,
        receipts=receipts,
        companion_names=companion_names,
        confidence=overall,
    )
