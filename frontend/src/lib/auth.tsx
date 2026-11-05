import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Role, User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (role: Role, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export const dashboardPath = (role: Role) => (role === "student" ? "/student/dashboard" : role === "recruiter" ? "/recruiter/dashboard" : "/admin/dashboard");

/** The server session is the single source of truth: on load we ask the API who we are. Nothing role-related is stored in the browser. */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    api.auth.me().then((u) => alive && setUser(u)).catch(() => alive && setUser(null)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (role: Role, email: string, password: string) => {
    const u = await api.auth.login(role, email, password);
    qc.clear(); // never show another account's cached data
    setUser(u);
    return u;
  }, [qc]);
  const logout = useCallback(async () => {
    try { await api.auth.logout(); } finally { qc.clear(); setUser(null); }
  }, [qc]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
};
