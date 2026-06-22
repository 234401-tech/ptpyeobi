import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, X, Plus, Trash2, KeyRound, RefreshCw } from "lucide-react";
import { api } from "../../lib/api.js";

const SETTING_LABELS = {
  upstage_api_key: { label: "Upstage OCR 키", placeholder: "up_xxxxxxxx..." },
  opinet_api_key: { label: "오파넷 유가 키", placeholder: "10자 키" },
  ocr_provider: { label: "OCR 제공자", placeholder: "mock | local | upstage | claude_vision | got | surya" },
  anthropic_api_key: { label: "Anthropic 키 (선택)", placeholder: "sk-ant-..." },
};

export function AdminSettingsPage() {
  return (
    <section className="space-y-5">
      <SettingsCard />
      <UsersCard />
    </section>
  );
}

// ──────────────── API 키 설정 ────────────────

function SettingsCard() {
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await api.adminListSettings());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (key) => {
    try {
      await api.adminUpdateSetting(key, draft);
      setEditingKey(null);
      setDraft("");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">API 키 설정</h2>
          <div className="text-[11px] text-slate-500 mt-0.5">
            여기서 변경한 값이 백엔드 재시작 없이 즉시 적용됩니다. <code className="text-[10px] bg-slate-100 px-1 rounded">.env</code> 값은 DB 값이 없을 때만 폴백.
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1"
        >
          <RefreshCw size={11} className={busy ? "animate-spin" : ""} /> 새로고침
        </button>
      </div>
      {error && (
        <div className="px-5 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">{error}</div>
      )}
      <table className="w-full text-xs">
        <tbody>
          {Object.entries(SETTING_LABELS).map(([key, meta]) => {
            const entry = data[key] || { value: "", has_value: false, source: "none" };
            const isEditing = editingKey === key;
            return (
              <tr key={key} className="border-t border-slate-100">
                <td className="px-5 py-2.5 w-48 text-slate-600 font-medium">{meta.label}</td>
                <td className="px-3 py-2.5">
                  {isEditing ? (
                    <input
                      type="text"
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={meta.placeholder}
                      className="w-full max-w-xl text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                    />
                  ) : (
                    <code className="text-[11px] text-slate-700">
                      {entry.has_value ? entry.value : <span className="text-slate-400">(미설정)</span>}
                    </code>
                  )}
                </td>
                <td className="px-3 py-2.5 w-20 text-center">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    entry.source === "db"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                      : entry.source === "env"
                      ? "bg-amber-50 text-amber-700 border-amber-100"
                      : "bg-slate-50 text-slate-400 border-slate-100"
                  }`}>
                    {entry.source === "db" ? "DB" : entry.source === "env" ? "ENV" : "—"}
                  </span>
                </td>
                <td className="px-5 py-2.5 w-24 text-right">
                  {isEditing ? (
                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => save(key)}
                        className="w-6 h-6 grid place-items-center rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingKey(null); setDraft(""); }}
                        className="w-6 h-6 grid place-items-center rounded border border-slate-300 hover:bg-slate-50 text-slate-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditingKey(key); setDraft(""); }}
                      className="text-[11px] text-slate-500 hover:text-indigo-700 inline-flex items-center gap-1"
                    >
                      <Pencil size={10} /> 변경
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────── 사용자 관리 ────────────────

function UsersCard() {
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState({ username: "", password: "", role: "admin" });

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setUsers(await api.adminListUsers());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitAdd = async () => {
    if (!addDraft.username || !addDraft.password) {
      setError("아이디와 비밀번호를 입력하세요");
      return;
    }
    try {
      const created = await api.adminCreateUser(addDraft);
      setUsers((u) => [...u, created]);
      setAdding(false);
      setAddDraft({ username: "", password: "", role: "admin" });
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleActive = async (u) => {
    try {
      const updated = await api.adminUpdateUser(u.id, { is_active: !u.is_active });
      setUsers((arr) => arr.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      alert(e.message);
    }
  };

  const resetPw = async (u) => {
    const np = window.prompt(`${u.username} 의 새 임시 비밀번호 (4자 이상):`);
    if (!np) return;
    if (np.length < 4) {
      alert("4자 이상이어야 합니다");
      return;
    }
    try {
      await api.adminResetPassword(u.id, np);
      alert(`${u.username} 비밀번호를 새 값으로 재설정했습니다. 본인에게 전달하세요.`);
    } catch (e) {
      alert(e.message);
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`${u.username} 계정을 삭제할까요?`)) return;
    try {
      await api.adminDeleteUser(u.id);
      setUsers((arr) => arr.filter((x) => x.id !== u.id));
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">사용자 관리</h2>
          <div className="text-[11px] text-slate-500 mt-0.5">
            예산담당자 계정 추가/삭제/비번 재설정. 총 <b className="text-slate-700">{users.length}명</b>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <RefreshCw size={11} className={busy ? "animate-spin" : ""} /> 새로고침
          </button>
          <button
            type="button"
            onClick={() => { setAdding(true); setAddDraft({ username: "", password: "", role: "admin" }); setError(""); }}
            disabled={adding}
            className="text-xs px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-md inline-flex items-center gap-1"
          >
            <Plus size={11} /> 사용자 추가
          </button>
        </div>
      </div>
      {error && (
        <div className="px-5 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">{error}</div>
      )}
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.1em] text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">아이디</th>
            <th className="px-3 py-2 text-left font-medium w-24">권한</th>
            <th className="px-3 py-2 text-center font-medium w-24">상태</th>
            <th className="px-3 py-2 w-44"></th>
          </tr>
        </thead>
        <tbody>
          {adding && (
            <tr className="border-t border-slate-200 bg-indigo-50/40">
              <td className="px-3 py-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="아이디"
                  value={addDraft.username}
                  onChange={(e) => setAddDraft({ ...addDraft, username: e.target.value })}
                  className="w-40 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="초기 비밀번호 (4자 이상)"
                  value={addDraft.password}
                  onChange={(e) => setAddDraft({ ...addDraft, password: e.target.value })}
                  className="w-52 ml-2 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                />
              </td>
              <td className="px-3 py-2">
                <select
                  value={addDraft.role}
                  onChange={(e) => setAddDraft({ ...addDraft, role: e.target.value })}
                  className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="admin">admin</option>
                </select>
              </td>
              <td className="px-3 py-2 text-center text-slate-400">—</td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={submitAdd}
                    className="w-6 h-6 grid place-items-center rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="w-6 h-6 grid place-items-center rounded border border-slate-300 hover:bg-slate-50 text-slate-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              </td>
            </tr>
          )}
          {users.map((u) => (
            <tr key={u.id} className="group border-t border-slate-100 hover:bg-slate-50/70">
              <td className="px-3 py-2 font-medium">{u.username}</td>
              <td className="px-3 py-2 text-slate-600">{u.role}</td>
              <td className="px-3 py-2 text-center">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  u.is_active
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  {u.is_active ? "활성" : "비활성"}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => resetPw(u)}
                    title="비번 리셋"
                    className="w-6 h-6 grid place-items-center rounded text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    <KeyRound size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(u)}
                    title={u.is_active ? "비활성화" : "활성화"}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    {u.is_active ? "비활성화" : "활성화"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeUser(u)}
                    title="삭제"
                    className="w-6 h-6 grid place-items-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
