import { useState } from "react";
import { Search, ChevronDown, Download, Plus, Pencil, Trash2, Check, X, RotateCcw } from "lucide-react";
import { Pill } from "./ui/Pill.jsx";
import { EditableField } from "./ui/EditableField.jsx";
import { fmt } from "../lib/constants.js";
import { api } from "../lib/api.js";

const FUND_OPTIONS = ["통장", "e나라", "RCMS", "보탬e", "지방비"];

export function LedgerCard({
  ledger,
  justAddedNo,
  query,
  onQuery,
  current,
  setCurrentField,
  pendingTotal,
  onAdd,
  busy,
  onUpdateRow,
  onDeleteRow,
  onReset,
  bizMap = {},
}) {
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingId, setSavingId] = useState(null);

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

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditDraft({
      title: row.title || "",
      traveler_name: row.traveler_name || "",
      total: row.total || 0,
      fund_system: row.fund_system || "",
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };
  const saveEdit = async (id) => {
    if (!editDraft) return;
    setSavingId(id);
    try {
      await onUpdateRow(id, {
        title: editDraft.title,
        traveler_name: editDraft.traveler_name,
        total: Number(editDraft.total) || 0,
        fund_system: editDraft.fund_system || null,
      });
      cancelEdit();
    } catch (_) {
      // 에러는 훅이 setError 함
    } finally {
      setSavingId(null);
    }
  };
  const removeRow = async (row) => {
    if (!window.confirm(`No.${row.no} "${row.title}" 을(를) 삭제할까요?`)) return;
    try {
      await onDeleteRow(row.id);
    } catch (_) {}
  };

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
      {current && (
        <div className="px-4 py-3 border-b border-slate-100 bg-indigo-50/40">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-[0.1em] text-indigo-700 font-semibold">
              추가 예정
            </div>
            {onReset && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("입력값과 업로드된 증빙을 모두 초기화할까요?")) onReset();
                }}
                className="text-[10.5px] px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 inline-flex items-center gap-1"
                title="입력/업로드/오버라이드 초기화 — 다음 출장 입력 시작"
              >
                <RotateCcw size={10} /> 초기화
              </button>
            )}
          </div>

          {/* 제목 */}
          <div className="mb-2">
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 mb-0.5">제목</div>
            <EditableField
              value={current.title || ""}
              onChange={(v) => setCurrentField({ title: v })}
              placeholder="예: (04.09/서울) NIA 서울사무소 회의"
            />
          </div>

          {/* 사업명 — datalist 로 자동완성 + 자유 입력 */}
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-500 w-12 flex-shrink-0">사업명</span>
            <input
              list="biz-options"
              value={current.biz || ""}
              onChange={(e) => {
                const biz = e.target.value;
                const mapped = bizMap[biz];
                setCurrentField(mapped ? { biz, fund: mapped } : { biz });
              }}
              placeholder="사업명 입력 또는 선택"
              className="flex-1 min-w-0 text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-indigo-500"
            />
            <datalist id="biz-options">
              {Object.keys(bizMap).map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          {/* 시스템 — 사업명 자동 매핑 또는 직접 선택 */}
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-500 w-12 flex-shrink-0">시스템</span>
            <select
              value={current.fund || ""}
              onChange={(e) => setCurrentField({ fund: e.target.value })}
              className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">선택…</option>
              {FUND_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {current.fund && <Pill fund={current.fund} />}
          </div>

          {/* 출장자 + 합계 */}
          <div className="flex items-end justify-between gap-2 mb-2.5">
            <div className="text-xs text-slate-600">
              {current.traveler ? (
                <>
                  <span className="text-[10px] text-slate-500 mr-1">출장자</span>
                  {current.traveler}
                </>
              ) : (
                <span className="text-slate-400">출장자 미입력</span>
              )}
            </div>
            <div className="text-right">
              <div className="tabular font-bold text-indigo-700 text-base">
                {fmt(pendingTotal)}
              </div>
              <div className="text-[10px] text-slate-400">원</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onAdd}
            disabled={busy}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-md inline-flex items-center justify-center gap-2"
          >
            <Plus size={15} /> {busy ? "저장 중…" : "출장대장에 추가하고 다음 건으로"}
          </button>
        </div>
      )}
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
              <th className="px-2 py-2 w-14"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-8 text-[11px]">
                  데이터 없음
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const just = justAddedNo === r.no;
              const isEditing = editingId === r.id;
              if (isEditing && editDraft) {
                return (
                  <tr key={r.id ?? r.no} className="border-t border-slate-100 bg-indigo-50/40 align-top">
                    <td className="px-2 py-2 text-slate-400 mono text-[11px] tabular w-8">{r.no}</td>
                    <td className="px-2 py-2" colSpan={4}>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={editDraft.title}
                          onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                          placeholder="제목"
                          className="col-span-2 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          value={editDraft.traveler_name}
                          onChange={(e) => setEditDraft({ ...editDraft, traveler_name: e.target.value })}
                          placeholder="출장자"
                          className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="number"
                          value={editDraft.total}
                          onChange={(e) => setEditDraft({ ...editDraft, total: e.target.value })}
                          placeholder="출장비"
                          className="text-xs border border-slate-300 rounded px-2 py-1 text-right tabular focus:outline-none focus:border-indigo-500"
                        />
                        <select
                          value={editDraft.fund_system}
                          onChange={(e) => setEditDraft({ ...editDraft, fund_system: e.target.value })}
                          className="col-span-2 text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">시스템 없음</option>
                          {FUND_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => saveEdit(r.id)}
                          disabled={savingId === r.id}
                          className="w-6 h-6 grid place-items-center rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white"
                          title="저장"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="w-6 h-6 grid place-items-center rounded border border-slate-300 hover:bg-slate-50 text-slate-600"
                          title="취소"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={r.id ?? r.no}
                  className={`group border-t border-slate-100 hover:bg-slate-50/70 ${
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
                  <td className="px-1 py-2 text-right">
                    <div className="opacity-0 group-hover:opacity-100 transition flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="w-6 h-6 grid place-items-center rounded text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        title="수정"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(r)}
                        className="w-6 h-6 grid place-items-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
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
