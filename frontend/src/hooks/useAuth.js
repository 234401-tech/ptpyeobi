import { useCallback, useEffect, useState } from "react";
import { api, tokenStore } from "../lib/api.js";

/**
 * 로그인 상태 + me 정보 관리.
 *   - 마운트 시 localStorage 의 토큰으로 /auth/me 호출해 유효 검증
 *   - 토큰 무효/만료 → 자동 로그아웃 상태
 *   - login(user, pw) / logout() 메소드
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // 초기 me 확인 끝났는지

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setReady(true);
      return null;
    }
    try {
      const me = await api.me();
      setUser(me);
      setReady(true);
      return me;
    } catch (_) {
      tokenStore.clear();
      setUser(null);
      setReady(true);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (username, password) => {
      await api.login(username, password);
      return refresh();
    },
    [refresh]
  );

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return { user, ready, login, logout, refresh };
}
