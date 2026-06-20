export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ num, title, right }) {
  return (
    <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
      {num != null && (
        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white grid place-items-center text-xs font-bold">
          {num}
        </div>
      )}
      <div className="text-sm font-semibold">{title}</div>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}
