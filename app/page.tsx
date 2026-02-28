"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/auth-screen";

function AppContent() {
  const { status, logout } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-atmosphere noise-overlay flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner" style={{ width: 28, height: 28 }} />
          <p className="text-sm text-secondary">Connecting to Telegram...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <AuthScreen />;
  }

  // Authenticated — placeholder main app shell
  return (
    <div className="min-h-screen bg-atmosphere noise-overlay">
      <header className="h-14 border-b border-card-border flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
          <span className="text-sm font-semibold text-foreground">
            TeleStream
          </span>
        </div>
        <button
          onClick={logout}
          className="text-xs text-secondary hover:text-foreground transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </header>
      <main className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-secondary text-sm">
          Add channels to start reading.
        </p>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
