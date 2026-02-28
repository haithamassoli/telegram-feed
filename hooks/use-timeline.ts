"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CachedMessage, ChannelEntry } from "@/lib/types";
import {
  fetchChannelMessages,
  mergeAndDeduplicate,
  getCachedMessages,
  updateCache,
  FloodWaitException,
} from "@/lib/messages";

interface UseTimelineOptions {
  channels: ChannelEntry[];
  enabled?: boolean;
  onChannelError?: (channelId: string) => void;
}

export function useTimeline({ channels, enabled = true, onChannelError }: UseTimelineOptions) {
  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const fetchedRef = useRef(false);
  const channelsRef = useRef<ChannelEntry[]>([]);

  // Load cached messages on mount
  useEffect(() => {
    const cached = getCachedMessages();
    if (cached.length > 0) {
      setMessages(cached);
    }
  }, []);

  // Fetch fresh messages when channels change
  useEffect(() => {
    if (!enabled) return;

    const activeChannels = channels.filter((c) => !c.inaccessible);
    const prevIds = channelsRef.current
      .filter((c) => !c.inaccessible)
      .map((c) => c.id)
      .sort()
      .join(",");
    const currIds = activeChannels
      .map((c) => c.id)
      .sort()
      .join(",");

    channelsRef.current = channels;

    if (activeChannels.length === 0) {
      if (!fetchedRef.current) {
        setMessages([]);
      }
      return;
    }

    // Only refetch if channels actually changed
    if (prevIds !== currIds || !fetchedRef.current) {
      fetchedRef.current = true;
      fetchAllChannels(activeChannels);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, enabled]);

  const fetchAllChannels = useCallback(
    async (channelList: ChannelEntry[]) => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await Promise.allSettled(
          channelList.map((ch) =>
            fetchChannelMessages(ch.id, ch.username, ch.title, 20)
          )
        );

        const allMessages: CachedMessage[] = [];
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.status === "fulfilled") {
            allMessages.push(...result.value);
          } else {
            onChannelError?.(channelList[i].id);
          }
        }

        const cached = getCachedMessages();
        const merged = mergeAndDeduplicate(cached, allMessages);
        const updated = updateCache(allMessages);
        setMessages(merged.length > updated.length ? merged : updated);
        setHasMore(true);
      } catch (err) {
        if (err instanceof FloodWaitException) {
          setError(`Rate limited. Retry in ${err.seconds}s`);
        } else {
          setError("Failed to load messages");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [onChannelError]
  );

  const loadOlder = useCallback(async () => {
    if (isLoadingOlder || !hasMore) return;

    const activeChannels = channels.filter((c) => !c.inaccessible);
    if (activeChannels.length === 0) return;

    setIsLoadingOlder(true);

    try {
      // Find the oldest message per channel to use as offset
      const oldestPerChannel = new Map<string, number>();
      for (const msg of messages) {
        const current = oldestPerChannel.get(msg.channelId);
        if (!current || msg.id < current) {
          oldestPerChannel.set(msg.channelId, msg.id);
        }
      }

      const results = await Promise.allSettled(
        activeChannels.map((ch) => {
          const offsetId = oldestPerChannel.get(ch.id);
          return fetchChannelMessages(ch.id, ch.username, ch.title, 20, offsetId);
        })
      );

      let totalNew = 0;
      const allMessages: CachedMessage[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          allMessages.push(...result.value);
          totalNew += result.value.length;
        }
      }

      if (totalNew === 0) {
        setHasMore(false);
      } else {
        const updated = updateCache(allMessages);
        setMessages(mergeAndDeduplicate(messages, updated));
      }
    } catch {
      // Silently fail for load-more
    } finally {
      setIsLoadingOlder(false);
    }
  }, [channels, messages, isLoadingOlder, hasMore]);

  const refresh = useCallback(async () => {
    const activeChannels = channels.filter((c) => !c.inaccessible);
    if (activeChannels.length === 0) return;
    await fetchAllChannels(activeChannels);
  }, [channels, fetchAllChannels]);

  // Callback for polling to update messages
  const updateMessages = useCallback(
    (merged: CachedMessage[], newCount: number) => {
      if (newCount > 0) {
        setMessages(merged);
      }
    },
    []
  );

  return {
    messages,
    isLoading,
    isLoadingOlder,
    error,
    hasMore,
    loadOlder,
    refresh,
    updateMessages,
  };
}
