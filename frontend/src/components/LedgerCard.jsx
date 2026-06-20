import { Search, ChevronDown, Download } from "lucide-react";
import { Pill } from "./ui/Pill.jsx";
import { fmt } from "../lib/constants.js";
import { api } from "../lib/api.js";

export function LedgerCard({ ledger, justAddedNo, query, onQuery }) {
  const downloadXlsx = async () => {
    try {
      const { blob, filename } = await api.exportTripsXlsx({ q: query });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`다운로드 실패: ${e.message}`);
    }
  };
  const filtered = query
    ? ledger.filter(
        (r) => r.title.includes(query) || r.traveler_name.includes(query)
      )
    : ledger;
  const monthSum = filtered.reduce((a, b) => a + (b.total || 0), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg sticky top-4">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            출장대장
            <span className="text-[10px] text-slate-400 font-normal">2026년 국내 출장</span>
          </h2>
          <div className="text-[11px] text-slate-500 mt-0.5">
            누계 <b className="text-slate-700">{ledger.length}건</b> · 합계{" "}
            <b className="text-slate-700 tabular">{fmt(monthSum)}원</b>
          </div>
        </div>
        <button
          type="button"
          onClick={downloadXlsx}
          className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 inline-flex items-center gap-1"
        >
          <Download size={11} /> XLSX
        </button>
      </div>
      <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2 top-[7px] text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="제목 · 출장자 검색"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-indigo-600"
          />
        </div>
        <button
          type="button"
          className="text-[11px] px-2 py-1.5 border border-slate-200 rounded inline-flex items-center gap-1 hover:bg-slate-50"
        >
          전체 <ChevronDown size={11} />
        </button>
      </div>
      <div className="max-h-[700px] overflow-y-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-50/95 text-[10px] uppercase tracking-[0.1em] text-slate-500 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left font-medium w-8">No.</th>
              <th className="px-2 py-2 text-left font-medium">제목</th>
              <th className="px-2 py-2 text-left font-medium">출장자</th>
              <th className="px-2 py-2 text-right font-medium">출장비</th>
              <th className="px-2 py-2 text-center font-medium">시스템</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-8 text-[11px]">
                  데이터 없음
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const just = justAddedNo === r.no;
              return (
                <tr
                  key={r.id ?? r.no}
                  className={`border-t border-slate-100 hover:bg-slate-50/70 ${
                    just ? "bg-emerald-50 animate-pulse" : ""
                  }`}
                >
                  <td className="px-2 py-2 text-slate-400 mono text-[11px] tabular w-8">{r.no}</td>
                  <td className="px-2 py-2">
                    <div className="truncate max-w-[230px]">{r.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{r.biz_name}</div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.traveler_name}</td>
                  <td className="px-2 py-2 text-right tabular font-medium">{fmt(r.total)}</td>
                  <td className="px-2 py-2 text-center">
                    <Pill fund={r.fund_system} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
