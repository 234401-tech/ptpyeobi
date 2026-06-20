import { Header } from "./components/Header.jsx";
import { UploadCard } from "./components/UploadCard.jsx";
import { CalculationCard } from "./components/CalculationCard.jsx";
import { PayoutSummary } from "./components/PayoutSummary.jsx";
import { FuelPriceCard } from "./components/FuelPriceCard.jsx";
import { LedgerCard } from "./components/LedgerCard.jsx";
import { useTravelExpense } from "./hooks/useTravelExpense.js";

export default function App() {
  const t = useTravelExpense();

  return (
    <div className="min-h-screen">
      <Header />
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
            filename={t.current.file}
            onPick={t.pickFile}
            onClear={t.clearFile}
            busy={t.busy.upload || t.busy.extract}
          />
          <CalculationCard
            current={t.current}
            setCurrentField={t.setCurrentField}
            state={t.state}
            setState={t.setState}
            setCompanionNames={t.setCompanionNames}
            calc={t.calc}
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
          />
          <LedgerCard
            ledger={t.ledger}
            justAddedNo={t.justAddedNo}
            query={t.query}
            onQuery={t.setQuery}
            current={t.current}
            pendingTotal={t.calc.total}
            onAdd={t.addToLedger}
            busy={t.busy.add}
          />
        </aside>
      </main>
    </div>
  );
}
