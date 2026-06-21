// 카드 ④ — 그룹웨어 결재 양식 "지급내역 + 산출내역" 미리보기 & 복사.

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card, CardHeader } from "./ui/Card.jsx";
import { fmt, REGION_RATES } from "../lib/constants.js";

const dash = (n) => (n > 0 ? fmt(n) : "-");

function buildRows({ current, calc, companionNames }) {
  // 본인 행
  const transport = calc.fuelCost + calc.tollSum + calc.publicCost;
  const me = {
    name: current.traveler,
    transport,
    perDiem: calc.perDiem,
    lodge: calc.lodgeCost,
    meal: calc.mealCost,
  };
  me.total = me.transport + me.perDiem + me.lodge + me.meal;

  // 동승자 행 — 일비 50%, 식비 동일, 교통비/숙박비 0 (별도 정산은 각자 등록)
  const halfPerDiem = Math.round(calc.perDiem / 2);
  const companions = companionNames.map((name) => {
    const row = {
      name: name || "",
      transport: 0,
      perDiem: halfPerDiem,
      lodge: 0,
      meal: calc.mealCost,
    };
    row.total = row.perDiem + row.meal;
    return row;
  });

  return [me, ...companions];
}

function buildBreakdown({ current, state, calc }) {
  const lines = [];

  // 교통비
  if (calc.isDriver && calc.fuelCost > 0) {
    lines.push("○ 교통비 산정 내역");
    lines.push(
      `- ${current.distance}km×${fmt(current.fuelPrice)}÷11.97=${fmt(calc.fuelCost)}원`
    );
    if (calc.tollSum > 0) lines.push(`- 톨게이트비 ${fmt(calc.tollSum)}원`);
  } else if (calc.isPublic && calc.publicCost > 0) {
    lines.push("○ 교통비 산정 내역");
    for (const r of state.publicReceipts) {
      if (r.amount > 0) lines.push(`- ${r.label || "영수증"} ${fmt(r.amount)}원`);
    }
  }

  // 식대
  if (state.mealsProvided > 0) {
    lines.push(`○ 식대 ${state.mealsProvided}식 제공`);
  } else if (calc.mealCost === 0) {
    lines.push("○ 식대 전부 제공");
  }

  // 일비 50% 적용
  if (calc.halfPerDiem) {
    const reason = calc.isPassenger ? "자가차량 동승" : "공용차량";
    lines.push(`○ 일비 50% 적용 (${reason})`);
  }

  // 숙박비
  if (state.nights > 0) {
    const info = REGION_RATES[state.region];
    lines.push(`○ 숙박비 ${info.label} ${fmt(info.rate)}원 × ${state.nights}박`);
  }

  return lines.join("\n");
}

// ──────────────────────── 지급내역 (TSV + 미니멀 HTML) ────────────────────────
// 두 형식을 동시에 클립보드에 등록 — 그룹웨어 종류별로 알맞은 쪽으로 매핑:
//   - 한글/엑셀, 표 매핑 지원 그룹웨어 → HTML 표를 셀별로 분배
//   - TSV만 인식하는 환경            → 탭 구분 평문으로 셀 이동
// 단 HTML 은 스타일/wrapper 없이 순수 <table><tr><td> 구조만 — 이전처럼 표 중첩되지 않게.

function buildPayoutCells(rows) {
  // [['김승모','-','25,000', ...], ...] 형태로 반환 — TSV / HTML / 셀 클릭 모두 공용
  return rows.map((r) => [
    r.name,
    dash(r.transport),
    dash(r.perDiem),
    dash(r.lodge),
    dash(r.meal),
    fmt(r.total),
  ]);
}

function buildPayoutText(rows) {
  return buildPayoutCells(rows)
    .map((cells) => cells.join("\t"))
    .join("\n");
}

function buildPayoutHtml(rows) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = buildPayoutCells(rows)
    .map(
      (cells) =>
        "<tr>" + cells.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>"
    )
    .join("");
  // 순수 표 구조만 — 외부에 <p> 같은 텍스트 wrapper 없음. 셀 자동 매핑이 쉽도록.
  return `<table><tbody>${body}</tbody></table>`;
}

// ──────────────────────── 산출내역 (평문) ────────────────────────

function buildBreakdownText(breakdown) {
  return breakdown;
}

// ──────────────────────── 클립보드 ────────────────────────

async function writeMixed(text, html) {
  // 1순위: text/plain + text/html 동시 등록 (그룹웨어가 표 매핑 시도)
  if (html && navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return true;
    } catch (_) {
      // fall through
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // fall through
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("클립보드 접근이 차단되어 있습니다");
  return true;
}

export function PayoutSummary({ current, state, calc, companionNames, onCompanionNames }) {
  // 버튼/셀별 "복사됨" 잔여 표시 — `payout` | `breakdown` | `cell:i:j`
  const [copiedKey, setCopiedKey] = useState(null);
  const rows = buildRows({ current, calc, companionNames });
  const breakdown = buildBreakdown({ current, state, calc });
  const cellsMatrix = buildPayoutCells(rows);

  const flash = (key) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
  };

  const onCopyPayout = async () => {
    try {
      await writeMixed(buildPayoutText(rows), buildPayoutHtml(rows));
      flash("payout");
    } catch (e) {
      alert(`복사 실패: ${e.message}`);
    }
  };
  const onCopyBreakdown = async () => {
    try {
      await writeMixed(buildBreakdownText(breakdown), null);
      flash("breakdown");
    } catch (e) {
      alert(`복사 실패: ${e.message}`);
    }
  };
  const onCopyCell = async (rowIdx, colIdx) => {
    const value = cellsMatrix[rowIdx]?.[colIdx] ?? "";
    if (value === "" || value === "-") return; // 빈/대시는 복사 의미 없음
    try {
      await writeMixed(String(value), null);
      flash(`cell:${rowIdx}:${colIdx}`);
    } catch (_) {}
  };

  const btnCls =
    "text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700";

  return (
    <Card>
      <CardHeader
        num={3}
        title="지급내역 (그룹웨어 복사용)"
        right={
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCopyPayout} className={btnCls}>
              {copiedKey === "payout" ? (
                <><Check size={13} /> 복사됨</>
              ) : (
                <><Copy size={13} /> 지급내역 복사</>
              )}
            </button>
            <button type="button" onClick={onCopyBreakdown} className={btnCls}>
              {copiedKey === "breakdown" ? (
                <><Check size={13} /> 복사됨</>
              ) : (
                <><Copy size={13} /> 산출내역 복사</>
              )}
            </button>
          </div>
        }
      />
      <div className="px-5 pb-5">
        {/* ※지급내역(주관부서 작성) */}
        <div className="text-xs text-slate-700 mb-1.5">
          <span className="font-semibold">※지급내역(주관부서 작성)</span>
        </div>
        <div className="border border-slate-300 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-center text-slate-600 font-medium">
                <th className="border-r border-slate-300 py-1.5 px-2">성 명</th>
                <th className="border-r border-slate-300 py-1.5 px-2">교통비</th>
                <th className="border-r border-slate-300 py-1.5 px-2">일 비</th>
                <th className="border-r border-slate-300 py-1.5 px-2">숙박비</th>
                <th className="border-r border-slate-300 py-1.5 px-2">식 비</th>
                <th className="py-1.5 px-2">계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isCompanion = i > 0;
                // 셀 데이터 — 클릭 복사용 (이름, 교통비, 일비, 숙박비, 식비, 계)
                const cellVals = [
                  r.name,
                  dash(r.transport),
                  dash(r.perDiem),
                  dash(r.lodge),
                  dash(r.meal),
                  fmt(r.total),
                ];
                const copyableCellCls = (j) =>
                  `cursor-pointer transition ${
                    copiedKey === `cell:${i}:${j}`
                      ? "bg-emerald-100 ring-1 ring-emerald-400"
                      : "hover:bg-indigo-50"
                  }`;
                const isEmpty = (v) => v === "" || v === "-";
                return (
                  <tr key={i} className="border-t border-slate-300 text-center">
                    <td
                      className={`border-r border-slate-300 py-1.5 px-2 ${
                        !isCompanion && !isEmpty(cellVals[0]) ? copyableCellCls(0) : ""
                      }`}
                      onClick={() => !isCompanion && onCopyCell(i, 0)}
                      title={!isCompanion && !isEmpty(cellVals[0]) ? "클릭해서 셀 값만 복사" : ""}
                    >
                      {isCompanion ? (
                        <input
                          type="text"
                          value={r.name}
                          placeholder="동승자 이름"
                          onChange={(e) => {
                            const next = [...companionNames];
                            next[i - 1] = e.target.value;
                            onCompanionNames(next);
                          }}
                          className="w-20 text-center text-xs border border-transparent rounded px-1 py-0.5 hover:bg-slate-50 hover:border-slate-200 focus:bg-white focus:border-indigo-600 focus:outline-none"
                        />
                      ) : (
                        <span>{r.name}</span>
                      )}
                    </td>
                    {[1, 2, 3, 4].map((j) => (
                      <td
                        key={j}
                        className={`border-r border-slate-300 py-1.5 px-2 text-right tabular ${
                          !isEmpty(cellVals[j]) ? copyableCellCls(j) : ""
                        }`}
                        onClick={() => onCopyCell(i, j)}
                        title={!isEmpty(cellVals[j]) ? "클릭해서 셀 값만 복사" : ""}
                      >
                        {cellVals[j]}
                      </td>
                    ))}
                    <td
                      className={`py-1.5 px-2 text-right tabular font-semibold ${copyableCellCls(5)}`}
                      onClick={() => onCopyCell(i, 5)}
                      title="클릭해서 셀 값만 복사"
                    >
                      {cellVals[5]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ※산출내역 */}
        <div className="text-xs text-slate-700 mt-4 mb-1.5">
          <span className="font-semibold">※산출내역</span>
        </div>
        <pre className="border border-slate-300 p-3 text-xs mono whitespace-pre-wrap text-slate-800 bg-slate-50/40">
{breakdown || "(산출 내역 없음)"}
        </pre>

        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
          ⓘ <b>지급내역 복사</b> 는 TSV·HTML 둘 다 클립보드에 넣습니다 — 그룹웨어 표의 첫 데이터 셀에 커서 두고 붙여넣으면 셀별로 자동 채워지는 환경이 많습니다.
          <br/>
          자동 분배가 안 되는 그룹웨어라면 위 미리보기 표의 <b>셀을 직접 클릭</b>하면 그 값만 복사돼요 → 결재창 셀에 한 번씩 붙여넣기.
        </p>
      </div>
    </Card>
  );
}
