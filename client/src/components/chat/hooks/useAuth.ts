"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getToken,
  getStoredUser,
  clearAuth,
  fetchMe,
  setToken as persistToken,
  setStoredUser,
  type User,
} from "@/lib/api";

type UseAuthReturn = {
  user: User | null;
  token: string | null;
  loading: boolean;
  authenticated: boolean;
  setSession: (token: string, user: User) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getToken());
  const [loading, setLoading] = useState(false);

  const setSession = useCallback((nextToken: string, nextUser: User) => {
    persistToken(nextToken);
    setStoredUser(nextUser);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current || !token) return;
    hydratedRef.current = true;
    // Re-validate the stored token / hydrate the user on mount.
    void refresh();
  }, [refresh, token]);

  return {
    user,
    token,
    loading,
    authenticated: !!token,
    setSession,
    login: setSession,
    logout,
    refresh,
  };
}
