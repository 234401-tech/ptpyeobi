import { FUND_PILL_CLASS } from "../../lib/constants.js";

export function Pill({ fund }) {
  const cls = FUND_PILL_CLASS[fund] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${cls}`}>
      {fund}
    </span>
  );
}
