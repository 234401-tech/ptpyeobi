"""GOT-OCR 2.0 어댑터 — 한국어 작은 폰트에 강한 SOTA 오픈소스 OCR.

모델: stepfun-ai/GOT-OCR2_0 (약 580M params, MIT/Apache-2.0)
설치: requirements-got.txt + PyTorch CUDA (회사 서버 NVIDIA A4500 등)

특징
- 한국어 / 한자 / 영문 / 수식 / 표 / 악보까지 통합 처리
- ocr_type='ocr'    → 단순 텍스트
- ocr_type='format' → 마크다운/LaTeX 형식 보존 (표/수식 유지)
- VRAM 약 6~8GB (FP16)

추출 결과는 GOT 모델 출력 텍스트를 줄 단위로 분해해
기존 local.py 의 정규식 파서(_parse)에 그대로 흘려 넣음.
이미 검증된 라벨/날짜/시간/거리/영수증 추출 로직 재사용.
"""

from __future__ import annotations

from pathlib import Path

from .base import OCRAdapter, TripExtraction
from .local import _parse

_MODEL = None
_TOKENIZER = None
_DEVICE = "cuda"
_MODEL_NAME = "stepfun-ai/GOT-OCR2_0"


def _load():
    """모델/토크나이저 lazy 로드. 첫 호출 시 HF 캐시에 자동 다운로드 (~1.5GB)."""
    global _MODEL, _TOKENIZER
    if _MODEL is not None:
        return _MODEL, _TOKENIZER

    try:
        from transformers import AutoModel, AutoTokenizer
    except ImportError as e:
        raise RuntimeError(
            "transformers 가 설치되지 않았습니다. "
            "회사 서버에서 'pip install -r requirements-got.txt' 와 "
            "PyTorch CUDA 버전을 설치하세요."
        ) from e

    _TOKENIZER = AutoTokenizer.from_pretrained(_MODEL_NAME, trust_remote_code=True)
    _MODEL = (
        AutoModel.from_pretrained(
            _MODEL_NAME,
            trust_remote_code=True,
            low_cpu_mem_usage=True,
            device_map=_DEVICE,
            use_safetensors=True,
            pad_token_id=_TOKENIZER.eos_token_id,
        )
        .eval()
        .to(_DEVICE)
    )
    return _MODEL, _TOKENIZER


class GotOCR(OCRAdapter):
    name = "got"

    def extract(self, file_path: str) -> TripExtraction:
        ext = Path(file_path).suffix.lower()
        if ext not in {".png", ".jpg", ".jpeg"}:
            raise RuntimeError(
                f"GOT-OCR 은 이미지만 지원 (입력: {ext}). "
                "PDF 는 페이지별 PNG 변환 후 호출하세요."
            )

        model, tokenizer = _load()
        # 'ocr' 은 단순 텍스트, 'format' 은 표/수식 마크다운 보존.
        # 영수증/명령서 같이 단순 문서엔 'ocr' 가 빠르고 충분.
        text: str = model.chat(tokenizer, file_path, ocr_type="ocr")

        # GOT 는 줄별 신뢰도를 제공하지 않으므로 0.9 고정.
        # 기존 _parse 는 신뢰도를 영수증 conf 와 평균 가중에만 씀.
        lines: list[tuple[str, float]] = [
            (line.strip(), 0.9) for line in text.splitlines() if line.strip()
        ]
        return _parse(lines)
