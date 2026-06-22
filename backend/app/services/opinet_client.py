"""오파넷(한국석유공사) 보통휘발유 일자별 평균가 클라이언트.

오파넷의 일자별 평균가 엔드포인트는 `avgRecentPrice.do` (최근 7일치 일괄 반환).
단일 일자만 받는 엔드포인트는 사실상 "현재 평균"만 주므로 사용 부적합.

응답 예:
  { "RESULT": { "OIL": [
       { "DATE": "20260620", "PRICE": "2058.32" },
       { "DATE": "20260619", "PRICE": "2059.10" },
       ...
  ] } }
"""

from __future__ import annotations

from datetime import date, datetime

import httpx

from app import settings_store
from app.config import settings

OPINET_RECENT = "https://www.opinet.co.kr/api/avgRecentPrice.do"
WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]


class OpinetNotConfigured(RuntimeError):
    pass


class OpinetError(RuntimeError):
    pass


def weekday_ko(d: date) -> str:
    return WEEKDAY_KO[d.weekday()]


async def fetch_recent_prices() -> dict[date, int]:
    """최근 7일치 보통휘발유 평균가를 {date: 원/L 정수}로 반환."""
    api_key = settings_store.get("opinet_api_key")
    if not api_key:
        raise OpinetNotConfigured("OPINET_API_KEY 미설정")

    params = {
        "code": api_key,
        "out": "json",
        "prodcd": settings.opinet_prodcd,  # B027 = 자동차용 보통휘발유
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(OPINET_RECENT, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise OpinetError(f"오파넷 호출 실패: {e}") from e

        try:
            data = resp.json()
        except ValueError as e:
            raise OpinetError(f"오파넷 응답 JSON 파싱 실패: {resp.text[:200]}") from e

    try:
        oil = data["RESULT"]["OIL"]
    except (KeyError, TypeError) as e:
        raise OpinetError(f"오파넷 응답 구조 이상: {data}") from e

    out: dict[date, int] = {}
    for row in oil:
        try:
            d = datetime.strptime(str(row["DATE"]), "%Y%m%d").date()
            price = int(round(float(row["PRICE"])))
        except (KeyError, ValueError):
            continue
        out[d] = price
    return out


async def fetch_price(d: date) -> int:
    """단일 날짜의 평균가. 오파넷이 7일치만 주므로 그 범위 밖이면 OpinetError."""
    prices = await fetch_recent_prices()
    if d not in prices:
        raise OpinetError(
            f"오파넷에서 {d} 데이터를 받지 못함 "
            f"(보유 범위: {min(prices)}~{max(prices)})"
            if prices else f"오파넷 응답 비어 있음"
        )
    return prices[d]
