import { ChannelEntry, CachedMessage, ReadMarker } from "./types";

const KEYS = {
  session: "ts_session",
  channels: "ts_channels",
  messages: "ts_messages",
  readMarker: "ts_read_marker",
} as const;

function get<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Quota error listeners
type QuotaListener = (exceeded: boolean) => void;
const quotaListeners = new Set<QuotaListener>();

export function onQuotaError(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  return () => quotaListeners.delete(listener);
}

function notifyQuotaError(exceeded: boolean) {
  quotaListeners.forEach((l) => l(exceeded));
}

function set<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" || e.code === 22)
    ) {
      notifyQuotaError(true);
    }
    return false;
  }
}

// Clear only the message cache (preserves session + channels)
export function clearMessageCache(): void {
  remove(KEYS.messages);
  notifyQuotaError(false);
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

// Session
export function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.session);
}

export function setSession(session: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(KEYS.session, session);
    return true;
  } catch {
    return false;
  }
}

export function removeSession(): void {
  remove(KEYS.session);
}

// Channels
export function getChannels(): ChannelEntry[] {
  return get<ChannelEntry[]>(KEYS.channels) ?? [];
}

export function setChannels(channels: ChannelEntry[]): boolean {
  return set(KEYS.channels, channels);
}

// Messages
export function getMessages(): CachedMessage[] {
  return get<CachedMessage[]>(KEYS.messages) ?? [];
}

export function setMessages(messages: CachedMessage[]): boolean {
  return set(KEYS.messages, messages);
}

// Read Marker
export function getReadMarker(): ReadMarker | null {
  return get<ReadMarker>(KEYS.readMarker);
}

export function setReadMarker(marker: ReadMarker): boolean {
  return set(KEYS.readMarker, marker);
}

export function removeReadMarker(): void {
  remove(KEYS.readMarker);
}

// Clear all app data
export function clearAll(): void {
  Object.values(KEYS).forEach((key) => remove(key));
}
