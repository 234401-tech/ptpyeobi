import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { compute } from "../lib/compute.js";
import { MOCK_CURRENT, MOCK_RECEIPTS } from "../lib/mockData.js";

function recentFuelRange() {
  // 캐시에 누적된 모든 유가를 함께 보여주기 위해 넉넉히 60일.
  // 오파넷은 그중 최근 7일치만 실제로 보내주고, 나머지 날짜는 DB 캐시에서 hit.
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 60);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(today) };
}

export function useTravelExpense() {
  const [current, setCurrent] = useState(MOCK_CURRENT);
  const setCurrentField = (patch) => setCurrent((c) => ({ ...c, ...patch }));
  // 업로드된 증빙 N개 — { id, filename, previewUrl, busy, error }
  const [uploads, setUploads] = useState([]);

  // 정산 입력 상태
  const [state, _setState] = useState({
    mode: "self_drive",
    companions: 0,
    companionNames: [],
    mealsProvided: 0,
    nights: 0,
    region: "metro",
    publicReceipts: MOCK_RECEIPTS,
  });
  const setState = (patch) =>
    _setState((s) => {
      const next = { ...s, ...patch };
      // 동승자 카운터(companions)와 이름 배열(companionNames) 길이 동기화
      if ("companions" in patch) {
        const cur = s.companionNames;
        const n = next.companions;
        next.companionNames =
          n > cur.length
            ? [...cur, ...Array(n - cur.length).fill("")]
            : cur.slice(0, n);
      }
      return next;
    });
  const setCompanionNames = (names) =>
    _setState((s) => ({ ...s, companionNames: names, companions: names.length }));

  // 서버 데이터
  const [ledger, setLedger] = useState([]);
  const [fuelPrices, setFuelPrices] = useState([]);
  const [opinetLive, setOpinetLive] = useState(false);
  const [justAddedNo, setJustAddedNo] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState({ upload: false, extract: false, add: false });
  const [error, setError] = useState(null);

  // 초기 로드: 대장 + 유가
  const loadLedger = useCallback(async () => {
    try {
      const trips = await api.listTrips();
      setLedger(trips);
    } catch (e) {
      setError(`대장 로드 실패: ${e.message}`);
    }
  }, []);

  const loadFuel = useCallback(async () => {
    try {
      const { from, to } = recentFuelRange();
      const prices = await api.opinetPrices(from, to);
      setFuelPrices(prices);
      // 받아온 데이터의 최신 날짜가 오늘 기준 7일 이내면 라이브로 간주
      if (prices.length) {
        const latest = new Date(prices[0].date);
        const ageDays = (Date.now() - latest.getTime()) / 86400000;
        setOpinetLive(ageDays <= 7);
      } else {
        setOpinetLive(false);
      }
    } catch (e) {
      setError(`유가 로드 실패: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    loadLedger();
    loadFuel();
  }, [loadLedger, loadFuel]);

  // 출장일과 오파넷 캐시 자동 매칭 → 유가 자동 적용
  useEffect(() => {
    if (!current.date || !fuelPrices.length) return;
    const match = fuelPrices.find((p) => p.date === current.date);
    if (match && match.price !== current.fuelPrice) {
      setCurrent((c) => ({ ...c, fuelPrice: match.price }));
    }
  }, [current.date, current.fuelPrice, fuelPrices]);

  // 파생 — 정산 결과
  const calc = useMemo(
    () =>
      compute({
        mode: state.mode,
        days: current.days,
        distanceKm: current.distance,
        fuelPrice: current.fuelPrice,
        nights: state.nights,
        region: state.region,
        mealsProvided: state.mealsProvided,
        publicReceipts: state.publicReceipts,
      }),
    [state, current]
  );

  // 다중 업로드 — 한 번에 한 파일씩 누적. 새 파일이 OCR로 잡은 빈 필드만 채우고 영수증은 합침.
  const pickFile = useCallback(async (file) => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isImage = /\.(png|jpe?g)$/i.test(file.name || "");
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    setUploads((arr) => [
      ...arr,
      { id: tempId, filename: file.name || "untitled", previewUrl, busy: true },
    ]);
    setBusy((b) => ({ ...b, upload: true, extract: true }));
    setError(null);
    try {
      const up = await api.uploadFile(file);
      const ex = await api.extract(up.upload_id);
      setUploads((arr) =>
        arr.map((x) => (x.id === tempId ? { ...x, id: up.upload_id, busy: false } : x))
      );
      // 빈 필드만 채움 (먼저 추출된 값 우선)
      setCurrent((c) => ({
        ...c,
        file: c.file || up.filename,
        traveler: c.traveler || ex.traveler || "",
        dept: c.dept || ex.dept || "",
        date: c.date || ex.trip_date || "",
        dateLabel: c.dateLabel || (ex.trip_date ? ex.trip_date.replaceAll("-", ".") : ""),
        time:
          c.time ||
          (ex.depart_time && ex.return_time ? `${ex.depart_time} ~ ${ex.return_time}` : ""),
        place: c.place || ex.place || "",
        distance: c.distance || ex.distance_km || 0,
      }));
      if (ex.mode_suggested) setState({ mode: ex.mode_suggested });
      if (ex.public_receipts?.length) {
        _setState((s) => {
          const existingKeys = new Set(
            s.publicReceipts.map((r) => `${r.label}|${r.amount}`)
          );
          const baseId = s.publicReceipts.reduce((m, r) => Math.max(m, r.id), 0);
          const added = ex.public_receipts
            .filter((r) => !existingKeys.has(`${r.label}|${r.amount}`))
            .map((r, i) => ({ id: baseId + i + 1, label: r.label, amount: r.amount }));
          return { ...s, publicReceipts: [...s.publicReceipts, ...added] };
        });
      }
    } catch (e) {
      setError(`업로드/추출 실패: ${e.message}`);
      setUploads((arr) =>
        arr.map((x) => (x.id === tempId ? { ...x, busy: false, error: e.message } : x))
      );
    } finally {
      setBusy((b) => ({ ...b, upload: false, extract: false }));
    }
  }, []);

  const pickFiles = useCallback(
    (files) => {
      Array.from(files).forEach((f) => pickFile(f));
    },
    [pickFile]
  );

  const removeUpload = useCallback((id) => {
    setUploads((arr) => {
      const target = arr.find((x) => x.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return arr.filter((x) => x.id !== id);
    });
  }, []);

  const clearFile = useCallback(() => {
    setUploads((arr) => {
      arr.forEach((x) => x.previewUrl && URL.revokeObjectURL(x.previewUrl));
      return [];
    });
    setCurrent((c) => ({ ...c, file: "" }));
  }, []);

  // 글로벌 클립보드 paste — 캡처 이미지 자동 업로드 (input/textarea 입력 중에는 무시)
  useEffect(() => {
    const onPaste = (e) => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type?.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const ext = item.type.split("/")[1] || "png";
            const named = new File([file], `paste-${Date.now()}.${ext}`, { type: file.type });
            pickFile(named);
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pickFile]);

  // 대장에 추가
  const addToLedger = useCallback(async () => {
    setBusy((b) => ({ ...b, add: true }));
    setError(null);
    try {
      const body = {
        traveler_name: current.traveler,
        dept: current.dept,
        trip_date: current.date,
        depart_time: current.time?.split("~")[0]?.trim() || null,
        return_time: current.time?.split("~")[1]?.trim() || null,
        days: current.days,
        place: current.place,
        distance_km: current.distance,
        mode: state.mode,
        companions: state.companions,
        fuel_price: current.fuelPrice,
        fuel_cost: calc.fuelCost,
        toll_sum: calc.tollSum,
        public_cost: calc.publicCost,
        meals_provided: state.mealsProvided,
        meal_cost: calc.mealCost,
        per_diem: calc.perDiem,
        nights: state.nights,
        region: state.region,
        lodge_cost: calc.lodgeCost,
        total: calc.total,
        title: current.title,
        biz_name: current.biz,
        fund_system: current.fund,
        status: "확정",
        fund_date: null,
        public_receipts: calc.isPublic
          ? state.publicReceipts.map((r) => ({ label: r.label, amount: r.amount }))
          : [],
      };
      const created = await api.createTrip(body);
      setLedger((rs) => [created, ...rs]);
      setJustAddedNo(created.no);
      setTimeout(() => setJustAddedNo(null), 2400);
    } catch (e) {
      setError(`저장 실패: ${e.message}`);
    } finally {
      setBusy((b) => ({ ...b, add: false }));
    }
  }, [current, state, calc]);

  return {
    current,
    setCurrentField,
    state,
    setState,
    setCompanionNames,
    calc,
    ledger,
    fuelPrices,
    opinetLive,
    justAddedNo,
    query,
    setQuery,
    busy,
    error,
    uploads,
    pickFile,
    pickFiles,
    removeUpload,
    clearFile,
    addToLedger,
  };
}
