// 대중교통 영수증 인라인 편집. focus 유지 — controlled input + 안정적 key(r.id).

export function ReceiptEditor({ receipts, onChange }) {
  const update = (id, patch) =>
    onChange(receipts.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id) => onChange(receipts.filter((r) => r.id !== id));
  const add = () => {
    const nextId = receipts.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    onChange([...receipts, { id: nextId, label: "", amount: 0 }]);
  };

  return (
    <div className="ml-11 mt-0.5 mb-2 p-2.5 border border-dashed border-slate-200 rounded-md bg-white">
      {receipts.map((r) => (
        <div
          key={r.id}
          className="grid items-center gap-1.5 py-0.5"
          style={{ gridTemplateColumns: "1fr 110px 18px 26px" }}
        >
          <input
            type="text"
            value={r.label}
            placeholder="영수증 설명 (예: KTX 포항→서울)"
            className="text-xs px-1.5 py-1 rounded border border-transparent bg-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-200 focus:bg-white focus:border-indigo-600 focus:outline-none w-full min-w-0"
            onChange={(e) => update(r.id, { label: e.target.value })}
          />
          <input
            type="number"
            value={r.amount}
            min={0}
            step={100}
            className="text-xs text-right px-1.5 py-1 rounded border border-slate-200 tabular font-semibold text-slate-900 bg-white focus:border-indigo-600 focus:outline-none w-full"
            onChange={(e) => update(r.id, { amount: parseInt(e.target.value) || 0 })}
          />
          <span className="text-[10px] text-slate-500">원</span>
          <button
            type="button"
            onClick={() => remove(r.id)}
            title="삭제"
            className="w-[22px] h-[22px] grid place-items-center text-slate-400 hover:bg-red-50 hover:text-red-600 rounded text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full mt-1.5 px-2 py-1.5 text-[11.5px] font-medium text-indigo-600 border border-dashed border-indigo-200 rounded-md bg-white hover:bg-indigo-50 hover:border-indigo-600 hover:border-solid transition"
      >
        + 영수증 추가
      </button>
    </div>
  );
}
