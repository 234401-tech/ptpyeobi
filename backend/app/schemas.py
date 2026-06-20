"""Pydantic 요청/응답 스키마."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# ────────────────────────── 공용 ──────────────────────────


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ────────────────────────── 영수증 ──────────────────────────


class PublicReceiptIn(BaseModel):
    label: str
    amount: int = Field(ge=0)
    ocr_confidence: float | None = None


class PublicReceiptOut(ORMModel):
    id: int
    label: str
    amount: int
    ocr_confidence: float | None = None


# ────────────────────────── 정산 계산 ──────────────────────────


class CalculateIn(BaseModel):
    mode: str = Field(description="self_drive|self_passenger|company_car|public_transit")
    days: int = 1
    distance_km: float = 0
    fuel_price: int = 0
    nights: int = 0
    region: str = "other"  # seoul|metro|other
    meals_provided: int = 0
    toll_sum: int = 0
    public_receipts: list[PublicReceiptIn] = []


class CalculateOut(BaseModel):
    fuel_cost: int
    toll_sum: int
    public_cost: int
    meal_cost: int
    per_diem: int
    lodge_cost: int
    total: int
    breakdown: dict
    rules_applied: list[str]


# ────────────────────────── 출장 ──────────────────────────


class TripBase(BaseModel):
    traveler_name: str
    dept: str | None = None
    trip_date: date
    depart_time: str | None = None
    return_time: str | None = None
    days: int = 1
    place: str
    distance_km: float | None = None
    mode: str
    companions: int = 0
    fuel_price: int | None = None
    fuel_cost: int = 0
    toll_sum: int = 0
    public_cost: int = 0
    meals_provided: int = 0
    meal_cost: int = 0
    per_diem: int = 0
    nights: int = 0
    region: str | None = None
    lodge_cost: int = 0
    total: int = 0
    title: str
    biz_name: str | None = None
    fund_system: str | None = None
    status: str = "확정"
    fund_date: date | None = None


class TripCreate(TripBase):
    public_receipts: list[PublicReceiptIn] = []


class TripUpdate(BaseModel):
    """PATCH — 모든 필드 optional."""

    traveler_name: str | None = None
    dept: str | None = None
    trip_date: date | None = None
    depart_time: str | None = None
    return_time: str | None = None
    days: int | None = None
    place: str | None = None
    distance_km: float | None = None
    mode: str | None = None
    companions: int | None = None
    fuel_price: int | None = None
    fuel_cost: int | None = None
    toll_sum: int | None = None
    public_cost: int | None = None
    meals_provided: int | None = None
    meal_cost: int | None = None
    per_diem: int | None = None
    nights: int | None = None
    region: str | None = None
    lodge_cost: int | None = None
    total: int | None = None
    title: str | None = None
    biz_name: str | None = None
    fund_system: str | None = None
    status: str | None = None
    fund_date: date | None = None
    public_receipts: list[PublicReceiptIn] | None = None


class TripOut(ORMModel):
    id: int
    no: int | None
    traveler_name: str
    dept: str | None
    trip_date: date
    depart_time: str | None
    return_time: str | None
    days: int
    place: str
    distance_km: float | None
    mode: str
    companions: int
    fuel_price: int | None
    fuel_cost: int
    toll_sum: int
    public_cost: int
    meals_provided: int
    meal_cost: int
    per_diem: int
    nights: int
    region: str | None
    lodge_cost: int
    total: int
    title: str
    biz_name: str | None
    fund_system: str | None
    status: str
    fund_date: date | None
    created_at: datetime
    updated_at: datetime
    public_receipts: list[PublicReceiptOut] = []


# ────────────────────────── 유가 ──────────────────────────


class FuelPriceOut(ORMModel):
    date: date
    weekday: str | None
    price: int
    delta: int | None = None  # 직전일 대비 (라우터에서 계산해 채움)


# ────────────────────────── 업로드 ──────────────────────────


class UploadOut(BaseModel):
    upload_id: int
    filename: str
    pages: int | None = None


class ExtractOut(BaseModel):
    traveler: str | None = None
    dept: str | None = None
    trip_date: date | None = None
    depart_time: str | None = None
    return_time: str | None = None
    place: str | None = None
    distance_km: float | None = None
    mode_suggested: str | None = None
    public_receipts: list[PublicReceiptIn] = []
    confidence: float | None = None
