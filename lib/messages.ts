import { CachedMessage, MediaType } from "./types";
import { getClient } from "./telegram";
import { getMessages, setMessages } from "./storage";

const MAX_MESSAGES_PER_CHANNEL = 200;

// --- Media type detection ---

function decodeWaveform(waveformBytes: Buffer | Uint8Array | undefined): number[] | undefined {
  if (!waveformBytes || waveformBytes.length === 0) return undefined;
  // Waveform is bitpacked 5-bit values
  const bars: number[] = [];
  let bitOffset = 0;
  while (bitOffset + 5 <= waveformBytes.length * 8) {
    const byteIndex = Math.floor(bitOffset / 8);
    const bitShift = bitOffset % 8;
    const value = ((waveformBytes[byteIndex] | (waveformBytes[byteIndex + 1] || 0) << 8) >> bitShift) & 0x1f;
    bars.push(value);
    bitOffset += 5;
  }
  return bars.length > 0 ? bars : undefined;
}

interface MediaInfo {
  mediaType?: MediaType;
  audioDuration?: number;
  audioTitle?: string;
  audioPerformer?: string;
  audioWaveform?: number[];
}

function extractMediaInfo(media: Record<string, unknown> | undefined): MediaInfo {
  if (!media) return {};

  const className = media.className as string | undefined;

  if (className === "MessageMediaPhoto") {
    return { mediaType: "photo" };
  }

  if (className === "MessageMediaDocument") {
    const document = media.document as Record<string, unknown> | undefined;
    if (!document) return { mediaType: "document" };

    const attributes = document.attributes as Array<Record<string, unknown>> | undefined;
    if (!attributes) return { mediaType: "document" };

    for (const attr of attributes) {
      if (attr.className === "DocumentAttributeAudio") {
        const isVoice = !!attr.voice;
        return {
          mediaType: isVoice ? "voice" : "audio",
          audioDuration: attr.duration as number | undefined,
          audioTitle: attr.title as string | undefined,
          audioPerformer: attr.performer as string | undefined,
          audioWaveform: decodeWaveform(attr.waveform as Buffer | Uint8Array | undefined),
        };
      }
      if (attr.className === "DocumentAttributeVideo") {
        return { mediaType: "video" };
      }
    }

    return { mediaType: "document" };
  }

  return {};
}

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
      .map((msg: Record<string, unknown>) => {
        const media = msg.media as Record<string, unknown> | undefined;
        const { mediaType, audioDuration, audioTitle, audioPerformer, audioWaveform } = extractMediaInfo(media);

        return {
          id: msg.id as number,
          channelId,
          channelUsername,
          channelTitle,
          text: (msg.message as string) || "",
          date: (msg.date as number) || 0,
          hasMedia: !!msg.media,
          thumbnail: undefined,
          mediaType,
          audioDuration,
          audioTitle,
          audioPerformer,
          audioWaveform,
        };
      });
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
      // Keep the newer version (prefer fresh data with thumbnail/audio)
      if (!existing || (msg.thumbnail && !existing.thumbnail) || (msg.audioSrc && !existing.audioSrc)) {
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
