import { LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "./ui/Logo.jsx";

export function Header({ user, onLogout }) {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80">
          <Logo size={36} />
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-semibold">
              여비뚝딱
            </div>
            <div className="text-sm font-semibold leading-tight">여비정산 도구</div>
          </div>
        </Link>
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            오파넷 유가 동기화
          </span>
          <span>·</span>
          <span>여비지급규정 v2025.06.24</span>
          {user && (
            <>
              <span className="mx-1 text-slate-300">|</span>
              <Link
                to="/admin"
                className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-700"
                title="CMS — 출장대장·사업명·설정"
              >
                <Settings size={12} /> CMS
              </Link>
              <span className="text-slate-700 font-medium">{user.username}</span>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600"
                title="로그아웃"
              >
                <LogOut size={12} /> 로그아웃
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
