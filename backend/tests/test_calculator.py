"""정산 계산기 단위 테스트.

README 검수 체크리스트 + 디자인 미리보기 compute()와 동일 결과 확인.
프론트 lib/compute.js 는 동일 케이스를 두어 회귀를 방지한다.
"""

import pytest

from app.services.calculator import (
    calculate,
    fuel_cost,
    meal_amount,
)


# ────────────────────────── 식비 단가표 ──────────────────────────


@pytest.mark.parametrize(
    "n,expected",
    [
        (0, 0),
        (1, 8_330),
        (2, 16_670),
        (3, 25_000),
        (4, 33_330),
        (5, 41_670),
        (6, 41_670 + 8_333),  # 5식 초과
        (7, 41_670 + 2 * 8_333),
    ],
)
def test_meal_amount(n, expected):
    assert meal_amount(n) == expected


def test_meal_amount_negative_is_zero():
    assert meal_amount(-1) == 0


# ────────────────────────── 유류비 (10원 절사) ──────────────────────────


def test_fuel_cost_design_case():
    # 139km × 2063원/L ÷ 11.97 = 23,956.3 → 23,950 (10원 절사)
    assert fuel_cost(139, 2063) == 23_950


def test_fuel_cost_zero_inputs():
    assert fuel_cost(0, 2063) == 0
    assert fuel_cost(139, 0) == 0


# ────────────────────────── 통합 정산 ──────────────────────────


def test_self_drive_full():
    """자가차량 운전 → 유류비 23,950 + 일비 25,000 + 식비 25,000 = 73,950.

    (식비 미제공 시 기본 3식 25,000)
    """
    r = calculate(mode="self_drive", days=1, distance_km=139, fuel_price=2063)
    assert r.fuel_cost == 23_950
    assert r.per_diem == 25_000
    assert r.meal_cost == 25_000
    assert r.total == 73_950


def test_self_drive_no_meal_matches_readme():
    """README 검수: 유류비 23,950 + 일비 25,000 = 48,950 (식비 0식일 때)."""
    r = calculate(
        mode="self_drive", days=1, distance_km=139, fuel_price=2063,
        meals_provided=3,  # 3식 전부 제공 → 식비 0
    )
    assert r.meal_cost == 0
    assert r.fuel_cost + r.per_diem == 48_950
    assert r.total == 48_950


def test_self_passenger_half_per_diem():
    """자가차량 동승 → 유류비 0, 일비 12,500 (50%)."""
    r = calculate(mode="self_passenger", days=1, distance_km=139, fuel_price=2063)
    assert r.fuel_cost == 0
    assert r.per_diem == 12_500
    assert r.breakdown["half_per_diem"] is True


def test_company_car_half_per_diem_no_fuel():
    r = calculate(mode="company_car", days=1, distance_km=139, fuel_price=2063)
    assert r.fuel_cost == 0
    assert r.toll_sum == 0
    assert r.per_diem == 12_500


def test_public_transit_receipts_sum():
    """대중교통 → 영수증 실비 합계."""
    r = calculate(
        mode="public_transit", days=1,
        public_receipts=[
            {"label": "KTX 포항→서울", "amount": 53_600},
            {"label": "KTX 서울→포항", "amount": 53_900},
        ],
    )
    assert r.public_cost == 107_500
    assert r.fuel_cost == 0
    # 일비 100% + 식비 3식 + 교통 107,500
    assert r.total == 107_500 + 25_000 + 25_000


def test_public_transit_accepts_plain_amounts():
    r = calculate(mode="public_transit", days=1, public_receipts=[10_000, 5_000])
    assert r.public_cost == 15_000


def test_meal_counter_two_meals():
    """README 검수: 식비 카운터 → 2식 지급 시 16,670원."""
    r = calculate(mode="self_drive", days=1, distance_km=0, fuel_price=0,
                  meals_provided=1)  # 기본 3식 − 1 = 2식
    assert r.meal_cost == 16_670


def test_lodging_metro_one_night():
    """README 검수: 숙박 1박 광역시 → 80,000원."""
    r = calculate(mode="self_drive", days=1, nights=1, region="metro")
    assert r.lodge_cost == 80_000


def test_lodging_region_rates():
    assert calculate(mode="self_drive", nights=1, region="seoul").lodge_cost == 100_000
    assert calculate(mode="self_drive", nights=1, region="metro").lodge_cost == 80_000
    assert calculate(mode="self_drive", nights=1, region="other").lodge_cost == 70_000
    assert calculate(mode="self_drive", nights=2, region="seoul").lodge_cost == 200_000


def test_invalid_region_defaults_other():
    r = calculate(mode="self_drive", nights=1, region="unknown")
    assert r.lodge_cost == 70_000


def test_rules_applied_present():
    r = calculate(mode="self_drive", days=1, distance_km=139, fuel_price=2063)
    assert any("유류비" in s for s in r.rules_applied)
    assert any("일비" in s for s in r.rules_applied)


def test_to_dict_shape():
    r = calculate(mode="self_drive", days=1, distance_km=139, fuel_price=2063)
    d = r.to_dict()
    for k in ["fuel_cost", "toll_sum", "public_cost", "meal_cost",
              "per_diem", "lodge_cost", "total", "breakdown", "rules_applied"]:
        assert k in d
