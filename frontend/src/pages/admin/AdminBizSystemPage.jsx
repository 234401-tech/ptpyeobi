import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, RefreshCw } from "lucide-react";
import { api } from "../../lib/api.js";
import { Pill } from "../../components/ui/Pill.jsx";

const FUND_OPTIONS = ["통장", "e나라", "RCMS", "보탬e", "지방비"];

const EMPTY_DRAFT = { biz_name: "", fund_system: "통장", note: "", sort_order: 0 };

export function AdminBizSystemPage() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState(EMPTY_DRAFT);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setRows(await api.listBizSystems());
    } catch (e) {
      setError(`목록 로드 실패: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitAdd = async () => {
    if (!addDraft.biz_name.trim()) {
      setError("사업명을 입력하세요");
      return;
    }
    try {
      const created = await api.createBizSystem({
        ...addDraft,
        sort_order: Number(addDraft.sort_order) || 0,
      });
      setRows((rs) => [...rs, created].sort(byOrder));
      setAdding(false);
      setAddDraft(EMPTY_DRAFT);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditDraft({
      biz_name: row.biz_name,
      fund_system: row.fund_system,
      note: row.note || "",
      sort_order: row.sort_order,
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };
  const saveEdit = async (id) => {
    if (!editDraft?.biz_name.trim()) return;
    try {
      const updated = await api.updateBizSystem(id, {
        ...editDraft,
        sort_order: Number(editDraft.sort_order) || 0,
      });
      setRows((rs) => rs.map((r) => (r.id === id ? updated : r)).sort(byOrder));
      cancelEdit();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  const removeRow = async (row) => {
    if (!window.confirm(`"${row.biz_name}" 매핑을 삭제할까요?`)) return;
    try {
      await api.deleteBizSystem(row.id);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
    } catch (e) {
      alert(`삭제 실패: ${e.message}`);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">사업명 · 시스템 매핑</h2>
          <div className="text-[11px] text-slate-500 mt-0.5">
            사업명 입력 시 자동으로 회계시스템이 채워집니다. 총 <b className="text-slate-700">{rows.length}건</b>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <RefreshCw size={11} className={busy ? "animate-spin" : ""} />
            새로고침
          </button>
          <button
            type="button"
            onClick={() => { setAdding(true); setAddDraft(EMPTY_DRAFT); setError(""); }}
            disabled={adding}
            className="text-xs px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-md inline-flex items-center gap-1"
          >
            <Plus size={11} /> 매핑 추가
          </button>
        </div>
      </div>

      {error && (
        <div className="px-5 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-16">정렬</th>
              <th className="px-3 py-2 text-left font-medium">사업명</th>
              <th className="px-3 py-2 text-left font-medium w-32">시스템</th>
              <th className="px-3 py-2 text-left font-medium">메모</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-t border-slate-200 bg-indigo-50/40">
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={addDraft.sort_order}
                    onChange={(e) => setAddDraft({ ...addDraft, sort_order: e.target.value })}
                    className="w-14 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="사업명 (예: 재단운영비)"
                    value={addDraft.biz_name}
                    onChange={(e) => setAddDraft({ ...addDraft, biz_name: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={addDraft.fund_system}
                    onChange={(e) => setAddDraft({ ...addDraft, fund_system: e.target.value })}
                    className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-indigo-500"
                  >
                    {FUND_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    placeholder="메모 (선택)"
                    value={addDraft.note}
                    onChange={(e) => setAddDraft({ ...addDraft, note: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                  />
                </td>
                <td className="px-1 py-2 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={submitAdd}
                      className="w-6 h-6 grid place-items-center rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                      title="저장"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAdding(false); setAddDraft(EMPTY_DRAFT); }}
                      className="w-6 h-6 grid place-items-center rounded border border-slate-300 hover:bg-slate-50 text-slate-600"
                      title="취소"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {rows.length === 0 && !busy && !adding && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-8 text-[11px]">
                  매핑 없음 — "매핑 추가" 로 시작하세요
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isEditing = editingId === r.id;
              if (isEditing && editDraft) {
                return (
                  <tr key={r.id} className="border-t border-slate-100 bg-indigo-50/40">
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={editDraft.sort_order}
                        onChange={(e) => setEditDraft({ ...editDraft, sort_order: e.target.value })}
                        className="w-14 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editDraft.biz_name}
                        onChange={(e) => setEditDraft({ ...editDraft, biz_name: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editDraft.fund_system}
                        onChange={(e) => setEditDraft({ ...editDraft, fund_system: e.target.value })}
                        className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-indigo-500"
                      >
                        {FUND_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editDraft.note}
                        onChange={(e) => setEditDraft({ ...editDraft, note: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-1 py-2 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => saveEdit(r.id)}
                          className="w-6 h-6 grid place-items-center rounded bg-indigo-600 hover:bg-indigo-700 text-white"
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
                <tr key={r.id} className="group border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-3 py-2 text-slate-400 mono tabular">{r.sort_order}</td>
                  <td className="px-3 py-2 font-medium">{r.biz_name}</td>
                  <td className="px-3 py-2"><Pill fund={r.fund_system} /></td>
                  <td className="px-3 py-2 text-slate-500">{r.note || "—"}</td>
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

function byOrder(a, b) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.id - b.id;
}
