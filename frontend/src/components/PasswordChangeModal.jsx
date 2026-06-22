import { useState } from "react";
import { X, Loader2, KeyRound } from "lucide-react";
import { api } from "../lib/api.js";

export function PasswordChangeModal({ open, onClose, onSuccess }) {
  const [cur, setCur] = useState("");
  const [next1, setNext1] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const reset = () => { setCur(""); setNext1(""); setNext2(""); setError(""); };
  const close = () => { reset(); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    if (!cur || !next1 || !next2) { setError("모든 항목을 입력하세요"); return; }
    if (next1.length < 4) { setError("새 비밀번호는 4자 이상이어야 합니다"); return; }
    if (next1 !== next2) { setError("새 비밀번호가 서로 다릅니다"); return; }
    setBusy(true);
    setError("");
    try {
      await api.changePassword(cur, next1);
      alert("비밀번호가 변경됐습니다.");
      reset();
      onClose();
      onSuccess?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 grid place-items-center z-50 px-4"
      onClick={close}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-lg shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="text-sm font-semibold inline-flex items-center gap-2">
            <KeyRound size={14} className="text-indigo-600" /> 비밀번호 변경
          </div>
          <button type="button" onClick={close} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="현재 비밀번호" value={cur} onChange={setCur} autoFocus />
          <Field label="새 비밀번호 (4자 이상)" value={next1} onChange={setNext1} />
          <Field label="새 비밀번호 확인" value={next2} onChange={setNext2} />
          {error && (
            <div className="text-[11.5px] text-red-700 bg-red-50 border border-red-100 rounded px-2.5 py-1.5">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 rounded-b-lg">
          <button
            type="button"
            onClick={close}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy}
            className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded inline-flex items-center gap-1"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
            {busy ? "변경 중…" : "변경"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, autoFocus }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-600 font-medium block mb-1">{label}</span>
      <input
        type="password"
        autoComplete="new-password"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
      />
    </label>
  );
}
