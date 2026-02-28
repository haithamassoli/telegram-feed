"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/auth-screen";
import { Sidebar } from "@/components/sidebar";

function AppContent() {
  const { status, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  return (
    <div className="h-screen bg-atmosphere noise-overlay flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-card-border flex items-center justify-between px-4 md:px-6 shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-foreground hover:bg-card transition-colors cursor-pointer"
            aria-label="Open channels"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 5h12M3 9h12M3 13h12" />
            </svg>
          </button>

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
        </div>

        <button
          onClick={logout}
          className="text-xs text-secondary hover:text-foreground transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </header>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Timeline content area */}
        <main className="flex-1 flex items-center justify-center overflow-y-auto">
          <div className="text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent/40"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </div>
            <p className="text-sm text-secondary mb-1">
              Your timeline is empty
            </p>
            <p className="text-xs text-muted">
              Add channels to start reading
            </p>
          </div>
        </main>
      </div>
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
