import { Edit3, Plus } from "lucide-react";
import { Card, CardHeader } from "./ui/Card.jsx";
import { fmt } from "../lib/constants.js";

export function LedgerAddCard({ current, total, onAdd, busy }) {
  return (
    <Card>
      <CardHeader num={3} title="출장대장에 추가" />
      <div className="px-5 pb-5">
        <div className="border border-slate-200 rounded-md overflow-hidden mb-3">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium">제목</th>
                <th className="text-left px-2 py-1.5 font-medium">출장자</th>
                <th className="text-right px-2 py-1.5 font-medium">출장비</th>
                <th className="text-left px-2 py-1.5 font-medium">자금집행일</th>
                <th className="text-left px-2 py-1.5 font-medium">시스템</th>
                <th className="text-left px-2 py-1.5 font-medium">예산명</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-indigo-50/50">
                <td className="px-2 py-1.5 truncate max-w-[200px]">{current.title}</td>
                <td className="px-2 py-1.5">{current.traveler}</td>
                <td className="px-2 py-1.5 text-right tabular font-semibold">{fmt(total)}</td>
                <td className="px-2 py-1.5 mono text-[11px]">2026-06-23</td>
                <td className="px-2 py-1.5">{current.fund}</td>
                <td className="px-2 py-1.5">{current.biz}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <Edit3 size={13} /> 수정
          </button>
          <button
            type="button"
            onClick={onAdd}
            disabled={busy}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-md inline-flex items-center justify-center gap-2"
          >
            <Plus size={15} /> {busy ? "저장 중…" : "출장대장에 추가하고 다음 건으로"}
          </button>
        </div>
      </div>
    </Card>
  );
}
