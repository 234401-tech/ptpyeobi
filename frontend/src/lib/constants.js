// 여비지급규정 v2025.06.24 — 백엔드 calculator.py 와 동일 값 유지

export const TRIP_MODES = [
  { id: "self_drive", label: "자가차량 운전", hint: "유류비 전액 · 일비 100%" },
  { id: "self_passenger", label: "자가차량 동승", hint: "유류비 0 · 일비 50%" },
  { id: "company_car", label: "공용차량", hint: "운임 0 · 일비 50%" },
  { id: "public_transit", label: "대중교통", hint: "운임 실비 · 일비 100%" },
];

export const REGION_RATES = {
  seoul: { label: "서울특별시", rate: 100000 },
  metro: { label: "광역시", rate: 80000 },
  other: { label: "그 밖의 지역", rate: 70000 },
};

export const PER_DIEM_DAILY = 25000;
export const FUEL_EFFICIENCY = 11.97;

const MEAL_TABLE = { 0: 0, 1: 8330, 2: 16670, 3: 25000, 4: 33330, 5: 41670 };

export function mealAmount(n) {
  if (n <= 0) return 0;
  if (n in MEAL_TABLE) return MEAL_TABLE[n];
  return 41670 + Math.round((n - 5) * 8333);
}

export const FUND_PILL_CLASS = {
  "통장": "bg-slate-100 text-slate-700",
  "e나라": "bg-sky-50 text-sky-700 border border-sky-100",
  "RCMS": "bg-violet-50 text-violet-700 border border-violet-100",
  "보탬e": "bg-emerald-50 text-emerald-700 border border-emerald-100",
  "지방비": "bg-amber-50 text-amber-700 border border-amber-100",
};

export function fmt(n) {
  return (n ?? 0).toLocaleString();
}
