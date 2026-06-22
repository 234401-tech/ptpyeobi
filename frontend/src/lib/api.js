// 백엔드 API fetch wrapper. dev 서버 프록시(/api → 8000)로 동일 출처처럼 사용.
// JWT 토큰은 localStorage 의 "auth_token" 에 저장 — 모든 요청에 자동 첨부.

const BASE = "/api";
const TOKEN_KEY = "auth_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// 401 받으면 자동으로 /login 으로 보냄. App 에서 이 핸들러를 router 와 연결.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function authHeaders(extra = {}) {
  const t = tokenStore.get();
  return t ? { Authorization: `Bearer ${t}`, ...extra } : extra;
}

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(opts.headers) },
    ...opts,
  });
  if (res.status === 401) {
    tokenStore.clear();
    onUnauthorized();
    throw new Error("401 로그인이 필요합니다");
  }
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
  bulkDeleteTrips: (ids) =>
    request(`/trips/bulk-delete`, { method: "POST", body: JSON.stringify({ ids }) }),

  opinetPrices: (from, to) =>
    request(`/opinet/prices?from=${from}&to=${to}`),
  opinetSync: () => request(`/opinet/sync`, { method: "POST" }),

  listBizSystems: () => request(`/biz-systems`),
  createBizSystem: (body) =>
    request(`/biz-systems`, { method: "POST", body: JSON.stringify(body) }),
  updateBizSystem: (id, body) =>
    request(`/biz-systems/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteBizSystem: (id) => request(`/biz-systems/${id}`, { method: "DELETE" }),

  // ─── admin ───
  adminListSettings: () => request(`/admin/settings`),
  adminUpdateSetting: (key, value) =>
    request(`/admin/settings`, { method: "PATCH", body: JSON.stringify({ key, value }) }),
  adminListUsers: () => request(`/admin/users`),
  adminCreateUser: (body) =>
    request(`/admin/users`, { method: "POST", body: JSON.stringify(body) }),
  adminUpdateUser: (id, body) =>
    request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  adminResetPassword: (id, new_password) =>
    request(`/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ new_password }) }),
  adminDeleteUser: (id) =>
    request(`/admin/users/${id}`, { method: "DELETE" }),

  exportTripsXlsx: async ({ q, fund, month } = {}) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (fund) p.set("fund", fund);
    if (month) p.set("month", month);
    const qs = p.toString();
    const res = await fetch(`${BASE}/trips/export${qs ? `?${qs}` : ""}`, {
      headers: authHeaders(),
    });
    if (res.status === 401) {
      tokenStore.clear();
      onUnauthorized();
      throw new Error("401 로그인이 필요합니다");
    }
    if (!res.ok) throw new Error(`다운로드 실패 ${res.status}`);
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const m = cd.match(/filename="?([^";]+)"?/);
    return { blob, filename: m?.[1] || "travel_ledger.xlsx" };
  },

  uploadFile: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/uploads`, {
      method: "POST",
      body: fd,
      headers: authHeaders(),
    });
    if (res.status === 401) {
      tokenStore.clear();
      onUnauthorized();
      throw new Error("401 로그인이 필요합니다");
    }
    if (!res.ok) throw new Error(`업로드 실패 ${res.status}`);
    return res.json();
  },
  extract: (uploadId) =>
    request(`/uploads/${uploadId}/extract`, { method: "POST" }),

  // ─── 인증 ───
  login: async (username, password) => {
    const fd = new URLSearchParams();
    fd.set("username", username);
    fd.set("password", password);
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: fd.toString(),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch (_) {}
      throw new Error(detail);
    }
    const { access_token } = await res.json();
    tokenStore.set(access_token);
    return access_token;
  },
  me: () => request("/auth/me"),
  logout: () => tokenStore.clear(),
  changePassword: (current_password, new_password) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
};
