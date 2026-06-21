"""좌우로 붙은 영수증 한 장 이미지를 자동 감지·분할.

배경: 사용자가 두 장의 톨게이트/하이패스 영수증을 한 이미지에 좌우로 합쳐서
업로드하면 OCR이 두 영수증의 같은 행을 한 줄로 합쳐 인식한다.
→ 이미지를 좌우로 자동 분할해 각각 OCR 한 뒤 결과를 머지하면 라벨/날짜/금액이
   섞이지 않는다.

휴리스틱:
  1) 가로 비율이 세로보다 크면 (width > height) — 영수증은 보통 세로형 → 합성 의심
  2) 가운데 ±15% 컬럼 구간에 "거의 흰색"이 N행 이상 이어지는 수직 공백이 있으면
     그 위치에서 좌우 분할 (정확한 분할선)
  3) 가운데 공백을 못 찾았지만 비율이 명백히 가로형이면 정확히 중앙에서 자름

반환: 분할 안 했으면 [원본 경로], 분할했으면 [좌, 우] 임시 경로 (호출자가 정리).
"""

from __future__ import annotations

import tempfile
from pathlib import Path


def split_if_composite(file_path: str) -> list[str]:
    """합성 영수증 감지 시 좌우 분할. 분할 안 했으면 [원본]만 반환."""
    try:
        from PIL import Image
    except ImportError:
        return [file_path]

    try:
        img = Image.open(file_path)
    except Exception:
        return [file_path]

    w, h = img.size
    # 영수증은 보통 세로형. 가로형이면 합성 의심.
    if w < h * 1.1:
        return [file_path]

    gray = img.convert("L")
    pixels = gray.load()

    # 컬럼별 평균 밝기 계산 — 행 샘플링으로 성능 확보 (전체 행의 1/8 만)
    step_y = max(1, h // 200)
    col_means = []
    for x in range(w):
        s = cnt = 0
        for y in range(0, h, step_y):
            s += pixels[x, y]
            cnt += 1
        col_means.append(s / max(1, cnt))

    # 가운데 ±15% 영역에서 가장 밝은(연속된 흰) 구간 찾기
    mid = w // 2
    band = max(10, w // 7)
    lo = max(0, mid - band)
    hi = min(w, mid + band)
    # "거의 흰색" 기준 (대부분 영수증은 흰 배경 + 검은 텍스트)
    WHITE_TH = 235.0

    best_start, best_len = -1, 0
    cur_start, cur_len = -1, 0
    for x in range(lo, hi):
        if col_means[x] >= WHITE_TH:
            if cur_start < 0:
                cur_start = x
            cur_len += 1
            if cur_len > best_len:
                best_start, best_len = cur_start, cur_len
        else:
            cur_start, cur_len = -1, 0

    # 가운데 공백 구간이 충분히 길면 거기서 분할 (구간 중앙)
    if best_len >= max(8, w // 80):
        cut = best_start + best_len // 2
    else:
        # 공백은 못 찾았지만 비율이 너무 가로형이면 강제로 중앙 분할
        if w >= h * 1.4:
            cut = mid
        else:
            return [file_path]

    left = img.crop((0, 0, cut, h))
    right = img.crop((cut, 0, w, h))

    suffix = Path(file_path).suffix.lower() or ".png"
    tmp_l = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp_l.close()
    tmp_r = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp_r.close()

    # PNG 로 저장하면 lossless. JPG 도 그대로 변환 가능.
    save_format = "PNG" if suffix in (".png",) else "JPEG"
    left.save(tmp_l.name, save_format)
    right.save(tmp_r.name, save_format)

    return [tmp_l.name, tmp_r.name]


def merge_extractions(parts: list):
    """분할된 이미지 N장의 TripExtraction 들을 한 건으로 합침.

    - 출장자/지/일시/거리: 먼저 잡힌 값 우선 (None 아닌 것)
    - 영수증: 합치되 동일 금액 중복 제거 (라벨이 비어있으면 비어있지 않은 쪽 우선)
    - mode_suggested: public_transit > self_drive > None 우선순위
    - confidence: 평균
    """
    if not parts:
        from .base import TripExtraction
        return TripExtraction()
    if len(parts) == 1:
        return parts[0]

    from .base import TripExtraction

    def first(attr):
        for p in parts:
            v = getattr(p, attr)
            if v:
                return v
        return None

    # 영수증 머지 — 동일 금액은 라벨 더 긴 쪽 유지
    merged_receipts: dict[int, object] = {}
    for p in parts:
        for r in p.receipts:
            existing = merged_receipts.get(r.amount)
            if not existing or len(r.label) > len(existing.label):
                merged_receipts[r.amount] = r

    # 모드 우선순위
    modes = [p.mode_suggested for p in parts if p.mode_suggested]
    if "public_transit" in modes:
        mode = "public_transit"
    elif "self_drive" in modes:
        mode = "self_drive"
    else:
        mode = None

    # 동승자 — 합집합
    names: list[str] = []
    for p in parts:
        for n in p.companion_names:
            if n not in names:
                names.append(n)

    confs = [p.confidence for p in parts if p.confidence is not None]

    return TripExtraction(
        traveler=first("traveler"),
        dept=first("dept"),
        trip_date=first("trip_date"),
        depart_time=first("depart_time"),
        return_time=first("return_time"),
        place=first("place"),
        distance_km=first("distance_km"),
        mode_suggested=mode,
        receipts=list(merged_receipts.values()),
        companion_names=names,
        confidence=sum(confs) / len(confs) if confs else None,
    )


def cleanup(paths: list[str], original: str) -> None:
    """임시 파일 정리 (원본은 건드리지 않음)."""
    for p in paths:
        if p != original:
            Path(p).unlink(missing_ok=True)


def enhance_for_ocr(file_path: str, target_min_width: int = 1500) -> str:
    """OCR 인식률 개선용 전처리 — 업스케일 + 콘트라스트/샤프니스 강화.

    톨게이트·하이패스 같은 작은 영수증 이미지는 너비가 600~800px 수준이라
    Upstage 같은 클라우드 OCR도 작은 한글 글자를 놓친다. 1500px 이상으로 키우고
    콘트라스트 1.4배·샤프니스 1.3배를 적용하면 미세한 글자 인식이 크게 좋아진다.

    원본은 건드리지 않고 임시 파일에 저장 후 경로 반환. PIL 미설치 시 원본 그대로 반환.
    """
    try:
        from PIL import Image, ImageEnhance
    except ImportError:
        return file_path

    try:
        img = Image.open(file_path)
    except Exception:
        return file_path

    if img.mode not in ("L", "RGB"):
        img = img.convert("RGB")

    # 너비가 이미 충분히 크면 콘트라스트만 살짝 강화하고 끝
    if img.width >= target_min_width:
        img = ImageEnhance.Contrast(img).enhance(1.2)
    else:
        scale = max(2, target_min_width // max(1, img.width) + 1)
        img = img.resize((img.width * scale, img.height * scale), Image.LANCZOS)
        img = ImageEnhance.Contrast(img).enhance(1.4)
        img = ImageEnhance.Sharpness(img).enhance(1.3)

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp.close()
    img.save(tmp.name, "PNG")
    return tmp.name
