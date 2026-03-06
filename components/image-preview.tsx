"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { getClient } from "@/lib/telegram";

interface ImagePreviewProps {
  thumbnailSrc: string;
  channelUsername: string;
  messageId: number;
  onClose: () => void;
}

export function ImagePreview({
  thumbnailSrc,
  channelUsername,
  messageId,
  onClose,
}: ImagePreviewProps) {
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const blobUrlRef = useRef<string | null>(null);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Download full-res image
  useEffect(() => {
    let cancelled = false;

    async function download() {
      const client = getClient();
      if (!client) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        const entity = await client.getEntity(channelUsername);
        const msgs = await client.getMessages(entity, { ids: [messageId] });
        const msg = msgs?.[0];
        if (!msg?.media) {
          setError(true);
          setLoading(false);
          return;
        }

        const buffer = await client.downloadMedia(msg.media);
        if (cancelled) return;

        if (!buffer) {
          setError(true);
          setLoading(false);
          return;
        }

        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const blob = new Blob([bytes], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setFullSrc(url);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    download();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [channelUsername, messageId]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm lightbox-backdrop-in"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors cursor-pointer"
        aria-label="Close preview"
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
          <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
        </svg>
      </button>

      {/* Image container */}
      <div className="relative max-w-[90vw] max-h-[90vh] lightbox-img-in">
        {/* Thumbnail as blurred placeholder */}
        {!fullSrc && (
          <Image
            src={thumbnailSrc}
            alt=""
            width={800}
            height={600}
            unoptimized
            className={`max-w-[90vw] max-h-[90vh] object-contain rounded-lg ${
              loading ? "blur-sm scale-[1.02]" : ""
            }`}
          />
        )}

        {/* Full-res image */}
        {fullSrc && (
          <img
            src={fullSrc}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          />
        )}

        {/* Loading spinner overlay */}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/60 rounded-lg px-4 py-2.5">
              <p className="text-xs text-white/70">Could not load full image</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
