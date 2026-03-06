"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "telestream-install-dismissed";

function isAlreadyInstalled() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function wasDismissedRecently() {
  if (typeof window === "undefined") return false;
  const dismissedAt = localStorage.getItem(DISMISSED_KEY);
  if (!dismissedAt) return false;
  const elapsed = Date.now() - Number(dismissedAt);
  if (elapsed < 7 * 24 * 60 * 60 * 1000) return true;
  localStorage.removeItem(DISMISSED_KEY);
  return false;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled] = useState(isAlreadyInstalled);
  const [dismissed, setDismissed] = useState(wasDismissedRecently);

  useEffect(() => {
    if (isInstalled || dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isInstalled, dismissed]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setDeferredPrompt(null);
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  }, []);

  const showBanner = !!deferredPrompt && !isInstalled && !dismissed;

  return { showBanner, install, dismiss };
}
