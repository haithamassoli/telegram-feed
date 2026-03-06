import { getSession, setSession } from "./storage";

const API_ID = parseInt(process.env.NEXT_PUBLIC_TELEGRAM_API_ID || "0", 10);
const API_HASH = process.env.NEXT_PUBLIC_TELEGRAM_API_HASH || "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;

export function getClient() {
  return client;
}

export async function initClient(sessionString?: string) {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions");

  const saved = sessionString ?? getSession() ?? "";
  const session = new StringSession(saved);

  client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 10,
    retryDelay: 2000,
    autoReconnect: true,
    useWSS: true,
  });

  await client.connect();
  return client;
}

export async function isAuthenticated(): Promise<boolean> {
  if (!client) return false;
  try {
    await client.getMe();
    return true;
  } catch {
    return false;
  }
}

export function saveSession(): void {
  if (!client) return;
  const sessionStr = client.session.save();
  setSession(sessionStr);
}

export async function destroyClient(): Promise<void> {
  if (client) {
    try {
      await client.destroy();
    } catch {
      // ignore
    }
    client = null;
  }
}

export { API_ID, API_HASH };
