# TeleStream — Project Milestones & Tasks

---

## Milestone 1: Auth Flow

**Goal:** Users can authenticate with their Telegram account via GramJS MTProto in the browser and maintain a persistent session.

**Exit Criteria:** A user can log in with their Telegram account, reload the page without re-authenticating, and log out cleanly.

### Tasks

- [x] **1.1 — Install GramJS and configure Next.js for client-side MTProto**
  Install the `telegram` npm package (GramJS). Update `next.config.ts` to set `output: 'export'` for static builds. Add any required webpack/bundler polyfills for GramJS to run in the browser (e.g., `buffer`, `crypto` shims). Verify the dev server starts without build errors.

- [x] **1.2 — Create localStorage utility module**
  Create a typed wrapper around localStorage with JSON parse/stringify, error handling (quota exceeded, parse failures), and typed getter/setter functions for all keys defined in the PRD: `ts_session`, `ts_channels`, `ts_messages`, `ts_read_marker`. Include a `clearAll()` function for logout. Define the TypeScript interfaces: `ChannelEntry`, `CachedMessage`, `ReadMarker`.

- [x] **1.3 — Create Telegram client singleton module**
  Create a module that initializes a GramJS `TelegramClient` with WebSocket transport, using `StringSession` loaded from localStorage. Expose functions: `initClient()`, `getClient()`, `isAuthenticated()`. The client should be lazily initialized and reused across the app. Use environment variables (or hardcoded constants for v1) for API ID and API hash.

- [x] **1.4 — Build the Auth screen UI**
  Create the auth page as the default screen when no session exists. Multi-step centered card layout: Step 1 — phone number input with country code. Step 2 — auth code input (6-digit). Step 3 — 2FA password input (conditional). Include loading spinners during API calls, a security warning about session sensitivity, and a clean dark-themed design using Tailwind.

- [x] **1.5 — Implement phone number submission and code request**
  Wire the phone input to GramJS `client.sendCode()`. Handle the response and transition to the code input step. Handle errors: invalid phone number, flood wait (`FloodWaitError` with countdown display), network errors. Store the `phoneCodeHash` in component state for the verification step.

- [x] **1.6 — Implement code verification and 2FA**
  Wire the code input to GramJS `client.signIn()`. On success, save the `StringSession` to localStorage and navigate to the main app. If the API returns a `SessionPasswordNeededError`, show the 2FA password input and call `client.signIn()` with the password. Handle errors: wrong code, wrong password, expired code.

- [x] **1.7 — Implement session restore on app load**
  On app mount, check localStorage for an existing `ts_session`. If found, initialize the GramJS client with that session and verify it's still valid by calling `client.getMe()`. If valid, skip auth and show the main app. If invalid or expired, clear the session and redirect to the auth screen.

- [x] **1.8 — Implement logout**
  Add a logout button (visible in the sidebar/header). On click, call `client.destroy()`, clear all localStorage keys (`clearAll()`), and redirect to the auth screen. Confirm before clearing if there's meaningful local data.

- [x] **1.9 — Create auth context provider**
  Create a React context (`AuthContext`) that holds the current auth state: `loading`, `authenticated`, `unauthenticated`. Wrap the app layout so child components can read auth status. The main layout conditionally renders the auth screen or the main app based on this context.

---

## Milestone 2: Channel Management

**Goal:** Users can build and manage a list of up to 10 Telegram channels stored locally.

**Exit Criteria:** A user can add, view, and remove channels. The list persists across reloads. Invalid or inaccessible channels are handled gracefully.

### Tasks

- [x] **2.1 — Create channel store hook**
  Create a custom hook `useChannels()` that reads the channel list from localStorage (`ts_channels`), exposes the list as state, and provides `addChannel(username)`, `removeChannel(id)` functions. Changes sync back to localStorage immediately. Enforce the 10-channel maximum in `addChannel`.

- [x] **2.2 — Implement channel validation via GramJS**
  In `addChannel`, resolve the channel by username using GramJS `client.getEntity(username)`. Verify it's a public channel (not a private group or user). Extract and return `{ id, username, title }`. Handle errors: channel not found, channel is private, network error. Prevent adding duplicate channels.

- [x] **2.3 — Build the sidebar layout**
  Create a sidebar component for the main app screen. On desktop: fixed left sidebar (~280px). On mobile: hidden by default, toggled via a hamburger button as a slide-over drawer. The sidebar contains the channel list and the add-channel input. The main content area (timeline) sits to the right.

- [x] **2.4 — Build the "Add Channel" input**
  Add an input field at the top of the sidebar. Accepts a `@username` (with or without the `@` prefix). On submit, calls `addChannel` from the hook. Show a loading spinner while validating. Display inline error messages (not found, private, already added, limit reached). Clear input on success.

- [x] **2.5 — Build the channel list UI**
  Render each channel in the sidebar as a row: channel title and `@username`. Each row has a remove button (trash icon or X). Clicking remove calls `removeChannel(id)`. Show an empty state message when no channels are added: "Add a channel to get started."

- [x] **2.6 — Handle inaccessible channels**
  When fetching messages for a channel fails (e.g., channel went private), mark it with an error badge in the sidebar. Show a tooltip or small message: "Channel inaccessible." The channel stays in the list but is skipped in the timeline. The user can remove it manually.

---

## Milestone 3: Timeline Rendering

**Goal:** A merged, reverse-chronological feed of messages from all added channels, rendered in a performant virtualized list.

**Exit Criteria:** The timeline loads, merges, and renders messages from all added channels. Scrolling is smooth. Thumbnails load lazily. Clicking a post opens the original Telegram message.

### Tasks

- [x] **3.1 — Implement message fetching via GramJS**
  Create a function `fetchChannelMessages(channelId, limit, offsetId?)` that calls GramJS `client.getMessages()` and returns an array of `CachedMessage` objects. Map GramJS message objects to the `CachedMessage` interface. Handle `FloodWaitError` with backoff. Support pagination via `offsetId` for loading older messages.

- [x] **3.2 — Implement message merging and deduplication**
  Create a utility that takes multiple arrays of `CachedMessage[]` (one per channel), merges them into a single array, deduplicates by `channelId + messageId` composite key, and sorts by `date` descending. This utility will be used both for initial load and for incremental updates.

- [x] **3.3 — Implement message cache in localStorage**
  Create a caching layer around `ts_messages`. On fetch, merge new messages with cached ones using the dedup utility. Enforce a max of 200 messages per channel — evict the oldest when exceeded. Provide `getCachedMessages()` and `updateCache(messages)` functions. Total budget stays within ~5MB.

- [x] **3.4 — Create the timeline data hook**
  Create a `useTimeline()` hook that orchestrates: load cached messages from localStorage on mount, fetch fresh messages for all channels in parallel, merge and deduplicate, update state and cache. Expose: `messages[]`, `isLoading`, `error`, `loadOlder()`, `refresh()`. `loadOlder()` fetches the next batch using the oldest message's ID as offset.

- [x] **3.5 — Install and configure @tanstack/react-virtual**
  Install `@tanstack/react-virtual`. Set up a virtualized list container for the timeline. Configure the virtualizer with estimated item sizes (messages vary in height). The virtualizer should handle the scrollable area and only render visible items plus a small overscan buffer.

- [x] **3.6 — Build the timeline message card component**
  Create a `MessageCard` component that renders a single timeline item: channel name (small, left-aligned), message text (truncated to ~300 chars with a "show more" toggle), relative timestamp ("2h ago", "yesterday"), and a click handler that opens `https://t.me/{channelUsername}/{messageId}` in a new tab. Use a clean, dark-themed card style.

- [x] **3.7 — Implement image thumbnail loading**
  For messages where `hasMedia` is true, lazily load the thumbnail. Use `IntersectionObserver` (or the virtualizer's visibility) to trigger GramJS `downloadMedia()` with thumbnail size only when the card is near the viewport. Convert the downloaded buffer to a base64 data URL and display it in the card. Cache thumbnails in the `CachedMessage.thumbnail` field.

- [x] **3.8 — Implement infinite scroll for older messages**
  Detect when the user scrolls near the bottom of the list (oldest messages). Trigger `loadOlder()` from the timeline hook to fetch the next batch. Show a loading spinner at the bottom while fetching. Stop requesting when a channel returns fewer messages than the requested limit (end of history).

- [x] **3.9 — Build the refresh mechanism**
  Add a refresh button at the top of the timeline. On click, call `refresh()` from the timeline hook to re-fetch the latest messages for all channels. Merge new messages into the existing list without losing scroll position. Show a brief loading indicator during the fetch.

- [x] **3.10 — Build the timeline empty state**
  When no channels are added, show a centered message: "Add channels to start reading" with a prompt pointing to the sidebar. When channels exist but no messages are loaded yet, show a loading skeleton.

---

## Milestone 4: Read Marker

**Goal:** The app remembers where the user left off and offers a way to jump back to that position.

**Exit Criteria:** A user can close the app, reopen it, and resume reading from where they left off.

### Tasks

- [ ] **4.1 — Implement scroll position tracking**
  Using the virtualizer's scroll state, determine the topmost fully visible message in the viewport. Debounce this calculation (500ms). On each debounced tick, save the message's `{ messageId, channelId, timestamp }` to localStorage as the read marker (`ts_read_marker`).

- [ ] **4.2 — Build the "Jump to where you left off" banner**
  On app load, check if a read marker exists in localStorage. If it does, render a sticky banner at the top of the timeline: "Jump to where you left off." The banner should be dismissible (X button). Display the relative time of the marker ("from 3 hours ago") for context.

- [ ] **4.3 — Implement scroll-to-marker logic**
  When the user clicks the "Jump to" banner, find the marked message in the current messages array by `messageId + channelId`. If found, scroll the virtualizer to that item's index. If not found in the current cache, fetch messages around the marker's timestamp for the relevant channel, merge them in, then scroll.

- [ ] **4.4 — Handle stale read markers**
  If the marker's message cannot be found even after fetching, scroll to the nearest message by timestamp. Show a brief toast: "Original message not available — scrolled to nearest." If the marker is very old (e.g., > 7 days), auto-dismiss it and don't show the banner.

---

## Milestone 5: Polling + New Message Banner

**Goal:** The timeline stays up-to-date with background polling and a non-disruptive new message indicator.

**Exit Criteria:** New messages appear without manual refresh. Scroll position is preserved. Rate limiting is handled.

### Tasks

- [ ] **5.1 — Implement polling interval**
  Set up a `setInterval` (3 minutes) that re-fetches the latest 20 messages per channel using GramJS. Run fetches in parallel across channels. Merge new messages into the timeline state using the existing merge/dedup utility. Clear the interval on unmount or logout. Pause polling when the tab is not visible (`document.visibilityState`).

- [ ] **5.2 — Preserve scroll position during updates**
  When new messages are prepended to the timeline (newer messages at top), adjust the virtualizer's scroll offset so the user's current view doesn't jump. The user should not perceive any visual change when background polling adds new messages above the viewport.

- [ ] **5.3 — Build the "New messages" sticky banner**
  When polling adds messages that are above the current viewport, show a sticky banner at the top: "X new messages ↑". Track the count of unseen new messages. Clicking the banner scrolls to the top and resets the counter. The banner disappears if the user manually scrolls to the top.

- [ ] **5.4 — Handle FloodWaitError and backoff**
  If any GramJS call during polling returns a `FloodWaitError`, pause polling for the duration specified by the error. Show a non-blocking toast: "Rate limited by Telegram. Retrying in Xs." Resume polling after the wait period. Apply exponential backoff if rate limits occur repeatedly.

---

## Milestone 6: Polish + Deploy

**Goal:** Production-ready app with responsive design, robust error handling, and static deployment.

**Exit Criteria:** The app is deployed, mobile-friendly, handles all documented edge cases, and meets performance targets.

### Tasks

- [ ] **6.1 — Finalize mobile responsive layout**
  Ensure the sidebar collapses into a hamburger drawer on screens below `768px`. The timeline takes full width on mobile. All tap targets are at least 44x44px. Test touch interactions: swipe to dismiss drawer, scroll momentum, pull-to-refresh gesture. Verify layout on common breakpoints (375px, 390px, 768px, 1024px).

- [ ] **6.2 — Implement offline mode**
  Detect network status via `navigator.onLine` and the `online`/`offline` events. When offline: show a top banner "You're offline — showing cached posts", display the cached timeline from localStorage, pause polling. When back online: dismiss the banner, resume polling, and fetch latest messages.

- [ ] **6.3 — Handle localStorage quota errors**
  Wrap all localStorage writes in try/catch. If a `QuotaExceededError` is caught, show a persistent warning: "Storage full. Try removing channels or clearing old data." Provide a "Clear cache" button that removes `ts_messages` (keeps session and channels). Prevent data loss by prioritizing session and channel data over message cache.

- [ ] **6.4 — Apply dark theme polish**
  Audit all components for consistent dark theme. Set the app background, card backgrounds, text colors, borders, input styles, and focus rings to a cohesive dark palette. Use Tailwind's dark color variables defined in `globals.css`. Ensure sufficient contrast for accessibility (WCAG AA for text).

- [ ] **6.5 — Lazy-load GramJS bundle**
  GramJS is ~200KB+ gzipped. Use dynamic `import()` to load it only after the initial page paint. Show a small loading indicator ("Connecting to Telegram...") while the module loads. This keeps FCP fast by deferring the heavy bundle.

- [ ] **6.6 — Configure static export and deployment**
  Set `output: 'export'` in `next.config.ts` (if not already done in 1.1). Verify `next build` produces a working static site in the `out/` directory. Configure Vercel deployment (or add a `vercel.json` if needed). Add CSP headers to block external scripts via `next.config.ts` headers config. Deploy and verify the live site works end-to-end.

- [ ] **6.7 — Add error boundaries and global error handling**
  Add a React error boundary around the main app to catch rendering crashes and show a recovery UI ("Something went wrong. Reload?"). Handle GramJS session expiry globally: detect `AuthKeyError` or similar, clear the session, and redirect to the auth screen with a message. Ensure no unhandled promise rejections from GramJS calls.

- [ ] **6.8 — Performance validation**
  Run Lighthouse on the deployed site. Validate against PRD targets: FCP < 1s, TTI < 2s. Test timeline rendering performance with 200+ messages — ensure scroll stays smooth (no dropped frames). Profile localStorage read/write times to confirm < 50ms. Fix any bottlenecks found.
