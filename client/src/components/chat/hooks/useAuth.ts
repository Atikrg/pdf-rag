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
  /**
   * False during SSR and the first client render, true once effects have run.
   * `user` and `authenticated` are derived from localStorage, which does not
   * exist on the server, so anything that renders them directly will not match
   * the server's HTML. Gate that markup on this flag.
   */
  mounted: boolean;
  setSession: (token: string, user: User) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

export function useAuth(): UseAuthReturn {
  // Seeded as null rather than read eagerly: localStorage is unavailable while
  // the server renders, so reading it in the initializer would make the first
  // client render disagree with the server HTML. Populated in the effect below.
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

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
    setMounted(true);
  }, []);

  useEffect(() => {
    if (hydratedRef.current || !token) return;
    hydratedRef.current = true;
    // Re-validate the stored token / hydrate the user on mount.
    void refresh();
  }, [refresh, token]);

  // Adopt the stored credentials after the first client render, once
  // localStorage is readable. Separate from the effect above so a session with
  // no stored token still flips `mounted` and still authenticates correctly.
  const adoptedRef = useRef(false);
  useEffect(() => {
    if (adoptedRef.current) return;
    adoptedRef.current = true;
    const storedToken = getToken();
    if (!storedToken) return;
    setToken(storedToken);
    const storedUser = getStoredUser();
    if (storedUser) setUser(storedUser);
  }, []);

  return {
    user,
    token,
    loading,
    authenticated: mounted && !!token,
    mounted,
    setSession,
    login: setSession,
    logout,
    refresh,
  };
}
