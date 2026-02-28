"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CachedMessage, ChannelEntry } from "@/lib/types";
import {
  fetchChannelMessages,
  mergeAndDeduplicate,
  updateCache,
  FloodWaitException,
} from "@/lib/messages";

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const MESSAGES_PER_POLL = 20;

interface UsePollingOptions {
  channels: ChannelEntry[];
  enabled: boolean;
  currentMessages: CachedMessage[];
  onNewMessages: (
    merged: CachedMessage[],
    newCount: number
  ) => void;
  onChannelError?: (channelId: string) => void;
}

interface UsePollingReturn {
  /** Whether a poll is currently in progress */
  isPolling: boolean;
  /** FloodWait toast message (or null) */
  floodToast: string | null;
  clearFloodToast: () => void;
  /** Whether polling is paused (tab hidden or flood wait) */
  isPaused: boolean;
}

export function usePolling({
  channels,
  enabled,
  currentMessages,
  onNewMessages,
  onChannelError,
}: UsePollingOptions): UsePollingReturn {
  const [isPolling, setIsPolling] = useState(false);
  const [floodToast, setFloodToast] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const floodTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffMultiplierRef = useRef(1);
  const messagesRef = useRef(currentMessages);
  const channelsRef = useRef(channels);
  const enabledRef = useRef(enabled);
  const isPausedByFloodRef = useRef(false);

  // Keep refs in sync
  messagesRef.current = currentMessages;
  channelsRef.current = channels;
  enabledRef.current = enabled;

  const poll = useCallback(async () => {
    const activeChannels = channelsRef.current.filter((c) => !c.inaccessible);
    if (activeChannels.length === 0 || !enabledRef.current) return;

    setIsPolling(true);

    try {
      const results = await Promise.allSettled(
        activeChannels.map((ch) =>
          fetchChannelMessages(ch.id, ch.username, ch.title, MESSAGES_PER_POLL)
        )
      );

      const freshMessages: CachedMessage[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          freshMessages.push(...result.value);
        } else {
          // Check if it's a FloodWaitException
          const reason = result.reason;
          if (reason instanceof FloodWaitException) {
            throw reason;
          }
          onChannelError?.(activeChannels[i].id);
        }
      }

      if (freshMessages.length > 0) {
        const current = messagesRef.current;
        const merged = mergeAndDeduplicate(current, freshMessages);
        updateCache(freshMessages);

        // Count how many messages are genuinely new (not in current list)
        const currentKeys = new Set(
          current.map((m) => `${m.channelId}:${m.id}`)
        );
        const newCount = freshMessages.filter(
          (m) => !currentKeys.has(`${m.channelId}:${m.id}`)
        ).length;

        onNewMessages(merged, newCount);

        // Reset backoff on success
        backoffMultiplierRef.current = 1;
      }
    } catch (err) {
      if (err instanceof FloodWaitException) {
        handleFloodWait(err.seconds);
      }
    } finally {
      setIsPolling(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNewMessages, onChannelError]);

  const handleFloodWait = useCallback(
    (seconds: number) => {
      const waitTime = seconds * backoffMultiplierRef.current;
      backoffMultiplierRef.current = Math.min(
        backoffMultiplierRef.current * 2,
        8
      );

      setFloodToast(`Rate limited by Telegram. Retrying in ${waitTime}s.`);
      setIsPaused(true);
      isPausedByFloodRef.current = true;

      // Clear existing interval during flood wait
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      floodTimeoutRef.current = setTimeout(() => {
        setFloodToast(null);
        setIsPaused(false);
        isPausedByFloodRef.current = false;

        // Resume polling
        if (enabledRef.current) {
          poll();
          startInterval();
        }
      }, waitTime * 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [poll]
  );

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!isPausedByFloodRef.current) {
        poll();
      }
    }, POLL_INTERVAL_MS);
  }, [poll]);

  const clearFloodToast = useCallback(() => {
    setFloodToast(null);
  }, []);

  // Visibility change handler — pause polling when tab hidden
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        setIsPaused(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Tab became visible again
        if (!isPausedByFloodRef.current) {
          setIsPaused(false);
          // Immediately poll on tab return, then restart interval
          poll();
          startInterval();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, poll, startInterval]);

  // Start/stop polling based on enabled
  useEffect(() => {
    if (enabled && channelsRef.current.length > 0) {
      startInterval();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, startInterval]);

  // Cleanup flood timeout on unmount
  useEffect(() => {
    return () => {
      if (floodTimeoutRef.current) {
        clearTimeout(floodTimeoutRef.current);
      }
    };
  }, []);

  return {
    isPolling,
    floodToast,
    clearFloodToast,
    isPaused,
  };
}
