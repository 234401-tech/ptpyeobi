import {
  Fuel,
  Hash,
  Train,
  Receipt as ReceiptIcon,
  Banknote,
  Bed,
  Car,
  Users,
  Bus,
} from "lucide-react";
import { Card, CardHeader } from "./ui/Card.jsx";
import { Counter } from "./ui/Counter.jsx";
import { CalcRow } from "./ui/CalcRow.jsx";
import { EditableField } from "./ui/EditableField.jsx";
import { ReceiptEditor } from "./ReceiptEditor.jsx";
import { TRIP_MODES, REGION_RATES, fmt } from "../lib/constants.js";

const MODE_ICON = {
  self_drive: <Car size={15} />,
  self_passenger: <Users size={15} />,
  company_car: <Bus size={15} />,
  public_transit: <Train size={14} />,
};

function Label({ children }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
      {children}
    </span>
  );
}

export function CalculationCard({ current, setCurrentField, state, setState, setCompanionNames, calc }) {
  const {
    mode,
    companions,
    mealsProvided,
    nights,
    region,
    publicReceipts,
  } = state;

  const halfReason = calc.isPassenger ? "동승" : "공용차량";

  return (
    <Card>
      <CardHeader
        num={2}
        title="자동 추출 · 자동 계산"
        right={
          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
            AI 신뢰도 96%
          </span>
        }
      />

      {/* 출장자 / 일시 / 지 / 거리 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 border-b border-slate-100">
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500 mb-1">출장자</div>
          <EditableField
            value={
              current.traveler
                ? `${current.traveler}${current.dept ? ` (${current.dept})` : ""}`
                : ""
            }
            onChange={(v) => {
              const m = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(v);
              setCurrentField(m ? { traveler: m[1].trim(), dept: m[2].trim() } : { traveler: v });
            }}
            placeholder="출장자 이름 (부서)"
          />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500 mb-1">출장일시</div>
          <EditableField
            value={`${current.dateLabel || ""} ${current.time || ""}`.trim()}
            onChange={(v) => {
              const m = /^(\S+)\s+(.+)$/.exec(v.trim());
              setCurrentField(
                m
                  ? { dateLabel: m[1], date: m[1].replaceAll(".", "-"), time: m[2] }
                  : { dateLabel: v.trim(), date: v.trim().replaceAll(".", "-"), time: "" }
              );
            }}
            placeholder="2026.05.22 13:00 ~ 18:00"
          />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500 mb-1">
            동승자
            {state.companionNames.length > 0 && (
              <span className="ml-1.5 text-amber-700 normal-case tracking-normal font-medium">
                · {state.companionNames.length}명 (일비 50% 적용)
              </span>
            )}
          </div>
          <EditableField
            value={state.companionNames.join(", ")}
            onChange={(v) => {
              const names = v
                .split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean);
              setCompanionNames(names);
            }}
            placeholder="동승자1, 동승자2 (콤마로 구분)"
          />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500 mb-1">이동거리</div>
          <EditableField
            value={current.distance || ""}
            onChange={(v) => setCurrentField({ distance: Number(v) || 0 })}
            placeholder="거리 km"
            suffix=" km"
            type="number"
          />
        </div>
        <div className="col-span-2">
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500 mb-1">출장지</div>
          <EditableField
            value={current.place || ""}
            onChange={(v) => setCurrentField({ place: v })}
            placeholder="출장지 (방문기관)"
          />
        </div>
      </div>

      {/* 출장 유형 */}
      <div className="px-5 py-4 border-b border-slate-100">
        <Label>출장 유형</Label>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TRIP_MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setState({ mode: m.id })}
                className={`text-left p-2.5 rounded-lg border transition ${
                  active
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-400"
                }`}
              >
                <span className={active ? "text-white" : "text-slate-500"}>{MODE_ICON[m.id]}</span>
                <div className="text-xs font-semibold mt-1.5">{m.label}</div>
                <div className={`text-[10px] mt-0.5 ${active ? "text-white/75" : "text-slate-500"}`}>
                  {m.hint}
                </div>
              </button>
            );
          })}
        </div>
        {(calc.isDriver || calc.isPassenger) && (
          <div className="mt-3 flex items-center gap-3 text-xs flex-wrap">
            <Label>동승자</Label>
            <Counter
              value={companions}
              onChange={(v) => setState({ companions: v })}
              min={0}
              max={9}
            />
            <span className="text-slate-500">명</span>
            {companions > 0 && (
              <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">
                ⓘ 동승자({companions}명)는 각자 '자가차량 동승'으로 별도 정산
              </span>
            )}
          </div>
        )}
      </div>

      {/* 숙박 */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <Label>숙박</Label>
        <Counter value={nights} onChange={(v) => setState({ nights: v })} min={0} max={30} />
        <span className="text-xs text-slate-500">박</span>
        <select
          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white disabled:bg-slate-50 disabled:text-slate-400"
          value={region}
          disabled={nights === 0}
          onChange={(e) => setState({ region: e.target.value })}
        >
          {Object.entries(REGION_RATES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label} · {fmt(v.rate)}원/박
            </option>
          ))}
        </select>
        {nights > 0 && (
          <span className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
            영수증 실비 첨부 시 상한액 내 실비 적용
          </span>
        )}
      </div>

      {/* 자동 산정 */}
      <div className="px-5 py-4 bg-slate-50/40">
        <Label>자동 산정</Label>
        <div className="mt-2 flex flex-col gap-1">
          <CalcRow
            icon={<Fuel size={14} />}
            label="유류비"
            formula={
              calc.isDriver
                ? `${current.distance} km × ${fmt(current.fuelPrice)}원/L ÷ 11.97`
                : calc.isPassenger
                ? "자가차량 동승 → 미지급 (운전자에게만 지급)"
                : calc.isCompanyCar
                ? "공용차량 → 자동차운임 미지급"
                : "대중교통 → 운임은 아래 '대중교통비' 라인에서 지급"
            }
            hint={calc.isDriver ? "오파넷 보통휘발유 평균가 · 10원 절사" : null}
            amount={calc.fuelCost}
            zero={!calc.isDriver}
          />
          <CalcRow
            icon={<Hash size={14} />}
            label="톨게이트"
            formula={
              calc.isDriver
                ? calc.tollSum === 0
                  ? "통행료 무료 구간"
                  : "하이패스 영수증 합계"
                : "해당 없음"
            }
            amount={calc.tollSum}
            zero
          />
          {calc.isPublic && (
            <>
              <CalcRow
                icon={<Train size={14} />}
                label="대중교통비"
                formula={`영수증 ${publicReceipts.length}건 · 실비 합계`}
                hint="✏️ OCR이 잘못 인식한 경우 아래에서 바로 수정하세요"
                amount={calc.publicCost}
                zero={calc.publicCost === 0}
              />
              <ReceiptEditor
                receipts={publicReceipts}
                onChange={(rs) => setState({ publicReceipts: rs })}
              />
            </>
          )}

          {/* 식비 (인라인 카운터) */}
          <CalcRow
            icon={<ReceiptIcon size={14} />}
            label="식비"
            amount={calc.mealCost}
            zero={calc.mealCost === 0}
          >
            <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500 mono">
              <span>기본 {current.days * 3}식</span>
              <span>−</span>
              <span>제공받음</span>
              <Counter
                value={mealsProvided}
                onChange={(v) => setState({ mealsProvided: v })}
                min={0}
                max={current.days * 3}
              />
              <span>식</span>
              <span className="text-slate-300">→</span>
              <span className="text-slate-700 font-semibold">{calc.billedMeals}식 지급</span>
            </div>
          </CalcRow>

          <CalcRow
            icon={<Banknote size={14} />}
            label="일비"
            formula={
              calc.halfPerDiem
                ? `25,000원 × ${current.days}일 × 50% (${halfReason})`
                : `25,000원 × ${current.days}일`
            }
            amount={calc.perDiem}
            badge={calc.halfPerDiem ? "50% 적용" : null}
          />

          <CalcRow
            icon={<Bed size={14} />}
            label="숙박비"
            formula={
              nights > 0
                ? `${calc.regionInfo.label} ${fmt(calc.regionInfo.rate)}원 × ${nights}박`
                : "0박 · 미지급"
            }
            amount={calc.lodgeCost}
            zero={calc.lodgeCost === 0}
          />
        </div>

        {/* 합계 */}
        <div className="mt-4 pt-4 border-t-2 border-slate-300 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">정산 합계</div>
            <div className="text-[11px] text-slate-500 mt-0.5 mono">
              {[
                calc.fuelCost && `유류 ${fmt(calc.fuelCost)}`,
                calc.tollSum && `톨게이트 ${fmt(calc.tollSum)}`,
                calc.publicCost && `교통 ${fmt(calc.publicCost)}`,
                calc.mealCost && `식비 ${fmt(calc.mealCost)}`,
                calc.perDiem && `일비 ${fmt(calc.perDiem)}`,
                calc.lodgeCost && `숙박 ${fmt(calc.lodgeCost)}`,
              ]
                .filter(Boolean)
                .join(" + ")}
            </div>
          </div>
          <div className="text-4xl font-bold text-indigo-700 tabular leading-tight">
            {fmt(calc.total)}
            <span className="text-base text-slate-500 font-normal ml-1">원</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
