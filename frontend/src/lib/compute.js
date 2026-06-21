// 정산 계산 — backend/app/services/calculator.py 와 동일 결과 보장

import { FUEL_EFFICIENCY, PER_DIEM_DAILY, REGION_RATES, mealAmount } from "./constants.js";

const HALF_PER_DIEM_MODES = new Set(["self_passenger", "company_car"]);

export function fuelCost(distanceKm, fuelPrice) {
  if (!distanceKm || !fuelPrice) return 0;
  const raw = (distanceKm * fuelPrice) / FUEL_EFFICIENCY;
  return Math.floor(raw / 10) * 10; // 10원 절사
}

// overrides — 각 항목별로 사용자가 수동으로 입력한 값.
//   값이 숫자면 그 값 사용, null/undefined 이면 자동 계산값 사용.
// 어느 항목이 override 됐는지 UI 가 알 수 있도록 isOverridden 도 함께 반환.
const OVERRIDE_KEYS = ["fuelCost", "tollSum", "publicCost", "mealCost", "perDiem", "lodgeCost"];

const pickOverride = (overrides, key, auto) => {
  const v = overrides?.[key];
  return v === null || v === undefined ? auto : Number(v) || 0;
};

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
  overrides = {},
}) {
  const isDriver = mode === "self_drive";
  const isPassenger = mode === "self_passenger";
  const isCompanyCar = mode === "company_car";
  const isPublic = mode === "public_transit";
  const halfPerDiem = HALF_PER_DIEM_MODES.has(mode);

  const r = REGION_RATES[region] ? region : "other";
  const regionInfo = REGION_RATES[r];

  // 자동 계산값 ─────────────────────────────────────────
  const autoFuel = isDriver ? fuelCost(distanceKm, fuelPrice) : 0;
  const autoToll = isDriver ? tollSum : 0;
  const autoPublic = isPublic
    ? publicReceipts.reduce((s, x) => s + (x.amount || 0), 0)
    : 0;
  const billedMeals = Math.max(0, days * 3 - mealsProvided);
  const autoMeal = mealAmount(billedMeals);
  const perDiemFull = PER_DIEM_DAILY * days;
  const autoPerDiem = halfPerDiem ? Math.round(perDiemFull / 2) : perDiemFull;
  const autoLodge = nights * regionInfo.rate;

  // 최종 = override 가 있으면 그 값, 없으면 자동 ────────
  const fuel = pickOverride(overrides, "fuelCost", autoFuel);
  const toll = pickOverride(overrides, "tollSum", autoToll);
  const publicCost = pickOverride(overrides, "publicCost", autoPublic);
  const mealCost = pickOverride(overrides, "mealCost", autoMeal);
  const perDiem = pickOverride(overrides, "perDiem", autoPerDiem);
  const lodgeCost = pickOverride(overrides, "lodgeCost", autoLodge);

  const total = fuel + toll + publicCost + mealCost + perDiem + lodgeCost;

  // 어느 키가 사용자 수정 상태인지 — UI 에 ↻ 복원 버튼 표시용
  const isOverridden = Object.fromEntries(
    OVERRIDE_KEYS.map((k) => [k, overrides?.[k] !== null && overrides?.[k] !== undefined])
  );

  return {
    fuelCost: fuel,
    tollSum: toll,
    publicCost,
    mealCost,
    perDiem,
    lodgeCost,
    total,
    autoFuelCost: autoFuel,
    autoTollSum: autoToll,
    autoPublicCost: autoPublic,
    autoMealCost: autoMeal,
    autoPerDiem,
    autoLodgeCost: autoLodge,
    isOverridden,
    billedMeals,
    regionInfo,
    isDriver,
    isPassenger,
    isCompanyCar,
    isPublic,
    halfPerDiem,
  };
}
