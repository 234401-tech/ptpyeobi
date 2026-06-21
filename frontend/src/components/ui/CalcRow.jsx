import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { fmt } from "../../lib/constants.js";

/**
 * 자동 산정 한 줄.
 *
 * 인라인 수정 활성화 — onAmountChange 제공 시 금액 클릭 → input. blur/Enter 시 저장.
 * isOverridden=true 면 작은 ↻ 버튼으로 자동값으로 복원 (onAmountChange(null) 호출).
 * editable=false 면 클릭 무시 (현재 모드에서 의미 없는 항목 — 예: 대중교통일 때 유류비).
 */
export function CalcRow({
  icon,
  label,
  formula,
  hint,
  amount,
  zero = false,
  badge,
  children,
  onAmountChange,
  isOverridden = false,
  editable = true,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    if (!editable || !onAmountChange) return;
    setDraft(String(amount ?? 0));
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const next = draft.trim() === "" ? null : Number(draft.replace(/[^\d.-]/g, "")) || 0;
    onAmountChange?.(next);
  };
  const cancel = () => setEditing(false);
  const reset = (e) => {
    e.stopPropagation();
    onAmountChange?.(null);
  };

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
          {isOverridden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
              수정됨
            </span>
          )}
        </div>
        {formula && <div className="text-[11px] text-slate-500 mt-0.5 mono">{formula}</div>}
        {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
        {children}
      </div>

      <div className="flex items-center gap-1">
        {isOverridden && onAmountChange && (
          <button
            type="button"
            onClick={reset}
            title="자동 계산값으로 복원"
            className="w-6 h-6 grid place-items-center rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
          >
            <RotateCcw size={11} />
          </button>
        )}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") cancel();
            }}
            className="w-24 text-right text-sm font-semibold tabular border border-indigo-500 rounded px-1.5 py-0.5 focus:outline-none"
          />
        ) : (
          <div
            onClick={startEdit}
            title={editable && onAmountChange ? "클릭해서 수정" : ""}
            className={`text-sm font-semibold tabular select-none ${
              zero ? "text-slate-400" : "text-slate-900"
            } ${
              editable && onAmountChange
                ? "cursor-text px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200"
                : ""
            }`}
          >
            {fmt(amount)}
            <span className="text-[10px] text-slate-400 ml-px font-normal">원</span>
          </div>
        )}
      </div>
    </div>
  );
}
