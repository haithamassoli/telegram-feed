"use client";

import { useRef, useCallback, useState, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CachedMessage } from "@/lib/types";

// --- Relative time formatter ---
function relativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- Channel color generator (deterministic from channel ID) ---
const CHANNEL_HUES = [210, 160, 330, 30, 270, 180, 350, 50, 290, 120];
function channelColor(channelId: string): string {
  let hash = 0;
  for (let i = 0; i < channelId.length; i++) {
    hash = channelId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = CHANNEL_HUES[Math.abs(hash) % CHANNEL_HUES.length];
  return `hsl(${hue}, 70%, 65%)`;
}

// --- MessageCard ---
const MessageCard = memo(function MessageCard({
  message,
  index,
  onThumbnailVisible,
}: {
  message: CachedMessage;
  index: number;
  onThumbnailVisible?: (message: CachedMessage) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = channelColor(message.channelId);
  const needsTruncation = message.text.length > 300;
  const displayText = expanded
    ? message.text
    : needsTruncation
      ? message.text.slice(0, 300)
      : message.text;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking "show more" or thumbnail
    if ((e.target as HTMLElement).closest("[data-interactive]")) return;
    window.open(
      `https://t.me/${message.channelUsername}/${message.id}`,
      "_blank",
      "noopener"
    );
  };

  // Thumbnail lazy-loading via IntersectionObserver
  const thumbnailRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !message.hasMedia || message.thumbnail) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onThumbnailVisible?.(message);
            observer.disconnect();
          }
        },
        { rootMargin: "200px" }
      );
      observer.observe(node);
    },
    [message, onThumbnailVisible]
  );

  return (
    <div
      className="msg-card group relative pl-8 md:pl-10"
      style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
    >
      {/* Timeline node — the dot on the vertical line */}
      <div
        className="absolute left-[11px] md:left-[15px] top-5 w-2 h-2 rounded-full border-2 transition-colors duration-200 z-10 group-hover:scale-125"
        style={{
          borderColor: color,
          backgroundColor: "var(--bg-deep)",
          boxShadow: `0 0 6px ${color}40`,
        }}
      />

      {/* Card */}
      <article
        onClick={handleCardClick}
        className="msg-card-inner glass-card rounded-xl px-4 py-3.5 md:px-5 md:py-4 cursor-pointer transition-all duration-200 hover:border-accent/20 relative overflow-hidden"
        style={
          {
            "--card-accent": color,
          } as React.CSSProperties
        }
      >
        {/* Accent edge line */}
        <div
          className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ backgroundColor: color }}
        />

        {/* Header: channel badge + timestamp */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {/* Channel avatar */}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold uppercase"
              style={{
                backgroundColor: `${color}18`,
                color: color,
                border: `1px solid ${color}30`,
              }}
            >
              {message.channelTitle.charAt(0)}
            </div>
            <span
              className="text-xs font-medium truncate"
              style={{ color }}
            >
              {message.channelTitle}
            </span>
          </div>

          <time className="text-[11px] font-mono text-muted tabular-nums shrink-0 ml-3">
            {relativeTime(message.date)}
          </time>
        </div>

        {/* Message body */}
        <div className="text-sm text-secondary leading-relaxed whitespace-pre-wrap break-words">
          {displayText}
          {needsTruncation && !expanded && (
            <span className="text-muted">… </span>
          )}
          {needsTruncation && (
            <button
              data-interactive
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="text-accent/80 hover:text-accent text-xs ml-1 cursor-pointer transition-colors"
            >
              {expanded ? "show less" : "show more"}
            </button>
          )}
        </div>

        {/* Media thumbnail */}
        {message.hasMedia && (
          <div
            ref={thumbnailRef}
            className="mt-3 rounded-lg overflow-hidden bg-surface/60 border border-card-border"
          >
            {message.thumbnail ? (
              <img
                src={message.thumbnail}
                alt=""
                className="w-full max-h-52 object-cover"
                loading="lazy"
              />
            ) : (
              <div
                data-interactive
                className="h-28 flex items-center justify-center"
              >
                <div className="flex items-center gap-2 text-muted">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span className="text-xs">Media</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* External link icon — subtle hint */}
        <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-60 transition-opacity duration-150">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
          >
            <path d="M9 3L3 9M9 3H5M9 3v4" />
          </svg>
        </div>
      </article>
    </div>
  );
});

// --- Skeleton loader ---
function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="pl-8 md:pl-10 relative"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* Skeleton node */}
      <div className="absolute left-[11px] md:left-[15px] top-5 w-2 h-2 rounded-full bg-card-border" />

      <div className="glass-card rounded-xl px-4 py-4 md:px-5 skeleton-card">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full skeleton-shimmer" />
            <div className="w-20 h-3 rounded skeleton-shimmer" />
          </div>
          <div className="w-12 h-3 rounded skeleton-shimmer" />
        </div>
        {/* Text lines */}
        <div className="space-y-2">
          <div className="w-full h-3 rounded skeleton-shimmer" />
          <div className="w-4/5 h-3 rounded skeleton-shimmer" />
          <div className="w-3/5 h-3 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

// --- Main Timeline ---
interface TimelineProps {
  messages: CachedMessage[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  error: string | null;
  hasMore: boolean;
  hasChannels: boolean;
  onLoadOlder: () => void;
  onRefresh: () => void;
  onThumbnailVisible?: (message: CachedMessage) => void;
}

export function Timeline({
  messages,
  isLoading,
  isLoadingOlder,
  error,
  hasMore,
  hasChannels,
  onLoadOlder,
  onRefresh,
  onThumbnailVisible,
}: TimelineProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 5,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  // Infinite scroll detection
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el || isLoadingOlder || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 300) {
      onLoadOlder();
    }
  }, [isLoadingOlder, hasMore, onLoadOlder]);

  // Empty state: no channels
  if (!hasChannels) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-accent/5 border border-accent/10 flex items-center justify-center mx-auto mb-5">
            <svg
              width="24"
              height="24"
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
          <p className="text-sm text-secondary mb-1.5">
            Add channels to start reading
          </p>
          <p className="text-xs text-muted leading-relaxed max-w-[200px] mx-auto">
            Use the sidebar to add Telegram channels and build your feed.
          </p>
        </div>
      </div>
    );
  }

  // Loading state: channels exist but initial fetch
  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 overflow-hidden px-3 md:px-6 py-6">
        <div className="max-w-2xl mx-auto relative">
          {/* Skeleton timeline line */}
          <div className="absolute left-[14px] md:left-[18px] top-0 bottom-0 w-px bg-gradient-to-b from-card-border via-card-border/50 to-transparent" />
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center animate-slide-up">
          <div className="w-12 h-12 rounded-xl bg-error-bg border border-error/10 flex items-center justify-center mx-auto mb-4">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-error/60"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-sm text-secondary mb-1">{error}</p>
          <button
            onClick={handleRefresh}
            className="text-xs text-accent hover:text-accent-hover transition-colors mt-2 cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // No messages after fetch
  if (!isLoading && messages.length === 0 && hasChannels) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center animate-slide-up">
          <div className="w-12 h-12 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-center mx-auto mb-4">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent/40"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <p className="text-sm text-secondary mb-1">No messages yet</p>
          <p className="text-xs text-muted">
            Messages will appear once channels post.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Refresh bar */}
      <div className="shrink-0 px-3 md:px-6 py-2.5 flex items-center justify-between border-b border-card-border/50">
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-warning">{error}</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors cursor-pointer disabled:opacity-40"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isRefreshing ? "animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 11-2.636-6.364" />
            <path d="M21 3v6h-6" />
          </svg>
          <span>{isRefreshing ? "Refreshing" : "Refresh"}</span>
        </button>
      </div>

      {/* Virtualized message list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto px-3 md:px-6 timeline-scroll"
        onScroll={handleScroll}
      >
        <div className="max-w-2xl mx-auto relative py-4">
          {/* Timeline vertical line */}
          <div className="timeline-line absolute left-[14px] md:left-[18px] top-0 bottom-0 w-px" />

          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const message = messages[virtualItem.index];
              return (
                <div
                  key={`${message.channelId}-${message.id}`}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="pb-3"
                >
                  <MessageCard
                    message={message}
                    index={virtualItem.index}
                    onThumbnailVisible={onThumbnailVisible}
                  />
                </div>
              );
            })}
          </div>

          {/* Loading older spinner */}
          {isLoadingOlder && (
            <div className="flex justify-center py-6">
              <div className="flex items-center gap-2.5">
                <div
                  className="spinner"
                  style={{ width: 16, height: 16, borderWidth: 1.5 }}
                />
                <span className="text-xs text-muted">
                  Loading older messages
                </span>
              </div>
            </div>
          )}

          {/* End of timeline */}
          {!hasMore && messages.length > 0 && (
            <div className="flex items-center gap-3 py-6 pl-8 md:pl-10">
              <div className="h-px flex-1 bg-gradient-to-r from-card-border to-transparent" />
              <span className="text-[11px] text-muted font-mono">
                END
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-card-border to-transparent" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
