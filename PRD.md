# TeleStream — Telegram Channel Timeline Reader

## Summary

A fast, client-side Next.js web app that merges multiple Telegram public channels into a single scrollable timeline. Users authenticate via Telegram MTProto (GramJS in-browser), add channels by username, and browse a unified feed of text posts + image thumbnails. Each post links to the original Telegram message. The app remembers the user's last read position in localStorage so they can pick up where they left off. No backend database. No accounts. Everything runs in the browser.

---

## Problem

Telegram power users follow 5–10 channels but have no way to read them in a single, chronological stream. They jump between channels, lose their place, and miss posts. Telegram's native UI treats each channel as isolated. There's no "timeline" view and no cross-channel read position.

---

## Target User

Anyone who follows multiple Telegram channels and wants a single, fast, distraction-free reading experience. Initially: personal use / small audience. No monetization.

---

## Core Concepts

| Concept          | Definition                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| **Session**      | Telegram MTProto user session stored in localStorage via GramJS. Persists across reloads.             |
| **Channel List** | User-curated list of Telegram channel usernames, stored in localStorage.                              |
| **Timeline**     | Merged, reverse-chronological feed of messages from all added channels.                               |
| **Read Marker**  | Global scroll position (message ID + timestamp) saved in localStorage. Represents "where I left off." |

---

## Architecture

```
Browser (100% client-side)
├── Next.js (App Router, static export)
├── GramJS (MTProto in-browser via WebSocket)
├── localStorage
│   ├── MTProto session data
│   ├── Channel list
│   ├── Cached messages (last N per channel)
│   └── Read marker (global position)
└── UI (React + Tailwind)
```

**No server-side API routes needed.** Next.js is used purely as a React framework with static export (`output: 'export'`). Can be deployed to Vercel, Netlify, or any static host for free.

### Why GramJS in-browser

- Reads any public channel without bot admin access.
- User authenticates with their own Telegram account (phone + code).
- Session persists in localStorage — no re-auth on reload.
- Runs entirely client-side. No proxy server needed for MTProto (GramJS supports WebSocket transport).

---

## Features (v1)

### F1: Telegram Authentication

- User enters phone number → receives Telegram auth code → enters code.
- Optional 2FA password step if enabled on their account.
- GramJS `StringSession` saved to localStorage.
- "Log out" clears session + all local data.

### F2: Channel Management

- Input field to add channel by `@username`.
- Validate channel exists and is accessible via GramJS `getEntity()`.
- Display list of added channels with remove button.
- Store channel list in localStorage as `Array<{ username, title, id }>`.
- Max 10 channels enforced client-side.

### F3: Merged Timeline

- Fetch last 50 messages per channel on load (GramJS `getMessages()`).
- Merge all messages into single array, sorted by date descending.
- Each timeline item renders:
  - Channel name + avatar (small, left-aligned).
  - Message text (truncated to ~300 chars with "show more").
  - Image thumbnail if message has photo (GramJS `downloadMedia()` with thumbnail size).
  - Timestamp (relative: "2h ago", "yesterday").
  - Click → opens `https://t.me/{channel_username}/{message_id}` in new tab.
- Infinite scroll upward (load older messages on demand).
- Pull-to-refresh or refresh button to fetch new messages.

### F4: Read Marker ("Resume where I left off")

- On scroll, debounce-save the ID + timestamp of the topmost visible message in viewport.
- Store as `{ messageId, channelId, timestamp }` in localStorage.
- On app load: if read marker exists, show a "Jump to where you left off" button at top.
- Clicking it scrolls to that position (or nearest available message if cache expired).
- If the marker message is no longer in cache, fetch messages around that timestamp and scroll.

### F5: Polling for Updates

- Every 3 minutes, re-fetch latest 20 messages per channel.
- Merge new messages into timeline without disrupting scroll position.
- Show unread count badge: "12 new messages ↑" sticky at top. Click to scroll up.

---

## Data Model (localStorage)

```typescript
// Keys in localStorage

"ts_session"       → string  // GramJS StringSession
"ts_channels"      → string  // JSON: ChannelEntry[]
"ts_messages"      → string  // JSON: CachedMessage[]
"ts_read_marker"   → string  // JSON: ReadMarker

// Types

interface ChannelEntry {
  id: string;          // Telegram channel ID
  username: string;    // @username
  title: string;       // Display name
  avatarUrl?: string;  // Base64 thumbnail or blob URL
}

interface CachedMessage {
  id: number;
  channelId: string;
  channelUsername: string;
  channelTitle: string;
  text: string;
  date: number;        // Unix timestamp
  thumbnail?: string;  // Base64 data URL
  hasMedia: boolean;
}

interface ReadMarker {
  messageId: number;
  channelId: string;
  timestamp: number;
}
```

### Cache Strategy

- Keep max 200 messages per channel in localStorage (~1–2MB total for 10 channels).
- On fetch, merge + deduplicate by message ID.
- Evict oldest messages when limit exceeded.
- Total localStorage budget: ~5MB (well within browser limits).

---

## UI Screens

### Screen 1: Auth

- Clean centered card.
- Phone input → code input → optional 2FA.
- Loading spinner during connection.
- Error states: wrong code, flood wait, network error.

### Screen 2: Main (Timeline + Sidebar)

- **Left sidebar** (collapsible on mobile):
  - Added channels list with avatars.
  - "Add channel" input at top.
  - Each channel: name + remove button.
- **Center: Timeline**
  - Scrollable feed.
  - "Jump to where you left off" banner (conditional).
  - "X new messages ↑" sticky banner (conditional).
  - Empty state: "Add channels to start reading."
- **No right sidebar. No settings page for v1.**

### Mobile

- Sidebar becomes hamburger drawer.
- Timeline takes full width.
- Touch-friendly tap targets.

---

## Performance Requirements

| Metric                     | Target           |
| -------------------------- | ---------------- |
| First Contentful Paint     | < 1s             |
| Time to Interactive        | < 2s             |
| Timeline render (200 msgs) | < 100ms          |
| Scroll jank                | 0 dropped frames |
| localStorage read/write    | < 50ms           |

### Techniques

- Static export — no SSR overhead.
- Virtualized list (e.g., `@tanstack/react-virtual`) for timeline — only render visible items.
- Lazy-load thumbnails with `IntersectionObserver`.
- Debounce read marker saves (500ms).
- Web Worker for GramJS operations to avoid blocking main thread.
- Messages stored in memory as sorted array; localStorage is sync-on-change backup.

---

## Edge Cases

| Case                                  | Handling                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| Channel goes private after adding     | Show error badge on channel; skip in timeline. Prompt removal.                          |
| User's Telegram session expires       | Detect auth error → redirect to login screen. Clear session.                            |
| localStorage full                     | Show warning. Suggest removing channels or clearing cache.                              |
| Message deleted from original channel | Link will 404 on Telegram. No action needed — stale cache is acceptable.                |
| Flood wait from Telegram API          | Respect `FloodWaitError` — show "Rate limited, retrying in Xs" toast. Back off polling. |
| No internet                           | Show cached timeline with "Offline" banner. Resume polling when online.                 |
| Duplicate messages across fetches     | Deduplicate by `channelId + messageId` composite key.                                   |

---

## Tech Stack

| Layer           | Choice                                                              |
| --------------- | ------------------------------------------------------------------- |
| Framework       | Next.js 14+ (App Router, static export)                             |
| Telegram Client | GramJS (`telegram` npm package)                                     |
| Styling         | Tailwind CSS                                                        |
| Virtual Scroll  | `@tanstack/react-virtual`                                           |
| State           | React `useState`/`useReducer` + Context. No external state library. |
| Storage         | localStorage (wrapper with JSON parse/stringify + error handling)   |
| Deployment      | Vercel free tier (static)                                           |

---

## Non-Goals (v1)

- No backend / database / Convex.
- No multi-device sync.
- No user accounts.
- No search within timeline.
- No filtering by channel in timeline view.
- No video playback.
- No file/document rendering.
- No dark/light theme toggle (ship with dark only — matches Telegram aesthetic).
- No notification system.
- No message forwarding or interaction.

---

## Security Considerations

- MTProto session is sensitive — equivalent to being logged into Telegram. Warn user on auth screen.
- `StringSession` in localStorage is accessible to any JS on the same origin. Acceptable for v1 personal tool. Not suitable for shared/public computers.
- No data leaves the browser. No analytics. No third-party scripts.
- CSP headers should block external scripts.

---

## Milestones

| #   | Milestone                    | Scope                                                             |
| --- | ---------------------------- | ----------------------------------------------------------------- |
| 1   | Auth flow                    | GramJS init, phone/code/2FA, session persist, logout.             |
| 2   | Channel management           | Add/remove/validate channels, localStorage CRUD.                  |
| 3   | Timeline rendering           | Fetch messages, merge, sort, virtualized list, thumbnails, links. |
| 4   | Read marker                  | Save/restore scroll position, "jump to" UX.                       |
| 5   | Polling + new message banner | Background fetch, merge without scroll disruption, unread badge.  |
| 6   | Polish + deploy              | Mobile responsive, error handling, edge cases, Vercel deploy.     |

---

## Open Questions

1. **GramJS bundle size**: GramJS is ~200KB+ gzipped. Acceptable? Could lazy-load after initial paint.
2. **Telegram ToS**: MTProto user API usage for timeline aggregation is gray area. Low risk for personal/small-scale use. Flag if scaling.
3. **Avatar caching**: Downloading channel avatars via GramJS adds API calls. Cache as base64 in localStorage or skip avatars for v1?
