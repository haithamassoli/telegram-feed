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
        if (valid) {
          setStatus("authenticated");
        } else {
          // Session string exists but getMe() failed — could be a temporary
          // network issue. Keep the session and let the user retry instead of
          // wiping credentials that may still be valid on the server.
          setStatus("unauthenticated");
        }
      } catch {
        // Connection error (network down, etc.) — don't clear the stored
        // session so it can be retried on the next page load.
        setStatus("unauthenticated");
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

  // Global handler for unhandled GramJS session errors
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || "");
      // Only clear session on truly fatal server-side revocations.
      // Transient AuthKey errors (e.g. reconnect hiccups) should not
      // wipe a valid session — GramJS auto-reconnect will handle those.
      if (
        msg.includes("SESSION_EXPIRED") ||
        msg.includes("SESSION_REVOKED") ||
        msg.includes("USER_DEACTIVATED")
      ) {
        event.preventDefault();
        clearAll();
        setStatus("unauthenticated");
      } else if (msg.includes("AuthKey") || msg.includes("AUTH_KEY")) {
        // Suppress the error but don't wipe session — let auto-reconnect retry
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
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
