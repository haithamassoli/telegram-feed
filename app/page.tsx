"use client";

import { useState, useCallback, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/auth-screen";
import { AppErrorBoundary } from "@/components/error-boundary";
import { Sidebar } from "@/components/sidebar";
import { Timeline } from "@/components/timeline";
import { useChannels } from "@/hooks/use-channels";
import { useTimeline } from "@/hooks/use-timeline";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getClient } from "@/lib/telegram";
import { CachedMessage } from "@/lib/types";
import { updateCache } from "@/lib/messages";
import { onQuotaError, clearMessageCache } from "@/lib/storage";
import { usePolling } from "@/hooks/use-polling";

function AppContent() {
  const { status, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isOnline } = useOnlineStatus();
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const { channels, addChannel, removeChannel, markInaccessible, isLoading: channelsLoading, maxChannels } = useChannels();

  // Listen for quota errors
  useEffect(() => {
    return onQuotaError(setQuotaExceeded);
  }, []);

  const handleClearCache = useCallback(() => {
    clearMessageCache();
    setQuotaExceeded(false);
  }, []);

  const handleChannelError = useCallback(
    (channelId: string) => {
      markInaccessible(channelId, true);
    },
    [markInaccessible]
  );

  const {
    messages,
    isLoading,
    isLoadingOlder,
    error,
    hasMore,
    loadOlder,
    refresh,
    updateMessages,
  } = useTimeline({
    channels,
    enabled: status === "authenticated",
    onChannelError: handleChannelError,
  });

  // Track new messages count from polling
  const [newMessageCount, setNewMessageCount] = useState(0);

  const handlePollNewMessages = useCallback(
    (merged: CachedMessage[], newCount: number) => {
      updateMessages(merged, newCount);
      if (newCount > 0) {
        setNewMessageCount((prev) => prev + newCount);
      }
    },
    [updateMessages]
  );

  const handleNewMessagesSeen = useCallback(() => {
    setNewMessageCount(0);
  }, []);

  const { isPolling, floodToast, clearFloodToast } = usePolling({
    channels,
    enabled: status === "authenticated" && isOnline && channels.filter((c) => !c.inaccessible).length > 0,
    currentMessages: messages,
    onNewMessages: handlePollNewMessages,
    onChannelError: handleChannelError,
  });

  const handleThumbnailVisible = useCallback(
    async (message: CachedMessage) => {
      if (message.thumbnail) return;
      const client = getClient();
      if (!client) return;

      try {
        const entity = await client.getEntity(message.channelUsername);
        const msgs = await client.getMessages(entity, {
          ids: [message.id],
        });
        const msg = msgs?.[0];
        if (!msg?.media) return;

        const buffer = await client.downloadMedia(msg.media, {
          thumb: 0,
        });
        if (!buffer) return;

        const base64 =
          typeof buffer === "string"
            ? buffer
            : `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;

        const updated: CachedMessage = { ...message, thumbnail: base64 };
        updateCache([updated]);
      } catch {
        // Silently fail thumbnail loading
      }
    },
    []
  );

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
      {/* Offline banner */}
      {!isOnline && (
        <div className="shrink-0 px-4 py-2 bg-warning-bg border-b border-warning/10 flex items-center justify-center gap-2 offline-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning shrink-0">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
            <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0122.56 9" />
            <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
            <path d="M8.53 16.11a6 6 0 016.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span className="text-xs font-medium text-warning">
            You&apos;re offline — showing cached posts
          </span>
        </div>
      )}

      {/* Quota exceeded banner */}
      {quotaExceeded && (
        <div className="shrink-0 px-4 py-2 bg-error-bg border-b border-error/10 flex items-center justify-center gap-3">
          <span className="text-xs text-error">
            Storage full. Try removing channels or clearing old data.
          </span>
          <button
            onClick={handleClearCache}
            className="text-xs font-medium text-error underline underline-offset-2 hover:text-error/80 transition-colors cursor-pointer"
          >
            Clear cache
          </button>
        </div>
      )}

      {/* Header */}
      <header className="h-14 border-b border-card-border flex items-center justify-between px-4 md:px-6 shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-11 h-11 rounded-lg flex items-center justify-center text-secondary hover:text-foreground hover:bg-card transition-colors cursor-pointer"
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
          className="text-xs text-secondary hover:text-foreground transition-colors cursor-pointer px-3 py-2 -mr-3 rounded-lg"
        >
          Sign out
        </button>
      </header>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          channels={channels}
          addChannel={addChannel}
          removeChannel={removeChannel}
          isLoading={channelsLoading}
          maxChannels={maxChannels}
        />

        {/* Timeline content area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Timeline
            messages={messages}
            isLoading={isLoading}
            isLoadingOlder={isLoadingOlder}
            error={error}
            hasMore={hasMore}
            hasChannels={channels.filter((c) => !c.inaccessible).length > 0}
            onLoadOlder={loadOlder}
            onRefresh={refresh}
            onThumbnailVisible={handleThumbnailVisible}
            newMessageCount={newMessageCount}
            onNewMessagesSeen={handleNewMessagesSeen}
            floodToast={floodToast}
            onClearFloodToast={clearFloodToast}
            isPolling={isPolling}
          />
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppErrorBoundary>
        <AppContent />
      </AppErrorBoundary>
    </AuthProvider>
  );
}
