from datetime import date, datetime

from sqlalchemy import (
    DateTime,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Trip(Base):
    """출장 정산 1건 (출장대장 한 행)."""

    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    no: Mapped[int | None] = mapped_column(Integer, unique=True)  # 출장대장 번호
    traveler_name: Mapped[str] = mapped_column(String, nullable=False)
    dept: Mapped[str | None] = mapped_column(String)

    trip_date: Mapped[date] = mapped_column(Date, nullable=False)
    depart_time: Mapped[str | None] = mapped_column(String)  # "14:00"
    return_time: Mapped[str | None] = mapped_column(String)  # "17:00"
    days: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    place: Mapped[str] = mapped_column(String, nullable=False)
    distance_km: Mapped[float | None] = mapped_column(Float)  # 카카오맵 자동

    # self_drive | self_passenger | company_car | public_transit
    mode: Mapped[str] = mapped_column(String, nullable=False)
    companions: Mapped[int] = mapped_column(Integer, default=0)

    fuel_price: Mapped[int | None] = mapped_column(Integer)  # 오파넷 매칭 원/L
    fuel_cost: Mapped[int] = mapped_column(Integer, default=0)
    toll_sum: Mapped[int] = mapped_column(Integer, default=0)
    public_cost: Mapped[int] = mapped_column(Integer, default=0)

    meals_provided: Mapped[int] = mapped_column(Integer, default=0)
    meal_cost: Mapped[int] = mapped_column(Integer, default=0)

    per_diem: Mapped[int] = mapped_column(Integer, default=0)

    nights: Mapped[int] = mapped_column(Integer, default=0)
    region: Mapped[str | None] = mapped_column(String)  # seoul|metro|other
    lodge_cost: Mapped[int] = mapped_column(Integer, default=0)

    total: Mapped[int] = mapped_column(Integer, default=0)

    title: Mapped[str] = mapped_column(String, nullable=False)
    biz_name: Mapped[str | None] = mapped_column(String)
    fund_system: Mapped[str | None] = mapped_column(String)  # 통장|e나라|RCMS|보탬e|지방비

    status: Mapped[str] = mapped_column(String, default="확정")  # 작성중|확정|집행완료
    fund_date: Mapped[date | None] = mapped_column(Date)  # 자금집행일

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    public_receipts: Mapped[list["PublicReceipt"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )


class PublicReceipt(Base):
    """대중교통 영수증 (trip 종속)."""

    __tablename__ = "public_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    ocr_confidence: Mapped[float | None] = mapped_column(Float)  # 0.0~1.0
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    trip: Mapped["Trip"] = relationship(back_populates="public_receipts")


class FuelPrice(Base):
    """오파넷 일자별 보통휘발유 평균가 (캐시)."""

    __tablename__ = "fuel_prices"

    date: Mapped[date] = mapped_column(Date, primary_key=True)  # "2026-05-21"
    weekday: Mapped[str | None] = mapped_column(String)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Attachment(Base):
    """증빙 첨부 파일."""

    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int | None] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE")
    )
    filename: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)  # data/uploads/...
    ocr_result_json: Mapped[str | None] = mapped_column(Text)  # OCR 원본 (디버깅)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    trip: Mapped["Trip | None"] = relationship(back_populates="attachments")
