"use client";

import { useState, useCallback } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/auth-screen";
import { Sidebar } from "@/components/sidebar";
import { Timeline } from "@/components/timeline";
import { useChannels } from "@/hooks/use-channels";
import { useTimeline } from "@/hooks/use-timeline";
import { getClient } from "@/lib/telegram";
import { CachedMessage } from "@/lib/types";
import { updateCache } from "@/lib/messages";

function AppContent() {
  const { status, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { channels, addChannel, removeChannel, markInaccessible, isLoading: channelsLoading, maxChannels } = useChannels();

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
  } = useTimeline({
    channels,
    enabled: status === "authenticated",
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
          />
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
