"""개발용 mock OCR.

파일명/경로에 키워드가 들어가 있으면 그에 맞춘 시나리오를 돌려준다.
실제 OCR 없이 프론트엔드 토글/머지 로직을 검증할 때 쓴다.
실제 추출이 필요하면 OCR_PROVIDER=local 로 전환.
"""

from datetime import date
from pathlib import Path

from .base import OCRAdapter, ReceiptExtraction, TripExtraction

_PUBLIC_KW = ("ktx", "srt", "기차", "열차", "버스", "택시", "코레일", "항공", "비행기")
_SELF_KW = ("하이패스", "hipass", "hi-pass", "톨게이트", "통행료", "주유", "주차")


class MockOCR(OCRAdapter):
    name = "mock"

    def extract(self, file_path: str) -> TripExtraction:
        name = Path(file_path).name.lower()

        # 파일명에 대중교통 키워드 → KTX 영수증 시나리오
        if any(k in name for k in _PUBLIC_KW):
            return TripExtraction(
                traveler="김승모",
                dept="AI융합산업팀",
                trip_date=date(2026, 4, 9),
                depart_time="09:00",
                return_time="18:00",
                place="서울(한국지능정보사회진흥원 서울사무소)",
                distance_km=None,
                mode_suggested="public_transit",
                receipts=[
                    ReceiptExtraction("KTX 포항→서울", 53_600, 0.94),
                    ReceiptExtraction("KTX 서울→포항", 53_900, 0.94),
                ],
                confidence=0.92,
            )

        # 파일명에 자가차량 키워드 → 하이패스/주유 시나리오
        if any(k in name for k in _SELF_KW):
            return TripExtraction(
                traveler="김승모",
                dept="AI융합산업팀",
                trip_date=date(2026, 4, 9),
                depart_time="09:00",
                return_time="18:00",
                place="서울(한국지능정보사회진흥원 서울사무소)",
                distance_km=139,
                mode_suggested="self_drive",
                receipts=[
                    ReceiptExtraction("하이패스 통행료", 11_200, 0.93),
                ],
                confidence=0.90,
            )

        # 기본 — 자가차량 출장 (디자인 미리보기와 동일)
        return TripExtraction(
            traveler="김승모",
            dept="AI융합산업팀",
            trip_date=date(2026, 5, 21),
            depart_time="14:00",
            return_time="17:00",
            place="대구(테이큰소프트)",
            distance_km=139,
            mode_suggested="self_drive",
            receipts=[],
            confidence=0.96,
        )
