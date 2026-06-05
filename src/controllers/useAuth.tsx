"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authService } from "@/services/auth.service";
import { tokenStore } from "@/services/api.client";
import type { Credentials, User } from "@/models/auth.model";

type Status = "loading" | "authed" | "anon";

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (creds: Credentials) => Promise<void>;
  register: (creds: Credentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Hydrate the session on first mount if a token is already present.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.access) {
        setStatus("anon");
        return;
      }
      try {
        const me = await authService.me();
        if (!cancelled) {
          setUser(me);
          setStatus("authed");
        }
      } catch {
        tokenStore.clear();
        if (!cancelled) setStatus("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handle = useCallback(
    async (action: (c: Credentials) => Promise<{ accessToken: string; refreshToken: string; user?: User }>, creds: Credentials) => {
      const res = await action(creds);
      tokenStore.set(res);
      const u = res.user ?? (await authService.me());
      setUser(u);
      setStatus("authed");
    },
    [],
  );

  const login = useCallback((c: Credentials) => handle(authService.login, c), [handle]);
  const register = useCallback((c: Credentials) => handle(authService.register, c), [handle]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus("anon");
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
