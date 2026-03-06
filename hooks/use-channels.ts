"use client";

import { useState, useCallback, useEffect } from "react";
import { ChannelEntry } from "@/lib/types";
import { getChannels, setChannels } from "@/lib/storage";
import { getClient } from "@/lib/telegram";
import { toBase64 } from "@/lib/utils";

const MAX_CHANNELS = 10;

export type AddChannelError =
  | "not_found"
  | "private"
  | "already_added"
  | "limit_reached"
  | "network_error"
  | "not_authenticated";

export type AddChannelResult =
  | { ok: true; channel: ChannelEntry }
  | { ok: false; error: AddChannelError; message: string };

export function useChannels() {
  const [channels, setChannelsState] = useState<ChannelEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setChannelsState(getChannels());
  }, []);

  const syncToStorage = useCallback((updated: ChannelEntry[]) => {
    setChannelsState(updated);
    setChannels(updated);
  }, []);

  const addChannel = useCallback(
    async (rawUsername: string): Promise<AddChannelResult> => {
      const username = rawUsername.replace(/^@/, "").trim();
      if (!username) {
        return { ok: false, error: "not_found", message: "Please enter a channel username." };
      }

      const current = getChannels();

      if (current.length >= MAX_CHANNELS) {
        return {
          ok: false,
          error: "limit_reached",
          message: `Maximum ${MAX_CHANNELS} channels allowed.`,
        };
      }

      if (current.some((c) => c.username.toLowerCase() === username.toLowerCase())) {
        return {
          ok: false,
          error: "already_added",
          message: `@${username} is already in your list.`,
        };
      }

      const client = getClient();
      if (!client) {
        return {
          ok: false,
          error: "not_authenticated",
          message: "Not connected to Telegram.",
        };
      }

      setIsLoading(true);
      try {
        const entity = await client.getEntity(username);

        const className = entity?.className;
        if (className !== "Channel") {
          return {
            ok: false,
            error: "private",
            message: "This is not a public channel.",
          };
        }

        if (entity.megagroup) {
          return {
            ok: false,
            error: "private",
            message: "Groups are not supported — only channels.",
          };
        }

        let avatarUrl: string | undefined;
        try {
          const buffer = await client.downloadProfilePhoto(entity);
          if (buffer && buffer.length > 0) {
            const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
            avatarUrl = `data:image/jpeg;base64,${toBase64(bytes)}`;
          }
        } catch {
          // Fall back to letter avatar
        }

        const channel: ChannelEntry = {
          id: entity.id.toString(),
          username: entity.username || username,
          title: entity.title || username,
          avatarUrl,
        };

        const updated = [...current, channel];
        syncToStorage(updated);

        return { ok: true, channel };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error";

        if (
          message.includes("No user has") ||
          message.includes("Cannot find any entity") ||
          message.includes("Could not find the input entity")
        ) {
          return {
            ok: false,
            error: "not_found",
            message: `Channel @${username} not found.`,
          };
        }

        if (message.includes("INVITE_HASH") || message.includes("private")) {
          return {
            ok: false,
            error: "private",
            message: "This channel is private.",
          };
        }

        return {
          ok: false,
          error: "network_error",
          message: "Network error. Please try again.",
        };
      } finally {
        setIsLoading(false);
      }
    },
    [syncToStorage]
  );

  const removeChannel = useCallback(
    (id: string) => {
      const current = getChannels();
      const updated = current.filter((c) => c.id !== id);
      syncToStorage(updated);
    },
    [syncToStorage]
  );

  const markInaccessible = useCallback(
    (id: string, inaccessible: boolean) => {
      const current = getChannels();
      const updated = current.map((c) =>
        c.id === id ? { ...c, inaccessible } : c
      );
      syncToStorage(updated);
    },
    [syncToStorage]
  );

  return {
    channels,
    addChannel,
    removeChannel,
    markInaccessible,
    isLoading,
    maxChannels: MAX_CHANNELS,
  };
}
