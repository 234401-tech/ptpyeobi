import { Download } from "lucide-react";
import { fmt } from "../lib/constants.js";

export function FuelPriceCard({ prices, currentDate, currentPrice, hasLive }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            오파넷 일자별 유가
            {!hasLive && (
              <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                CACHE
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            보통휘발유 평균가 · 최근 {prices.length}일
          </div>
        </div>
        <button
          type="button"
          disabled
          className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white inline-flex items-center gap-1 opacity-60"
        >
          <Download size={11} /> 새로고침
        </button>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {prices.map((p, i) => {
          const isCurrent = p.date === currentDate;
          const wkCls =
            p.weekday === "토"
              ? "bg-blue-50 text-blue-700"
              : p.weekday === "일"
              ? "bg-red-50 text-red-700"
              : "bg-slate-100 text-slate-600";
          const delta = p.delta;
          const deltaCls =
            delta > 0
              ? "text-red-600"
              : delta < 0
              ? "text-blue-600"
              : "text-slate-400";
          const deltaText =
            delta == null ? "—" : delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : "—";
          return (
            <div
              key={p.date}
              className={`grid items-center gap-2.5 px-5 py-1.5 text-xs border-t border-slate-100 first:border-t-0 ${
                isCurrent ? "bg-indigo-50 border-l-[3px] border-l-indigo-600 pl-[17px]" : ""
              }`}
              style={{ gridTemplateColumns: "78px 32px 1fr 60px" }}
            >
              <span className={`mono text-[11px] tabular ${isCurrent ? "text-indigo-700 font-semibold" : "text-slate-700"}`}>
                {p.date}
              </span>
              <span className={`text-[10px] text-center py-0.5 rounded font-medium ${wkCls}`}>
                {p.weekday}
              </span>
              <span className={`font-semibold tabular text-right ${isCurrent ? "text-indigo-700" : "text-slate-900"}`}>
                {fmt(p.price)}
                <span className="text-[10px] text-slate-400 ml-px font-normal">원/L</span>
              </span>
              <span className={`text-[10.5px] text-right tabular ${deltaCls}`}>{deltaText}</span>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2 bg-slate-50 text-[10px] text-slate-500 border-t border-slate-200 flex items-center justify-between">
        <span>
          출장일 <b className="text-indigo-700">{currentDate}</b> 자동 적용
          {currentPrice && (
            <span className="ml-1.5 text-[9px] font-semibold text-indigo-700 bg-white border border-indigo-200 px-1.5 py-0.5 rounded">
              {fmt(currentPrice)}원/L
            </span>
          )}
        </span>
        <span>{hasLive ? "오파넷 API 연동" : "API 키 미설정 — 캐시 사용"}</span>
      </div>
    </div>
  );
}
