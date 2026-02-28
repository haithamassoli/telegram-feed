import { CachedMessage } from "./types";
import { getClient } from "./telegram";
import { getMessages, setMessages } from "./storage";

const MAX_MESSAGES_PER_CHANNEL = 200;

// --- 3.1: Message fetching via GramJS ---

export async function fetchChannelMessages(
  channelId: string,
  channelUsername: string,
  channelTitle: string,
  limit: number = 20,
  offsetId?: number
): Promise<CachedMessage[]> {
  const client = getClient();
  if (!client) throw new Error("Not connected to Telegram");

  try {
    const entity = await client.getEntity(channelUsername);
    const result = await client.getMessages(entity, {
      limit,
      ...(offsetId ? { offsetId } : {}),
    });

    return result
      .filter((msg: Record<string, unknown>) => msg && msg.id)
      .map((msg: Record<string, unknown>) => ({
        id: msg.id as number,
        channelId,
        channelUsername,
        channelTitle,
        text: (msg.message as string) || "",
        date: (msg.date as number) || 0,
        hasMedia: !!msg.media,
        thumbnail: undefined,
      }));
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "className" in err &&
      (err as { className: string }).className === "FloodWaitError"
    ) {
      const seconds = (err as { seconds?: number }).seconds || 30;
      throw new FloodWaitException(seconds);
    }
    throw err;
  }
}

export class FloodWaitException extends Error {
  seconds: number;
  constructor(seconds: number) {
    super(`Rate limited. Retry in ${seconds}s`);
    this.name = "FloodWaitException";
    this.seconds = seconds;
  }
}

// --- 3.2: Message merging and deduplication ---

function messageKey(msg: CachedMessage): string {
  return `${msg.channelId}:${msg.id}`;
}

export function mergeAndDeduplicate(
  ...arrays: CachedMessage[][]
): CachedMessage[] {
  const seen = new Map<string, CachedMessage>();

  for (const arr of arrays) {
    for (const msg of arr) {
      const key = messageKey(msg);
      const existing = seen.get(key);
      // Keep the newer version (prefer fresh data with thumbnail)
      if (!existing || (msg.thumbnail && !existing.thumbnail)) {
        seen.set(key, msg);
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.date - a.date);
}

// --- 3.3: Message cache in localStorage ---

export function getCachedMessages(): CachedMessage[] {
  return getMessages();
}

export function updateCache(newMessages: CachedMessage[]): CachedMessage[] {
  const cached = getCachedMessages();
  const merged = mergeAndDeduplicate(cached, newMessages);

  // Enforce per-channel limit
  const byChannel = new Map<string, CachedMessage[]>();
  for (const msg of merged) {
    const arr = byChannel.get(msg.channelId) || [];
    arr.push(msg);
    byChannel.set(msg.channelId, arr);
  }

  const trimmed: CachedMessage[] = [];
  for (const [, msgs] of byChannel) {
    // Already sorted by date desc from mergeAndDeduplicate
    trimmed.push(...msgs.slice(0, MAX_MESSAGES_PER_CHANNEL));
  }

  // Re-sort the final trimmed list
  trimmed.sort((a, b) => b.date - a.date);
  setMessages(trimmed);
  return trimmed;
}

export function clearChannelFromCache(channelId: string): void {
  const cached = getCachedMessages();
  const filtered = cached.filter((m) => m.channelId !== channelId);
  setMessages(filtered);
}
