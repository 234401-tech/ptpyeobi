export function Counter({ value, onChange, min = 0, max = 99 }) {
  const clamp = (v) => Math.max(min, Math.min(max, v));
  return (
    <div className="inline-flex items-center border border-slate-300 rounded bg-white overflow-hidden">
      <button
        type="button"
        className="w-6 h-6 grid place-items-center text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed text-base leading-none"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
      >
        −
      </button>
      <span className="w-7 text-center text-xs font-semibold text-slate-800 border-x border-slate-200 py-0.5 tabular">
        {value}
      </span>
      <button
        type="button"
        className="w-6 h-6 grid place-items-center text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed text-base leading-none"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
