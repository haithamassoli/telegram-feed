"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CachedMessage, ReadMarker } from "@/lib/types";
import { getReadMarker, setReadMarker, removeReadMarker } from "@/lib/storage";

const DEBOUNCE_MS = 500;
const STALE_DAYS = 7;
const STALE_THRESHOLD = STALE_DAYS * 24 * 60 * 60; // 7 days in seconds

interface UseReadMarkerOptions {
  messages: CachedMessage[];
  enabled?: boolean;
}

interface UseReadMarkerReturn {
  /** The saved read marker from a previous session (null if none or dismissed) */
  savedMarker: ReadMarker | null;
  /** Whether the "jump to" banner should be shown */
  showBanner: boolean;
  /** Relative time description for the banner */
  bannerTimeLabel: string;
  /** Dismiss the banner */
  dismissBanner: () => void;
  /** Find the index of the marked message (or nearest by timestamp) in the messages array */
  findMarkerIndex: () => { index: number; exact: boolean };
  /** Called by the timeline when scroll position changes — tracks the topmost visible message */
  trackVisibleMessage: (topIndex: number) => void;
  /** Toast message to show (e.g. "Original message not available") */
  toast: string | null;
  /** Clear the toast */
  clearToast: () => void;
}

export function useReadMarker({
  messages,
  enabled = true,
}: UseReadMarkerOptions): UseReadMarkerReturn {
  const [savedMarker] = useState<ReadMarker | null>(() =>
    enabled ? loadValidSavedMarker() : null
  );
  const [showBanner, setShowBanner] = useState(Boolean(savedMarker));
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the topmost visible message (debounced)
  const trackVisibleMessage = useCallback(
    (topIndex: number) => {
      if (!enabled || messages.length === 0) return;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const msg = messages[topIndex];
        if (!msg) return;

        const marker: ReadMarker = {
          messageId: msg.id,
          channelId: msg.channelId,
          timestamp: msg.date,
          savedAt: Math.floor(Date.now() / 1000),
        };

        setReadMarker(marker);
      }, DEBOUNCE_MS);
    },
    [enabled, messages]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Find the index of the marked message or nearest by timestamp
  const findMarkerIndex = useCallback((): { index: number; exact: boolean } => {
    if (!savedMarker || messages.length === 0) {
      return { index: 0, exact: false };
    }

    // Try exact match first
    const exactIndex = messages.findIndex(
      (m) => m.id === savedMarker.messageId && m.channelId === savedMarker.channelId
    );

    if (exactIndex !== -1) {
      return { index: exactIndex, exact: true };
    }

    // Fallback: find nearest message by timestamp
    let nearestIndex = 0;
    let nearestDiff = Infinity;

    for (let i = 0; i < messages.length; i++) {
      const diff = Math.abs(messages[i].date - savedMarker.timestamp);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestIndex = i;
      }
    }

    return { index: nearestIndex, exact: false };
  }, [savedMarker, messages]);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  // Compute relative time label for the banner (based on when marker was saved)
  const bannerTimeLabel = savedMarker
    ? formatRelativeMarkerTime(savedMarker.savedAt || savedMarker.timestamp)
    : "";

  return {
    savedMarker,
    showBanner,
    bannerTimeLabel,
    dismissBanner,
    findMarkerIndex,
    trackVisibleMessage,
    toast,
    clearToast,
  };
}

function loadValidSavedMarker(): ReadMarker | null {
  const marker = getReadMarker();
  if (!marker) return null;

  const now = Date.now() / 1000;
  const savedAt = marker.savedAt || marker.timestamp;
  if (now - savedAt > STALE_THRESHOLD) {
    removeReadMarker();
    return null;
  }

  return marker;
}

function formatRelativeMarkerTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  const mins = Math.max(1, Math.floor(diff / 60));
  if (diff < 3600) return `from ${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hrs = Math.floor(diff / 3600);
  if (diff < 86400) return `from ${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
  if (diff < 172800) return "from yesterday";
  return `from ${Math.floor(diff / 86400)} days ago`;
}
