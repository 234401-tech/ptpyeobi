import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { compute } from "../lib/compute.js";
import { MOCK_CURRENT, MOCK_RECEIPTS } from "../lib/mockData.js";

const FUEL_RANGE = { from: "2026-05-14", to: "2026-05-27" };

export function useTravelExpense() {
  const [current, setCurrent] = useState(MOCK_CURRENT);
  const [uploadId, setUploadId] = useState(null);

  // 정산 입력 상태
  const [state, _setState] = useState({
    mode: "self_drive",
    companions: 0,
    mealsProvided: 0,
    nights: 0,
    region: "metro",
    publicReceipts: MOCK_RECEIPTS,
  });
  const setState = (patch) => _setState((s) => ({ ...s, ...patch }));

  // 서버 데이터
  const [ledger, setLedger] = useState([]);
  const [fuelPrices, setFuelPrices] = useState([]);
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
      const prices = await api.opinetPrices(FUEL_RANGE.from, FUEL_RANGE.to);
      setFuelPrices(prices);
    } catch (e) {
      setError(`유가 로드 실패: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    loadLedger();
    loadFuel();
  }, [loadLedger, loadFuel]);

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

  // 업로드 + OCR 추출
  const pickFile = useCallback(async (file) => {
    setBusy((b) => ({ ...b, upload: true, extract: true }));
    setError(null);
    try {
      const up = await api.uploadFile(file);
      setUploadId(up.upload_id);
      setCurrent((c) => ({ ...c, file: up.filename }));
      const ex = await api.extract(up.upload_id);
      // 추출 결과를 current/state 에 반영
      setCurrent((c) => ({
        ...c,
        file: up.filename,
        traveler: ex.traveler ?? c.traveler,
        dept: ex.dept ?? c.dept,
        date: ex.trip_date ?? c.date,
        dateLabel: ex.trip_date ? ex.trip_date.replaceAll("-", ".") : c.dateLabel,
        time: ex.depart_time && ex.return_time ? `${ex.depart_time} ~ ${ex.return_time}` : c.time,
        place: ex.place ?? c.place,
        distance: ex.distance_km ?? c.distance,
      }));
      if (ex.mode_suggested) setState({ mode: ex.mode_suggested });
      if (ex.public_receipts?.length) {
        setState({
          publicReceipts: ex.public_receipts.map((r, i) => ({
            id: i + 1,
            label: r.label,
            amount: r.amount,
          })),
        });
      }
    } catch (e) {
      setError(`업로드/추출 실패: ${e.message}`);
    } finally {
      setBusy((b) => ({ ...b, upload: false, extract: false }));
    }
  }, []);

  const clearFile = useCallback(() => {
    setUploadId(null);
    setCurrent((c) => ({ ...c, file: "" }));
  }, []);

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
    state,
    setState,
    calc,
    ledger,
    fuelPrices,
    justAddedNo,
    query,
    setQuery,
    busy,
    error,
    pickFile,
    clearFile,
    addToLedger,
  };
}
