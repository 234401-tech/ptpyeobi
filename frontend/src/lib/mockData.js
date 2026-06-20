// 초기 화면 데이터 (백엔드 가동 전에도 화면이 보이도록).
// Phase 4의 useTravelExpense 가 마운트 시 백엔드를 호출해 실데이터로 교체.

export const MOCK_CURRENT = {
  file: "출장증빙_김승모_20260521.pdf",
  traveler: "김승모",
  dept: "AI융합산업팀",
  date: "2026-05-21",
  dateLabel: "2026.05.21",
  time: "14:00 ~ 17:00",
  place: "대구(테이큰소프트)",
  distance: 139,
  fuelPrice: 2063,
  title: "(05.21/대구) 테이큰소프트 업무미팅",
  biz: "재단운영비",
  fund: "통장",
  days: 1,
};

export const MOCK_RECEIPTS = [
  { id: 1, label: "KTX 포항→서울 (04.09 어른 1매)", amount: 53600 },
  { id: 2, label: "KTX 서울→포항 (04.09 어른 1매)", amount: 53900 },
];
