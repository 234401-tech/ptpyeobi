"""Surya OCR 어댑터 — 작은 한글에 강한 오픈소스 OCR.

Repo:    https://github.com/VikParuchuri/surya
라이선스: 코드 GPL-3.0 / 모델 CC-BY-NC-SA 4.0 (비영리 사용)
설치:    requirements-surya.txt + PyTorch (CPU 또는 CUDA)
모델:    첫 호출 시 HuggingFace 캐시에 자동 다운로드 (~1GB)

특징
- 한국어 작은 폰트 인식률 매우 높음 (라벨 + 값 페어 모두 잡음)
- CPU 에서도 동작 (느림, ~5~15s/페이지). GPU 사용 시 1~3s/페이지
- 라인 단위 텍스트 + bbox + confidence 반환
"""

from __future__ import annotations

from pathlib import Path

from .base import OCRAdapter, TripExtraction
from .local import _parse

_DET = None
_REC = None


def _load():
    """모델 lazy 로드. 첫 호출 시 ~1GB 다운로드 (~/.cache/huggingface)."""
    global _DET, _REC
    if _REC is not None:
        return _DET, _REC

    try:
        from surya.detection import DetectionPredictor
        from surya.recognition import RecognitionPredictor
    except ImportError as e:
        raise RuntimeError(
            "surya-ocr 가 설치되지 않았습니다. "
            "'pip install -r requirements-surya.txt' 와 PyTorch 를 설치하세요."
        ) from e

    _DET = DetectionPredictor()
    _REC = RecognitionPredictor()
    return _DET, _REC


class SuryaOCR(OCRAdapter):
    name = "surya"

    def extract(self, file_path: str) -> TripExtraction:
        ext = Path(file_path).suffix.lower()
        if ext not in {".png", ".jpg", ".jpeg"}:
            raise RuntimeError(
                f"Surya OCR 은 이미지만 지원 (입력: {ext}). "
                "PDF 는 페이지별 PNG 변환 후 호출하세요."
            )

        from PIL import Image

        det, rec = _load()
        image = Image.open(file_path)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        # Surya API: rec([image], [langs_per_image], det)
        results = rec([image], [["ko", "en"]], det)
        if not results:
            return TripExtraction(confidence=0.0)

        ocr_result = results[0]
        lines: list[tuple[str, float]] = []
        for line in ocr_result.text_lines:
            text = (line.text or "").strip()
            if not text:
                continue
            conf = float(getattr(line, "confidence", 0.9) or 0.9)
            lines.append((text, conf))

        return _parse(lines)
