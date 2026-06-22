import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search, Trash2, Pencil, Check, X, RefreshCw } from "lucide-react";
import { api } from "../../lib/api.js";
import { fmt } from "../../lib/constants.js";
import { Pill } from "../../components/ui/Pill.jsx";

const FUND_OPTIONS = ["통장", "e나라", "RCMS", "보탬e", "지방비"];

export function AdminLedgerPage() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [bizSystems, setBizSystems] = useState([]);
  useEffect(() => {
    api.listBizSystems().then(setBizSystems).catch(() => {});
  }, []);

  const [query, setQuery] = useState("");
  const [fundFilter, setFundFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.listTrips({
        q: query || undefined,
        fund: fundFilter || undefined,
        month: monthFilter || undefined,
      });
      setRows(data);
      setSelectedIds(new Set());
    } catch (e) {
      setError(`목록 로드 실패: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [query, fundFilter, monthFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`선택한 ${ids.length}건을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      const r = await api.bulkDeleteTrips(ids);
      setRows((rs) => rs.filter((row) => !selectedIds.has(row.id)));
      setSelectedIds(new Set());
      alert(`${r.deleted}건 삭제 완료`);
    } catch (e) {
      alert(`삭제 실패: ${e.message}`);
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditDraft({
      title: row.title || "",
      traveler_name: row.traveler_name || "",
      dept: row.dept || "",
      place: row.place || "",
      biz_name: row.biz_name || "",
      total: row.total || 0,
      fund_system: row.fund_system || "",
      status: row.status || "확정",
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
      const updated = await api.updateTrip(id, {
        ...editDraft,
        total: Number(editDraft.total) || 0,
        fund_system: editDraft.fund_system || null,
        dept: editDraft.dept || null,
        biz_name: editDraft.biz_name || null,
      });
      setRows((rs) => rs.map((r) => (r.id === id ? updated : r)));
      cancelEdit();
    } catch (e) {
      alert(`수정 실패: ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const removeRow = async (row) => {
    if (!window.confirm(`No.${row.no} "${row.title}" 을(를) 삭제할까요?`)) return;
    try {
      await api.deleteTrip(row.id);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
    } catch (e) {
      alert(`삭제 실패: ${e.message}`);
    }
  };

  const downloadXlsx = async () => {
    try {
      const { blob, filename } = await api.exportTripsXlsx({
        q: query || undefined,
        fund: fundFilter || undefined,
        month: monthFilter || undefined,
      });
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

  const totalSum = useMemo(() => rows.reduce((s, r) => s + (r.total || 0), 0), [rows]);

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* 상단 툴바 */}
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            출장대장 일괄 관리
            <span className="text-[10px] text-slate-400 font-normal">2026년 국내 출장</span>
          </h2>
          <div className="text-[11px] text-slate-500 mt-0.5">
            누계 <b className="text-slate-700">{rows.length}건</b> · 합계{" "}
            <b className="text-slate-700 tabular">{fmt(totalSum)}원</b>
            {selectedIds.size > 0 && (
              <span className="ml-2 text-indigo-700 font-medium">선택 {selectedIds.size}건</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1"
            title="다시 불러오기"
          >
            <RefreshCw size={11} className={busy ? "animate-spin" : ""} />
            새로고침
          </button>
          <button
            type="button"
            onClick={downloadXlsx}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <Download size={11} /> XLSX 다운로드
          </button>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={selectedIds.size === 0}
            className="text-xs px-2.5 py-1.5 rounded-md inline-flex items-center gap-1 bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            <Trash2 size={11} /> 선택 삭제 ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* 필터 행 */}
      <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2 flex-wrap text-xs">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-[7px] text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목 · 출장자 검색"
            className="w-56 pl-7 pr-2 py-1.5 border border-slate-200 rounded bg-white focus:outline-none focus:border-indigo-600"
          />
        </div>
        <select
          value={fundFilter}
          onChange={(e) => setFundFilter(e.target.value)}
          className="border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-600"
        >
          <option value="">시스템 전체</option>
          {FUND_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-600"
          title="자금집행월 기준"
        />
        {(query || fundFilter || monthFilter) && (
          <button
            type="button"
            onClick={() => { setQuery(""); setFundFilter(""); setMonthFilter(""); }}
            className="text-[10.5px] text-slate-500 hover:text-slate-800 px-2 py-1"
          >
            필터 초기화
          </button>
        )}
      </div>

      {error && (
        <div className="px-5 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">{error}</div>
      )}

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.1em] text-slate-500 sticky top-0">
            <tr>
              <th className="px-2 py-2 w-9 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  title="전체 선택"
                />
              </th>
              <th className="px-2 py-2 text-left font-medium w-10">No.</th>
              <th className="px-2 py-2 text-left font-medium">제목</th>
              <th className="px-2 py-2 text-left font-medium">출장자</th>
              <th className="px-2 py-2 text-left font-medium">부서</th>
              <th className="px-2 py-2 text-left font-medium">출장지</th>
              <th className="px-2 py-2 text-right font-medium">출장비</th>
              <th className="px-2 py-2 text-center font-medium">시스템</th>
              <th className="px-2 py-2 text-center font-medium">상태</th>
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !busy && (
              <tr>
                <td colSpan={10} className="text-center text-slate-400 py-8 text-[11px]">
                  데이터 없음
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isEditing = editingId === r.id;
              const checked = selectedIds.has(r.id);
              if (isEditing && editDraft) {
                return (
                  <tr key={r.id} className="border-t border-slate-100 bg-indigo-50/40">
                    <td className="px-2 py-2 text-center">
                      <input type="checkbox" checked={checked} onChange={() => toggleOne(r.id)} />
                    </td>
                    <td className="px-2 py-2 text-slate-400 mono text-[11px] tabular">{r.no}</td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editDraft.title}
                        onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        value={editDraft.biz_name}
                        onChange={(e) => setEditDraft({ ...editDraft, biz_name: e.target.value })}
                        placeholder="사업명"
                        list="biz-names-list"
                        className="w-full mt-1 text-[10.5px] border border-slate-200 rounded px-2 py-0.5 text-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <datalist id="biz-names-list">
                        {bizSystems.map((b) => <option key={b.id} value={b.biz_name} />)}
                      </datalist>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editDraft.traveler_name}
                        onChange={(e) => setEditDraft({ ...editDraft, traveler_name: e.target.value })}
                        className="w-20 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editDraft.dept}
                        onChange={(e) => setEditDraft({ ...editDraft, dept: e.target.value })}
                        className="w-24 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editDraft.place}
                        onChange={(e) => setEditDraft({ ...editDraft, place: e.target.value })}
                        className="w-32 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={editDraft.total}
                        onChange={(e) => setEditDraft({ ...editDraft, total: e.target.value })}
                        className="w-24 text-xs border border-slate-300 rounded px-2 py-1 text-right tabular focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={editDraft.fund_system}
                        onChange={(e) => setEditDraft({ ...editDraft, fund_system: e.target.value })}
                        className="text-xs border border-slate-300 rounded px-1 py-1 bg-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">—</option>
                        {FUND_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={editDraft.status}
                        onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })}
                        className="text-xs border border-slate-300 rounded px-1 py-1 bg-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="작성중">작성중</option>
                        <option value="확정">확정</option>
                        <option value="집행완료">집행완료</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-0.5">
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
                  key={r.id}
                  className={`group border-t border-slate-100 hover:bg-slate-50/70 ${
                    checked ? "bg-indigo-50/40" : ""
                  }`}
                >
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(r.id)} />
                  </td>
                  <td className="px-2 py-2 text-slate-400 mono text-[11px] tabular">{r.no}</td>
                  <td className="px-2 py-2">
                    <div className="truncate max-w-[280px]">{r.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{r.biz_name}</div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.traveler_name}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-slate-500">{r.dept || "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-slate-500 truncate max-w-[160px]">{r.place}</td>
                  <td className="px-2 py-2 text-right tabular font-medium">{fmt(r.total)}</td>
                  <td className="px-2 py-2 text-center">
                    <Pill fund={r.fund_system} />
                  </td>
                  <td className="px-2 py-2 text-center text-[10.5px] text-slate-500">{r.status}</td>
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
    </section>
  );
}
