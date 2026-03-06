"use client";

import { useState, useRef, useCallback, useEffect, memo } from "react";

interface AudioPlayerProps {
  src: string;
  duration?: number;
  waveform?: number[];
  title?: string;
  performer?: string;
  isVoice?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Normalize waveform to 0-1 range, or generate placeholder bars
function normalizeWaveform(waveform?: number[], barCount = 40): number[] {
  if (!waveform || waveform.length === 0) {
    // Generate a natural-looking placeholder waveform
    return Array.from({ length: barCount }, (_, i) => {
      const x = i / barCount;
      return 0.2 + 0.6 * Math.abs(Math.sin(x * Math.PI * 3.2) * Math.cos(x * Math.PI * 1.7));
    });
  }

  const max = Math.max(...waveform, 1);
  // Resample to target bar count
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const srcIndex = Math.floor((i / barCount) * waveform.length);
    bars.push(Math.max(0.08, waveform[srcIndex] / max));
  }
  return bars;
}

export const AudioPlayer = memo(function AudioPlayer({
  src,
  duration: initialDuration,
  waveform,
  title,
  performer,
  isVoice = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const animRef = useRef<number>(0);

  const barCount = isVoice ? 48 : 40;
  const bars = normalizeWaveform(waveform, barCount);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      cancelAnimationFrame(animRef.current);
    });

    return () => {
      cancelAnimationFrame(animRef.current);
      audio.pause();
      audio.src = "";
    };
  }, [src]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration || duration;
    if (dur > 0) {
      setProgress(audio.currentTime / dur);
      setCurrentTime(audio.currentTime);
    }
    if (!audio.paused) {
      animRef.current = requestAnimationFrame(updateProgress);
    }
  }, [duration]);

  const togglePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.pause();
        cancelAnimationFrame(animRef.current);
        setIsPlaying(false);
      } else {
        audio.play().then(() => {
          setIsPlaying(true);
          animRef.current = requestAnimationFrame(updateProgress);
        }).catch(() => {
          // Playback blocked
        });
      }
    },
    [isPlaying, updateProgress]
  );

  const handleWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const audio = audioRef.current;
      if (!audio) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const dur = audio.duration || duration;
      if (dur > 0) {
        audio.currentTime = x * dur;
        setProgress(x);
        setCurrentTime(x * dur);
      }
    },
    [duration]
  );

  const displayDuration = duration || initialDuration || 0;

  return (
    <div
      data-interactive
      className="audio-player flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface/40 border border-card-border cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-accent/15 hover:bg-accent/25 border border-accent/20 transition-all duration-200 cursor-pointer group"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-accent">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-accent ml-0.5">
            <path d="M6 4l15 8-15 8V4z" />
          </svg>
        )}
      </button>

      {/* Middle section */}
      <div className="flex-1 min-w-0">
        {/* Title/performer for audio (non-voice) */}
        {!isVoice && (title || performer) && (
          <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent/60 shrink-0">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span className="text-xs text-secondary truncate">
              {title && performer
                ? `${performer} — ${title}`
                : title || performer}
            </span>
          </div>
        )}

        {/* Waveform visualization */}
        <div
          className="waveform-container relative h-7 flex items-end gap-px cursor-pointer"
          onClick={handleWaveformClick}
        >
          {bars.map((height, i) => {
            const barProgress = i / bars.length;
            const isActive = barProgress <= progress;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-150"
                style={{
                  height: `${Math.max(12, height * 100)}%`,
                  backgroundColor: isActive
                    ? "var(--accent)"
                    : "var(--neutral-muted)",
                  opacity: isActive ? 1 : 0.5,
                }}
              />
            );
          })}
        </div>

        {/* Time display */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-mono text-muted tabular-nums">
            {isPlaying || currentTime > 0
              ? formatTime(currentTime)
              : formatTime(0)}
          </span>
          <span className="text-[10px] font-mono text-muted tabular-nums">
            {displayDuration > 0 ? formatTime(displayDuration) : "--:--"}
          </span>
        </div>
      </div>
    </div>
  );
});
