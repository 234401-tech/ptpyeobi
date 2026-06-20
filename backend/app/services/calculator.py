"""여비정산 계산 — 순수 함수.

여비지급규정 v2025.06.24 별표1 기준.
프론트엔드 `lib/compute.js`와 **동일 결과를 보장**해야 함 (회귀 테스트 필수).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

# ────────────────────────────── 규정 상수 ──────────────────────────────

PER_DIEM_DAILY = 25_000  # 1일 일비
FUEL_EFFICIENCY = 11.97  # 유류비 공식 분모 (km당 연비 환산 계수)

# 식수별 식비 단가표 (1일 기본 3식)
MEAL_TABLE = {0: 0, 1: 8_330, 2: 16_670, 3: 25_000, 4: 33_330, 5: 41_670}

# 숙박비 지역별 1박 상한
REGION_RATES = {"seoul": 100_000, "metro": 80_000, "other": 70_000}
REGION_LABELS = {"seoul": "서울특별시", "metro": "광역시", "other": "그 밖의 지역"}

# 일비 50% 적용 모드 (동승 · 공용차량)
HALF_PER_DIEM_MODES = {"self_passenger", "company_car"}

# 사업명 → 회계시스템 매핑
FUND_SYSTEM_MAP = {
    "재단운영비": "통장",
    "초거대AI 클라우드팜": "e나라",
    "신재생 융복합": "RCMS",
    "동해안방사능": "보탬e",
    "에너지 행사지원": "지방비",
}


# ────────────────────────────── 단위 함수 ──────────────────────────────


def meal_amount(n: int) -> int:
    """식수 n에 대한 식비. 5식 초과는 41,670 + (n−5)×8,333."""
    if n <= 0:
        return 0
    if n in MEAL_TABLE:
        return MEAL_TABLE[n]
    return 41_670 + round((n - 5) * 8_333)


def fuel_cost(distance_km: float, fuel_price: int) -> int:
    """유류비 = 거리 × 유가 ÷ 11.97 → 10원 단위 절사."""
    if not distance_km or not fuel_price:
        return 0
    raw = distance_km * fuel_price / FUEL_EFFICIENCY
    return int(math.floor(raw / 10) * 10)


# ────────────────────────────── 정산 결과 ──────────────────────────────


@dataclass
class CalcResult:
    fuel_cost: int
    toll_sum: int
    public_cost: int
    meal_cost: int
    per_diem: int
    lodge_cost: int
    total: int
    breakdown: dict = field(default_factory=dict)
    rules_applied: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "fuel_cost": self.fuel_cost,
            "toll_sum": self.toll_sum,
            "public_cost": self.public_cost,
            "meal_cost": self.meal_cost,
            "per_diem": self.per_diem,
            "lodge_cost": self.lodge_cost,
            "total": self.total,
            "breakdown": self.breakdown,
            "rules_applied": self.rules_applied,
        }


def _receipt_amount(r) -> int:
    """영수증이 dict({amount}) 또는 숫자로 들어와도 금액을 추출."""
    if isinstance(r, dict):
        return int(r.get("amount") or 0)
    return int(r or 0)


def calculate(
    *,
    mode: str,
    days: int = 1,
    distance_km: float = 0,
    fuel_price: int = 0,
    nights: int = 0,
    region: str = "other",
    meals_provided: int = 0,
    public_receipts: list | None = None,
    toll_sum: int = 0,
) -> CalcResult:
    """여비 정산 합계 계산.

    프론트 compute()와 동일 로직:
      - 유류비/톨게이트: self_drive 일 때만
      - 대중교통비: public_transit 일 때만 (영수증 실비 합계)
      - 일비: self_passenger/company_car 는 50%
      - 식비: 기본 days×3식 − 제공받음
      - 숙박비: nights × 지역 상한
    """
    public_receipts = public_receipts or []
    is_driver = mode == "self_drive"
    is_public = mode == "public_transit"
    half = mode in HALF_PER_DIEM_MODES

    if region not in REGION_RATES:
        region = "other"

    fuel = fuel_cost(distance_km, fuel_price) if is_driver else 0
    toll = int(toll_sum) if is_driver else 0
    public = (
        sum(_receipt_amount(r) for r in public_receipts) if is_public else 0
    )

    billed_meals = max(0, days * 3 - meals_provided)
    meal = meal_amount(billed_meals)

    per_diem_full = PER_DIEM_DAILY * days
    per_diem = round(per_diem_full / 2) if half else per_diem_full

    lodge = nights * REGION_RATES[region]

    total = fuel + toll + public + meal + per_diem + lodge

    # ── 적용 규정 설명 (디버깅·감사 추적용) ──
    rules: list[str] = []
    if is_driver:
        rules.append(
            f"유류비: {distance_km:g}km × {fuel_price:,}원/L ÷ {FUEL_EFFICIENCY} "
            f"= {fuel:,} (10원 절사)"
        )
        if toll:
            rules.append(f"톨게이트: 하이패스 영수증 합계 = {toll:,}")
    elif is_public:
        rules.append(f"대중교통비: 영수증 {len(public_receipts)}건 실비 합계 = {public:,}")
    rules.append(
        f"식비: 기본 {days * 3}식 − 제공 {meals_provided}식 = {billed_meals}식 → {meal:,}"
    )
    if half:
        reason = "동승" if mode == "self_passenger" else "공용차량"
        rules.append(
            f"일비: {PER_DIEM_DAILY:,} × {days}일 × 50% ({reason}) = {per_diem:,}"
        )
    else:
        rules.append(f"일비: {PER_DIEM_DAILY:,} × {days}일 = {per_diem:,}")
    if nights > 0:
        rules.append(
            f"숙박비: {REGION_LABELS[region]} {REGION_RATES[region]:,}원 × {nights}박 "
            f"= {lodge:,}"
        )

    breakdown = {
        "is_driver": is_driver,
        "is_public": is_public,
        "half_per_diem": half,
        "billed_meals": billed_meals,
        "days": days,
        "region": region,
        "region_label": REGION_LABELS[region],
        "region_rate": REGION_RATES[region],
    }

    return CalcResult(
        fuel_cost=fuel,
        toll_sum=toll,
        public_cost=public,
        meal_cost=meal,
        per_diem=per_diem,
        lodge_cost=lodge,
        total=total,
        breakdown=breakdown,
        rules_applied=rules,
    )
