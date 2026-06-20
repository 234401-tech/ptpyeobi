"""POST /api/calculate — 정산 서버 검증."""

from fastapi import APIRouter

from app.schemas import CalculateIn, CalculateOut
from app.services.calculator import calculate

router = APIRouter(prefix="/api/calculate", tags=["calculate"])


@router.post("", response_model=CalculateOut)
def calculate_endpoint(body: CalculateIn) -> CalculateOut:
    receipts = [r.model_dump() for r in body.public_receipts]
    result = calculate(
        mode=body.mode,
        days=body.days,
        distance_km=body.distance_km,
        fuel_price=body.fuel_price,
        nights=body.nights,
        region=body.region,
        meals_provided=body.meals_provided,
        public_receipts=receipts,
        toll_sum=body.toll_sum,
    )
    return CalculateOut(**result.to_dict())
