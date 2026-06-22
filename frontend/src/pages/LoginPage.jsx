import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogIn, Loader2 } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";

export function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || "/";

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("아이디와 비밀번호를 입력하세요");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onLogin(username, password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message || "로그인 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-block mb-3">
            <Logo size={56} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">여비뚝딱</h1>
          <p className="text-xs text-slate-500 mt-1">여비정산 도구 · 예산담당자 전용</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="mb-3">
            <label className="block text-xs text-slate-600 font-medium mb-1">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
              placeholder="admin"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs text-slate-600 font-medium mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
              placeholder="••••••"
            />
          </div>
          {error && (
            <div className="text-[11.5px] text-red-700 bg-red-50 border border-red-100 rounded px-2.5 py-1.5 mb-3">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            {busy ? "로그인 중…" : "로그인"}
          </button>
        </form>

        <p className="text-[10.5px] text-slate-400 text-center mt-4">
          ⓘ 비밀번호를 잊으셨나요? 관리자에게 임시 비밀번호 발급을 요청하세요.
        </p>
      </div>
    </div>
  );
}
