"""Claude Vision (Anthropic API) 멀티모달 어댑터.

PDF 1페이지/이미지를 base64로 보내, JSON 스키마로 구조화 추출을 요청.
"""

from __future__ import annotations

import base64
import json
from datetime import date
from pathlib import Path

import httpx

from app.config import settings

from .base import OCRAdapter, ReceiptExtraction, TripExtraction

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-6"

PROMPT = """첨부된 출장 증빙서류에서 다음 정보를 JSON으로 추출해줘.
모르는 필드는 null. 절대 추측 금지. 영수증은 실제로 보이는 것만.

{
  "traveler": "출장자 이름",
  "dept": "부서",
  "trip_date": "YYYY-MM-DD",
  "depart_time": "HH:MM",
  "return_time": "HH:MM",
  "place": "출장지(괄호 안에 방문기관)",
  "distance_km": 숫자,
  "mode_suggested": "self_drive|self_passenger|company_car|public_transit",
  "receipts": [{"label":"…","amount":숫자}, …],
  "confidence": 0~1
}
JSON 객체만 출력. 코드블록 없이."""


_MEDIA = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}


class ClaudeVisionOCR(OCRAdapter):
    name = "claude_vision"

    def extract(self, file_path: str) -> TripExtraction:
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY 미설정")

        ext = Path(file_path).suffix.lower()
        media = _MEDIA.get(ext)
        if not media:
            raise RuntimeError(f"지원하지 않는 형식: {ext}")

        with open(file_path, "rb") as f:
            b64 = base64.standard_b64encode(f.read()).decode()

        block_type = "document" if media == "application/pdf" else "image"
        body = {
            "model": MODEL,
            "max_tokens": 2048,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": block_type,
                            "source": {"type": "base64", "media_type": media, "data": b64},
                        },
                        {"type": "text", "text": PROMPT},
                    ],
                }
            ],
        }
        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        resp = httpx.post(ANTHROPIC_URL, headers=headers, json=body, timeout=60)
        resp.raise_for_status()
        text = resp.json()["content"][0]["text"].strip()
        return _parse_json(text)


def _parse_json(text: str) -> TripExtraction:
    # Claude가 가끔 ```json 으로 감싸므로 안전 처리
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0]
    data = json.loads(text.strip())

    td = None
    if data.get("trip_date"):
        try:
            y, m, d = data["trip_date"].split("-")
            td = date(int(y), int(m), int(d))
        except Exception:
            td = None

    receipts = [
        ReceiptExtraction(r.get("label", ""), int(r.get("amount", 0)), 0.85)
        for r in (data.get("receipts") or [])
        if r.get("amount")
    ]

    return TripExtraction(
        traveler=data.get("traveler"),
        dept=data.get("dept"),
        trip_date=td,
        depart_time=data.get("depart_time"),
        return_time=data.get("return_time"),
        place=data.get("place"),
        distance_km=data.get("distance_km"),
        mode_suggested=data.get("mode_suggested"),
        receipts=receipts,
        confidence=data.get("confidence") or 0.85,
    )
