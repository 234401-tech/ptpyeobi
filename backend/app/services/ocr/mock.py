"""개발용 mock OCR. 디자인 미리보기의 CURRENT 와 동일한 값을 반환."""

from datetime import date

from .base import OCRAdapter, ReceiptExtraction, TripExtraction


class MockOCR(OCRAdapter):
    name = "mock"

    def extract(self, file_path: str) -> TripExtraction:
        return TripExtraction(
            traveler="김승모",
            dept="AI융합산업팀",
            trip_date=date(2026, 5, 21),
            depart_time="14:00",
            return_time="17:00",
            place="대구(테이큰소프트)",
            distance_km=139,
            mode_suggested="self_drive",
            receipts=[
                ReceiptExtraction("KTX 포항→서울 (예시)", 53_600, 0.94),
                ReceiptExtraction("KTX 서울→포항 (예시)", 53_900, 0.94),
            ],
            confidence=0.96,
        )
