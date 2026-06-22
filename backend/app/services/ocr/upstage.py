"""Upstage Document AI 어댑터 (한국어 영수증·문서 인식이 강함).

Upstage OCR API:
  POST https://api.upstage.ai/v1/document-ai/ocr
  - multipart form: document (파일)
  - response.pages[].text  (페이지별 인식 텍스트)
  - response.pages[].confidence (페이지 신뢰도)

추출된 텍스트를 줄 단위로 쪼개 local.py 의 parse_lines() 에 그대로 넘김.
→ 키워드 기반 모드 분류(KTX/하이패스 등), 날짜·시간·거리·영수증 추출 로직 공통.
"""

from __future__ import annotations

import time

import httpx

from app import settings_store

from ._image_split import cleanup, enhance_for_ocr, merge_extractions, split_if_composite
from .base import OCRAdapter, TripExtraction
from .local import parse_lines

UPSTAGE_URL = "https://api.upstage.ai/v1/document-ai/ocr"
# 무료 티어 rate limit (분당 요청 수 제한) 대응 — 429 받으면 짧게 기다렸다 재시도
_RETRY_DELAYS = (3, 8, 20)  # 초


class UpstageOCR(OCRAdapter):
    name = "upstage"

    def extract(self, file_path: str) -> TripExtraction:
        if not settings_store.get("upstage_api_key"):
            raise RuntimeError("UPSTAGE_API_KEY 미설정 — backend/.env 에 키 추가 후 서버 재시작")

        # 좌우 합친 영수증이면 분할해서 각 부분 OCR → 결과 머지
        parts = split_if_composite(file_path)
        try:
            results = [self._extract_one(p) for p in parts]
            return merge_extractions(results)
        finally:
            cleanup(parts, file_path)

    def _extract_one(self, file_path: str) -> TripExtraction:
        # 톨게이트·하이패스 같은 작은 영수증의 미세 글자 인식률을 위해 1500px 업스케일
        enhanced = enhance_for_ocr(file_path)
        try:
            return self._call_api(enhanced)
        finally:
            if enhanced != file_path:
                from pathlib import Path
                Path(enhanced).unlink(missing_ok=True)

    def _call_api(self, file_path: str) -> TripExtraction:
        headers = {"Authorization": f"Bearer {settings_store.get("upstage_api_key")}"}
        last_err = ""
        for delay in (0,) + _RETRY_DELAYS:
            if delay:
                time.sleep(delay)
            with open(file_path, "rb") as f:
                files = {"document": (file_path, f)}
                resp = httpx.post(UPSTAGE_URL, headers=headers, files=files, timeout=60)
            if resp.status_code == 200:
                return _to_extraction(resp.json())
            last_err = f"[{resp.status_code}] {resp.text[:200]}"
            # rate limit 만 재시도, 다른 에러는 즉시 전파
            if resp.status_code != 429:
                break
        raise RuntimeError(f"Upstage OCR 호출 실패: {last_err}")


def _to_extraction(data: dict) -> TripExtraction:
    """Upstage OCR 응답 → TripExtraction. parse_lines() 가 모든 휴리스틱 담당."""
    # 페이지별 텍스트 결합
    text_chunks: list[str] = []
    page_confs: list[float] = []
    for page in data.get("pages", []):
        if t := page.get("text"):
            text_chunks.append(t)
        # 페이지 conf 키는 모델에 따라 다를 수 있음 — best effort
        for key in ("confidence", "ocr_confidence", "score"):
            if key in page:
                try:
                    page_confs.append(float(page[key]))
                except (TypeError, ValueError):
                    pass
                break

    # pages 가 비었으면 응답 루트의 text 시도 (구버전 응답 호환)
    if not text_chunks and isinstance(data.get("text"), str):
        text_chunks.append(data["text"])

    full_text = "\n".join(text_chunks)
    avg_conf = sum(page_confs) / len(page_confs) if page_confs else 0.9

    # (text, confidence) 튜플 리스트로 변환 — parse_lines 가 이 형식 요구
    lines: list[tuple[str, float]] = [
        (line.strip(), avg_conf) for line in full_text.splitlines() if line.strip()
    ]
    return parse_lines(lines)
