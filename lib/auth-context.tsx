"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getSession, clearAll } from "./storage";
import {
  initClient,
  isAuthenticated,
  saveSession,
  destroyClient,
} from "./telegram";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  setAuthenticated: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    async function restoreSession() {
      const saved = getSession();
      if (!saved) {
        setStatus("unauthenticated");
        return;
      }
      try {
        await initClient(saved);
        const valid = await isAuthenticated();
        setStatus(valid ? "authenticated" : "unauthenticated");
        if (!valid) {
          clearAll();
        }
      } catch {
        setStatus("unauthenticated");
        clearAll();
      }
    }
    restoreSession();
  }, []);

  const setAuthenticated = useCallback(() => {
    saveSession();
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await destroyClient();
    } catch {
      // ignore destroy errors
    }
    clearAll();
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ status, setAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
