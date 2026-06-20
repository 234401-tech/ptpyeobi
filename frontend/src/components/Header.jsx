export function Header() {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 text-white grid place-items-center font-bold">
            뚝
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-semibold">
              여비뚝딱
            </div>
            <div className="text-sm font-semibold leading-tight">여비정산 도구</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            오파넷 유가 동기화
          </span>
          <span>·</span>
          <span>여비지급규정 v2025.06.24</span>
        </div>
      </div>
    </header>
  );
}
