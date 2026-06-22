import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Header } from "./components/Header.jsx";
import { UploadCard } from "./components/UploadCard.jsx";
import { CalculationCard } from "./components/CalculationCard.jsx";
import { PayoutSummary } from "./components/PayoutSummary.jsx";
import { FuelPriceCard } from "./components/FuelPriceCard.jsx";
import { LedgerCard } from "./components/LedgerCard.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { AdminLayout } from "./pages/admin/AdminLayout.jsx";
import { AdminLedgerPage } from "./pages/admin/AdminLedgerPage.jsx";
import { AdminBizSystemPage } from "./pages/admin/AdminBizSystemPage.jsx";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage.jsx";
import { useTravelExpense } from "./hooks/useTravelExpense.js";
import { useAuth } from "./hooks/useAuth.js";
import { setUnauthorizedHandler } from "./lib/api.js";

// 메인 정산 화면 (기존 App 본문)
function MainPage({ user, onLogout }) {
  const t = useTravelExpense();
  return (
    <div className="min-h-screen">
      <Header user={user} onLogout={onLogout} />
      {t.error && (
        <div className="max-w-[1400px] mx-auto px-6 pt-3">
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {t.error}
          </div>
        </div>
      )}
      <main className="max-w-[1400px] mx-auto p-6 grid gap-5 xl:grid-cols-[7fr_5fr] xl:items-start">
        <section className="flex flex-col gap-4">
          <UploadCard
            uploads={t.uploads}
            onPickFiles={t.pickFiles}
            onRemove={t.removeUpload}
            busy={t.busy.upload || t.busy.extract}
          />
          <CalculationCard
            current={t.current}
            setCurrentField={t.setCurrentField}
            state={t.state}
            setState={t.setState}
            setCompanionNames={t.setCompanionNames}
            calc={t.calc}
            setOverride={t.setOverride}
            onReset={t.resetForm}
          />
          <PayoutSummary
            current={t.current}
            state={t.state}
            calc={t.calc}
            companionNames={t.state.companionNames}
            onCompanionNames={t.setCompanionNames}
          />
        </section>
        <aside className="flex flex-col gap-4">
          <FuelPriceCard
            prices={t.fuelPrices}
            currentDate={t.current.date}
            currentPrice={t.current.fuelPrice}
            hasLive={t.opinetLive}
            onRefresh={t.refreshFuel}
            busy={t.busy.fuel}
          />
          <LedgerCard
            ledger={t.ledger}
            justAddedNo={t.justAddedNo}
            query={t.query}
            onQuery={t.setQuery}
            current={t.current}
            setCurrentField={t.setCurrentField}
            pendingTotal={t.calc.total}
            onAdd={t.addToLedger}
            busy={t.busy.add}
            onUpdateRow={t.updateLedgerRow}
            onDeleteRow={t.deleteLedgerRow}
            onReset={t.resetForm}
            bizMap={t.bizMap}
          />
        </aside>
      </main>
    </div>
  );
}

// 토큰 없으면 /login 으로 보냄. 로딩 중엔 빈 화면.
function RequireAuth({ user, ready, children }) {
  const loc = useLocation();
  if (!ready) return <div className="min-h-screen grid place-items-center text-xs text-slate-400">로딩 중…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

// 401 을 받았을 때 router 의 navigate 와 연결 — api.js 에서 호출됨.
function UnauthorizedBridge({ onUnauthorized }) {
  const navigate = useNavigate();
  useEffect(() => {
    onUnauthorized(() => navigate("/login", { replace: true }));
  }, [navigate, onUnauthorized]);
  return null;
}

export default function App() {
  const auth = useAuth();

  return (
    <BrowserRouter>
      <UnauthorizedBridge
        onUnauthorized={(fn) => {
          setUnauthorizedHandler(() => {
            auth.logout();
            fn();
          });
        }}
      />
      <Routes>
        <Route
          path="/login"
          element={
            auth.user ? <Navigate to="/" replace /> : <LoginPage onLogin={auth.login} />
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth user={auth.user} ready={auth.ready}>
              <MainPage user={auth.user} onLogout={auth.logout} />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth user={auth.user} ready={auth.ready}>
              <AdminLayout user={auth.user} onLogout={auth.logout} />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="ledger" replace />} />
          <Route path="ledger" element={<AdminLedgerPage />} />
          <Route path="biz-systems" element={<AdminBizSystemPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
