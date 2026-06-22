"""OCR_PROVIDER 환경변수 기준으로 어댑터 인스턴스 반환.

provider 변경 시 캐시 클리어를 위해 settings_store.invalidate() 후
get_ocr.cache_clear() 를 호출하면 다음 호출에서 새 어댑터 반환.
"""

from functools import lru_cache

from app import settings_store

from .base import OCRAdapter


@lru_cache(maxsize=1)
def get_ocr() -> OCRAdapter:
    name = (settings_store.get("ocr_provider") or "mock").lower()
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
    if name == "surya":
        from .surya import SuryaOCR

        return SuryaOCR()
    raise RuntimeError(f"지원하지 않는 OCR_PROVIDER: {name}")
