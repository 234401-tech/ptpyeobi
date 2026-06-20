// 정산 계산 — backend/app/services/calculator.py 와 동일 결과 보장

import { FUEL_EFFICIENCY, PER_DIEM_DAILY, REGION_RATES, mealAmount } from "./constants.js";

const HALF_PER_DIEM_MODES = new Set(["self_passenger", "company_car"]);

export function fuelCost(distanceKm, fuelPrice) {
  if (!distanceKm || !fuelPrice) return 0;
  const raw = (distanceKm * fuelPrice) / FUEL_EFFICIENCY;
  return Math.floor(raw / 10) * 10; // 10원 절사
}

export function compute({
  mode,
  days = 1,
  distanceKm = 0,
  fuelPrice = 0,
  nights = 0,
  region = "other",
  mealsProvided = 0,
  publicReceipts = [],
  tollSum = 0,
}) {
  const isDriver = mode === "self_drive";
  const isPassenger = mode === "self_passenger";
  const isCompanyCar = mode === "company_car";
  const isPublic = mode === "public_transit";
  const halfPerDiem = HALF_PER_DIEM_MODES.has(mode);

  const r = REGION_RATES[region] ? region : "other";
  const regionInfo = REGION_RATES[r];

  const fuel = isDriver ? fuelCost(distanceKm, fuelPrice) : 0;
  const toll = isDriver ? tollSum : 0;
  const publicCost = isPublic
    ? publicReceipts.reduce((s, x) => s + (x.amount || 0), 0)
    : 0;

  const billedMeals = Math.max(0, days * 3 - mealsProvided);
  const mealCost = mealAmount(billedMeals);

  const perDiemFull = PER_DIEM_DAILY * days;
  const perDiem = halfPerDiem ? Math.round(perDiemFull / 2) : perDiemFull;

  const lodgeCost = nights * regionInfo.rate;
  const total = fuel + toll + publicCost + mealCost + perDiem + lodgeCost;

  return {
    fuelCost: fuel,
    tollSum: toll,
    publicCost,
    mealCost,
    perDiem,
    lodgeCost,
    total,
    billedMeals,
    regionInfo,
    isDriver,
    isPassenger,
    isCompanyCar,
    isPublic,
    halfPerDiem,
  };
}
