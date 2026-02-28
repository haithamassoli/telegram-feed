"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { initClient, getClient, saveSession, API_ID, API_HASH } from "@/lib/telegram";

type AuthStep = "phone" | "code" | "2fa";

interface AuthError {
  message: string;
  isFloodWait?: boolean;
  waitSeconds?: number;
}

export function AuthScreen() {
  const { setAuthenticated } = useAuth();
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [floodCountdown, setFloodCountdown] = useState(0);

  // Resolvers for the callback-driven auth flow
  const codeResolverRef = useRef<((code: string) => void) | null>(null);
  const passwordResolverRef = useRef<((password: string) => void) | null>(null);

  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === "phone") phoneRef.current?.focus();
      if (step === "code") codeRef.current?.focus();
      if (step === "2fa") passwordRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (floodCountdown <= 0) return;
    const interval = setInterval(() => {
      setFloodCountdown((prev) => {
        if (prev <= 1) {
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [floodCountdown]);

  const handlePhoneSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = phone.replace(/[^0-9+]/g, "");
      if (!cleaned || cleaned.length < 7) {
        setError({ message: "Enter a valid phone number with country code" });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const client = getClient() || (await initClient());

        // Use client.start() with callbacks — this is GramJS's recommended approach
        // and avoids Turbopack bundling issues with direct Api class constructors
        client
          .start({
            phoneNumber: cleaned,
            phoneCode: () =>
              new Promise<string>((resolve) => {
                codeResolverRef.current = resolve;
                setStep("code");
                setLoading(false);
              }),
            password: () =>
              new Promise<string>((resolve) => {
                passwordResolverRef.current = resolve;
                setStep("2fa");
                setLoading(false);
              }),
            onError: (err: Error) => {
              const msg = err.message || "";
              if (msg.includes("PHONE_CODE_INVALID")) {
                setError({ message: "Incorrect code. Please try again." });
                setCode("");
                setStep("code");
              } else if (msg.includes("PASSWORD_HASH_INVALID")) {
                setError({ message: "Incorrect password. Please try again." });
                setPassword("");
                setStep("2fa");
              } else if (msg.includes("PHONE_CODE_EXPIRED")) {
                setError({ message: "Code expired. Please try again." });
                setCode("");
                setStep("phone");
              } else {
                setError({ message: msg || "Authentication error" });
              }
              setLoading(false);
              return true; // return true to not throw
            },
            apiId: API_ID,
            apiHash: API_HASH,
          })
          .then(() => {
            saveSession();
            setAuthenticated();
          })
          .catch((err: unknown) => {
            const msg =
              err instanceof Error ? err.message : String(err);
            if (msg.includes("FLOOD")) {
              const match = msg.match(/(\d+)/);
              const seconds = match ? parseInt(match[1], 10) : 60;
              setFloodCountdown(seconds);
              setError({
                message: `Too many attempts. Please wait ${seconds}s`,
                isFloodWait: true,
                waitSeconds: seconds,
              });
            } else if (msg.includes("PHONE_NUMBER_INVALID")) {
              setError({
                message: "Invalid phone number. Include country code (e.g. +1)",
              });
            } else if (!msg.includes("RESTART")) {
              setError({
                message: msg || "Connection failed. Check your network.",
              });
            }
            setLoading(false);
          });
      } catch (err: unknown) {
        setError({
          message:
            err instanceof Error
              ? err.message
              : "Connection failed. Check your network.",
        });
        setLoading(false);
      }
    },
    [phone, setAuthenticated]
  );

  const handleCodeSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = code.replace(/\s/g, "");
      if (cleaned.length < 5) {
        setError({ message: "Enter the full verification code" });
        return;
      }

      setLoading(true);
      setError(null);

      if (codeResolverRef.current) {
        codeResolverRef.current(cleaned);
        codeResolverRef.current = null;
      }
    },
    [code]
  );

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password) {
        setError({ message: "Enter your 2FA password" });
        return;
      }

      setLoading(true);
      setError(null);

      if (passwordResolverRef.current) {
        passwordResolverRef.current(password);
        passwordResolverRef.current = null;
      }
    },
    [password]
  );

  const stepIndicator = (
    <div className="flex items-center gap-2 mb-8">
      {(["phone", "code", "2fa"] as const).map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`
              h-1.5 rounded-full transition-all duration-500
              ${step === s ? "w-8 bg-accent" : "w-1.5"}
              ${
                (["phone", "code", "2fa"] as const).indexOf(step) > i
                  ? "bg-accent/40"
                  : step === s
                    ? "bg-accent"
                    : "bg-[var(--text-muted)]/30"
              }
            `}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-atmosphere noise-overlay flex items-center justify-center p-4 relative">
      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 mb-5">
            <svg
              viewBox="0 0 24 24"
              className="w-7 h-7 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            TeleStream
          </h1>
          <p className="text-sm text-secondary mt-1.5">
            Unified Telegram timeline
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-card rounded-2xl p-7">
          {stepIndicator}

          {/* Phone Step */}
          {step === "phone" && (
            <div className="animate-slide-up" key="phone">
              <h2 className="text-lg font-medium text-foreground mb-1">
                Sign in with Telegram
              </h2>
              <p className="text-sm text-secondary mb-6">
                Enter your phone number to receive a verification code.
              </p>

              <form onSubmit={handlePhoneSubmit}>
                <label htmlFor="phone-input" className="block text-xs font-medium text-secondary mb-2 uppercase tracking-wider">
                  Phone number
                </label>
                <input
                  id="phone-input"
                  name="phone"
                  ref={phoneRef}
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError(null);
                  }}
                  placeholder="+1 234 567 8900"
                  disabled={loading || floodCountdown > 0}
                  className="w-full h-12 px-4 rounded-xl bg-input border border-card-border text-foreground placeholder:text-muted text-base font-mono input-glow focus:outline-none focus:bg-input-focus transition-all duration-200 disabled:opacity-50"
                />

                {error && (
                  <div
                    className={`mt-3 px-3 py-2.5 rounded-lg text-sm flex items-start gap-2 ${
                      error.isFloodWait
                        ? "bg-warning-bg text-[var(--warning)]"
                        : "bg-error-bg text-[var(--error)]"
                    }`}
                  >
                    <svg
                      className="w-4 h-4 mt-0.5 shrink-0"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zM8.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" />
                    </svg>
                    <span>
                      {error.isFloodWait
                        ? `Rate limited. Retry in ${floodCountdown}s`
                        : error.message}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || floodCountdown > 0}
                  className="w-full h-12 mt-5 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="spinner" />
                  ) : (
                    "Send verification code"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Code Step */}
          {step === "code" && (
            <div className="animate-slide-up" key="code">
              <h2 className="text-lg font-medium text-foreground mb-1">
                Enter verification code
              </h2>
              <p className="text-sm text-secondary mb-6">
                We sent a code to{" "}
                <span className="text-foreground font-mono text-xs">
                  {phone}
                </span>
              </p>

              <form onSubmit={handleCodeSubmit}>
                <label htmlFor="code-input" className="block text-xs font-medium text-secondary mb-2 uppercase tracking-wider">
                  Code
                </label>
                <input
                  id="code-input"
                  name="code"
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setCode(val);
                    setError(null);
                  }}
                  placeholder="00000"
                  disabled={loading}
                  className="w-full h-14 px-4 rounded-xl bg-input border border-card-border text-foreground placeholder:text-muted text-2xl font-mono tracking-[0.4em] text-center input-glow focus:outline-none focus:bg-input-focus transition-all duration-200 disabled:opacity-50"
                />

                {error && (
                  <div className="mt-3 px-3 py-2.5 rounded-lg text-sm bg-error-bg text-[var(--error)] flex items-start gap-2">
                    <svg
                      className="w-4 h-4 mt-0.5 shrink-0"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zM8.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" />
                    </svg>
                    <span>{error.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-5 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <div className="spinner" /> : "Verify code"}
                </button>
              </form>

              <button
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
                className="w-full mt-3 text-sm text-secondary hover:text-foreground transition-colors cursor-pointer"
              >
                Use a different number
              </button>
            </div>
          )}

          {/* 2FA Step */}
          {step === "2fa" && (
            <div className="animate-slide-up" key="2fa">
              <h2 className="text-lg font-medium text-foreground mb-1">
                Two-factor authentication
              </h2>
              <p className="text-sm text-secondary mb-6">
                Your account has 2FA enabled. Enter your cloud password.
              </p>

              <form onSubmit={handlePasswordSubmit}>
                <label htmlFor="password-input" className="block text-xs font-medium text-secondary mb-2 uppercase tracking-wider">
                  Password
                </label>
                <input
                  id="password-input"
                  name="password"
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Cloud password"
                  disabled={loading}
                  className="w-full h-12 px-4 rounded-xl bg-input border border-card-border text-foreground placeholder:text-muted text-base input-glow focus:outline-none focus:bg-input-focus transition-all duration-200 disabled:opacity-50"
                />

                {error && (
                  <div className="mt-3 px-3 py-2.5 rounded-lg text-sm bg-error-bg text-[var(--error)] flex items-start gap-2">
                    <svg
                      className="w-4 h-4 mt-0.5 shrink-0"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zM8.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" />
                    </svg>
                    <span>{error.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-5 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <div className="spinner" /> : "Sign in"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Security Warning */}
        <div className="mt-5 px-4 py-3.5 rounded-xl bg-warning-bg border border-[var(--warning)]/10 flex items-start gap-3">
          <svg
            className="w-4 h-4 text-[var(--warning)] mt-0.5 shrink-0"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8.982 1.566a1.13 1.13 0 00-1.964 0L.165 13.233c-.457.778.091 1.767.982 1.767h13.706c.891 0 1.439-.99.982-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6.5a.75.75 0 100 1.5.75.75 0 000-1.5z" />
          </svg>
          <p className="text-xs leading-relaxed text-[var(--warning)]/80">
            <span className="font-medium text-[var(--warning)]">
              Security notice:
            </span>{" "}
            Your Telegram session is stored locally in this browser. Do not use
            on shared or public computers.
          </p>
        </div>
      </div>
    </div>
  );
}
