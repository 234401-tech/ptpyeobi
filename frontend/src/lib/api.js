// 백엔드 API fetch wrapper. dev 서버 프록시(/api → 8000)로 동일 출처처럼 사용.

const BASE = "/api";

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch (_) {}
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/health"),

  calculate: (body) =>
    request("/calculate", { method: "POST", body: JSON.stringify(body) }),

  listTrips: ({ q, fund, month } = {}) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (fund) p.set("fund", fund);
    if (month) p.set("month", month);
    const qs = p.toString();
    return request(`/trips${qs ? `?${qs}` : ""}`);
  },
  createTrip: (body) =>
    request("/trips", { method: "POST", body: JSON.stringify(body) }),
  updateTrip: (id, body) =>
    request(`/trips/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTrip: (id) => request(`/trips/${id}`, { method: "DELETE" }),

  opinetPrices: (from, to) =>
    request(`/opinet/prices?from=${from}&to=${to}`),

  exportTripsXlsx: async ({ q, fund, month } = {}) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (fund) p.set("fund", fund);
    if (month) p.set("month", month);
    const qs = p.toString();
    const res = await fetch(`${BASE}/trips/export${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error(`다운로드 실패 ${res.status}`);
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const m = cd.match(/filename="?([^";]+)"?/);
    return { blob, filename: m?.[1] || "travel_ledger.xlsx" };
  },

  uploadFile: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/uploads`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`업로드 실패 ${res.status}`);
    return res.json();
  },
  extract: (uploadId) =>
    request(`/uploads/${uploadId}/extract`, { method: "POST" }),
};
