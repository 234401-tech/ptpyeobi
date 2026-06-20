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

function buildPlainText(rows, breakdown) {
  const head = ["성명", "교통비", "일비", "숙박비", "식비", "계"].join("\t");
  const body = rows
    .map((r) =>
      [r.name, dash(r.transport), dash(r.perDiem), dash(r.lodge), dash(r.meal), fmt(r.total)].join(
        "\t"
      )
    )
    .join("\n");
  return `※지급내역(주관부서 작성)\n${head}\n${body}\n\n※산출내역\n${breakdown}`;
}

function buildHtml(rows, breakdown) {
  const cell =
    'style="border:1px solid #999; padding:6px 10px; text-align:center; font-family:맑은 고딕,Malgun Gothic,sans-serif;"';
  const cellR = cell.replace("center", "right");
  const head = `
<tr>
  <th ${cell}>성 명</th>
  <th ${cell}>교통비</th>
  <th ${cell}>일 비</th>
  <th ${cell}>숙박비</th>
  <th ${cell}>식 비</th>
  <th ${cell}>계</th>
</tr>`;
  const body = rows
    .map(
      (r) => `
<tr>
  <td ${cell}>${r.name}</td>
  <td ${cellR}>${dash(r.transport)}</td>
  <td ${cellR}>${dash(r.perDiem)}</td>
  <td ${cellR}>${dash(r.lodge)}</td>
  <td ${cellR}>${dash(r.meal)}</td>
  <td ${cellR}>${fmt(r.total)}</td>
</tr>`
    )
    .join("");
  const escBreakdown = breakdown
    .split("\n")
    .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;"))
    .join("<br/>");
  return `<div style="font-family:맑은 고딕,Malgun Gothic,sans-serif">
<p><b>※지급내역(주관부서 작성)</b></p>
<table style="border-collapse:collapse">${head}${body}</table>
<p style="margin-top:12px"><b>※산출내역</b></p>
<div>${escBreakdown}</div>
</div>`;
}

async function copyBoth(text, html) {
  // 1순위: ClipboardItem — text/plain + text/html 동시 (그룹웨어가 표로 인식)
  if (navigator.clipboard && window.ClipboardItem) {
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
  // 2순위: writeText
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // fall through
  }
  // 3순위: execCommand (focus 없어도 동작, 일부 브라우저)
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
  const [copied, setCopied] = useState(false);
  const rows = buildRows({ current, calc, companionNames });
  const breakdown = buildBreakdown({ current, state, calc });

  const onCopy = async () => {
    const text = buildPlainText(rows, breakdown);
    const html = buildHtml(rows, breakdown);
    try {
      await copyBoth(text, html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      alert(`복사 실패: ${e.message}`);
    }
  };

  return (
    <Card>
      <CardHeader
        num={3}
        title="지급내역 (그룹웨어 복사용)"
        right={
          <button
            type="button"
            onClick={onCopy}
            className="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {copied ? (
              <>
                <Check size={13} /> 복사됨
              </>
            ) : (
              <>
                <Copy size={13} /> 표·산출내역 복사
              </>
            )}
          </button>
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
                return (
                  <tr key={i} className="border-t border-slate-300 text-center">
                    <td className="border-r border-slate-300 py-1.5 px-2">
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
                    <td className="border-r border-slate-300 py-1.5 px-2 text-right tabular">
                      {dash(r.transport)}
                    </td>
                    <td className="border-r border-slate-300 py-1.5 px-2 text-right tabular">
                      {dash(r.perDiem)}
                    </td>
                    <td className="border-r border-slate-300 py-1.5 px-2 text-right tabular">
                      {dash(r.lodge)}
                    </td>
                    <td className="border-r border-slate-300 py-1.5 px-2 text-right tabular">
                      {dash(r.meal)}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular font-semibold">{fmt(r.total)}</td>
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

        <p className="text-[11px] text-slate-400 mt-2">
          ⓘ "표·산출내역 복사" 누른 뒤 그룹웨어 결재 본문에 붙여넣으세요. 한글·엑셀에는 표 형식
          그대로, 그 외 에디터에는 탭 구분 텍스트로 들어갑니다.
        </p>
      </div>
    </Card>
  );
}
