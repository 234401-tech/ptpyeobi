import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, FolderTree, Settings as SettingsIcon } from "lucide-react";
import { Header } from "../../components/Header.jsx";

const TABS = [
  { to: "/admin/ledger", label: "출장대장", icon: FileSpreadsheet },
  { to: "/admin/biz-systems", label: "사업명·시스템", icon: FolderTree },
  { to: "/admin/settings", label: "설정·사용자", icon: SettingsIcon },
];

export function AdminLayout({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} onLogout={onLogout} />

      <div className="max-w-[1400px] mx-auto px-6 pt-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-[11px] text-slate-500 hover:text-indigo-700 inline-flex items-center gap-1"
            >
              <ArrowLeft size={11} /> 정산 화면으로
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-sm font-semibold text-slate-800">CMS · 관리자 페이지</h1>
          </div>
        </div>

        <nav className="flex items-center gap-1 border-b border-slate-200">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 -mb-px transition ${
                  isActive
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`
              }
            >
              <Icon size={13} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="max-w-[1400px] mx-auto px-6 py-5">
        <Outlet />
      </main>
    </div>
  );
}
