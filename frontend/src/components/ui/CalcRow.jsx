import { fmt } from "../../lib/constants.js";

export function CalcRow({ icon, label, formula, hint, amount, zero = false, badge, children }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${
          zero ? "bg-slate-100 text-slate-400" : "bg-indigo-50 text-indigo-600"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
          {label}
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 font-medium">
              {badge}
            </span>
          )}
        </div>
        {formula && <div className="text-[11px] text-slate-500 mt-0.5 mono">{formula}</div>}
        {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
        {children}
      </div>
      <div className={`text-sm font-semibold tabular ${zero ? "text-slate-400" : "text-slate-900"}`}>
        {fmt(amount)}
        <span className="text-[10px] text-slate-400 ml-px font-normal">원</span>
      </div>
    </div>
  );
}
