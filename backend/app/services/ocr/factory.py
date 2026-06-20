"""OCR_PROVIDER 환경변수 기준으로 어댑터 인스턴스 반환."""

from functools import lru_cache

from app.config import settings

from .base import OCRAdapter


@lru_cache(maxsize=1)
def get_ocr() -> OCRAdapter:
    name = (settings.ocr_provider or "mock").lower()
    if name == "mock":
        from .mock import MockOCR

        return MockOCR()
    if name == "upstage":
        from .upstage import UpstageOCR

        return UpstageOCR()
    if name == "claude_vision":
        from .claude_vision import ClaudeVisionOCR

        return ClaudeVisionOCR()
    if name == "local":
        from .local import LocalOCR

        return LocalOCR()
    if name == "got":
        from .got import GotOCR

        return GotOCR()
    raise RuntimeError(f"지원하지 않는 OCR_PROVIDER: {name}")
