// 클릭 → input 으로 전환되는 인라인 편집 필드.
// Enter / blur 로 저장, Escape 로 취소. 외부 value 변경(예: OCR 추출) 시 자동 동기화.

import { useEffect, useRef, useState } from "react";

export function EditableField({
  value,
  onChange,
  placeholder = "클릭하여 입력",
  suffix = "",
  type = "text",
  inputClassName = "",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const next = type === "number" ? (draft === "" ? 0 : parseFloat(draft) || 0) : draft;
    if (next !== value) onChange(next);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        placeholder={placeholder}
        className={`w-full text-sm text-slate-800 border border-indigo-500 rounded px-2 py-1 bg-white focus:outline-none ${inputClassName}`}
      />
    );
  }

  const display = value !== "" && value != null && value !== 0 ? `${value}${suffix}` : null;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left w-full text-sm text-slate-800 hover:bg-slate-100 rounded px-2 py-1 -mx-2 transition group"
      title="클릭하여 수정"
    >
      {display ?? (
        <span className="text-slate-400 group-hover:text-slate-500">— {placeholder}</span>
      )}
    </button>
  );
}
