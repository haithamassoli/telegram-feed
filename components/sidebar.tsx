"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChannelEntry } from "@/lib/types";
import type { AddChannelResult } from "@/hooks/use-channels";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  channels: ChannelEntry[];
  addChannel: (username: string) => Promise<AddChannelResult>;
  removeChannel: (id: string) => void;
  isLoading: boolean;
  maxChannels: number;
}

export function Sidebar({ isOpen, onClose, channels, addChannel, removeChannel, isLoading, maxChannels }: SidebarProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  }, [onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      setError(null);
      const result = await addChannel(input.trim());

      if (result.ok) {
        setInput("");
        setError(null);
      } else {
        setError(result.message);
      }
    },
    [input, isLoading, addChannel]
  );

  const handleRemove = useCallback(
    (channel: ChannelEntry) => {
      removeChannel(channel.id);
    },
    [removeChannel]
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            Channels
          </h2>
          <span className="text-xs font-mono text-muted tabular-nums">
            {channels.length}/{maxChannels}
          </span>
        </div>

        {/* Capacity bar */}
        <div className="capacity-track h-0.5 rounded-full overflow-hidden">
          <div
            className="capacity-fill h-full rounded-full"
            style={{ width: `${(channels.length / maxChannels) * 100}%` }}
          />
        </div>
      </div>

      {/* Add channel input */}
      <div className="px-5 pb-4">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-muted text-sm pointer-events-none select-none">
              @
            </span>
            <input
              ref={inputRef}
              id="channel-input"
              name="channel"
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              placeholder="channel_username"
              disabled={isLoading}
              className="w-full h-11 pl-7 pr-10 rounded-lg bg-input border border-card-border text-foreground placeholder:text-muted text-sm input-glow focus:outline-none focus:bg-input-focus transition-all duration-200 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-1 w-9 h-9 md:w-7 md:h-7 rounded-md flex items-center justify-center text-accent hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Add channel"
            >
              {isLoading ? (
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M8 3v10M3 8h10" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-xs text-error leading-snug px-0.5">
              {error}
            </p>
          )}
        </form>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-12 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-center mb-4">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent/50"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </div>
            <p className="text-sm text-secondary mb-1">No channels yet</p>
            <p className="text-xs text-muted leading-relaxed">
              Add a Telegram channel above
              <br />
              to start reading.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {channels.map((channel, i) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                index={i}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[280px] border-r border-card-border bg-surface/80 backdrop-blur-md shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${
              closing ? "animate-fade-out" : "animate-fade-in"
            }`}
            onClick={handleClose}
          />

          {/* Drawer panel */}
          <div
            className={`relative w-[300px] max-w-[85vw] h-full bg-surface border-r border-card-border flex flex-col ${
              closing ? "animate-drawer-out" : "animate-drawer-in"
            }`}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-11 h-11 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-card transition-colors cursor-pointer z-10"
              aria-label="Close sidebar"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>

            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

function ChannelRow({
  channel,
  index,
  onRemove,
}: {
  channel: ChannelEntry;
  index: number;
  onRemove: (channel: ChannelEntry) => void;
}) {
  const isInaccessible = channel.inaccessible;

  return (
    <li
      className={`channel-row group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-card/80 transition-colors duration-150 cursor-default ${
        isInaccessible ? "opacity-60" : ""
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Channel avatar placeholder */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isInaccessible
            ? "bg-error-bg border border-error/20"
            : "bg-accent/10 border border-accent/15"
        }`}
      >
        {isInaccessible ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-error"
          >
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zM8.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" />
          </svg>
        ) : (
          <span className="text-xs font-semibold text-accent uppercase">
            {channel.title.charAt(0)}
          </span>
        )}
      </div>

      {/* Channel info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-foreground font-medium truncate leading-tight">
            {channel.title}
          </p>
        </div>
        <p className={`text-xs truncate leading-tight mt-0.5 ${isInaccessible ? "text-error/70" : "text-muted"}`}>
          {isInaccessible ? "Channel inaccessible" : `@${channel.username}`}
        </p>
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(channel)}
        className="opacity-0 group-hover:opacity-100 md:w-6 md:h-6 w-11 h-11 rounded-md flex items-center justify-center text-muted hover:text-error hover:bg-error-bg transition-all duration-150 shrink-0 cursor-pointer max-md:opacity-100"
        aria-label={`Remove ${channel.title}`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </li>
  );
}
