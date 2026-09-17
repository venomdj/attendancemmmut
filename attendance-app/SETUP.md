# Attendance Tracker — Setup

## Run it now (zero build step)
1. Unzip the folder.
2. Open `index.html` directly in a browser, **or** better, serve it locally so the service worker/PWA features work:
   ```
   npx serve .
   ```
   or
   ```
   python3 -m http.server 8080
   ```
3. Visit the local URL. On mobile Chrome/Safari, use "Add to Home Screen" to install it as a PWA.

## Your data
- Everything is stored in your browser's `localStorage` on this device — nothing leaves your device by default.
- Use **Settings → Export data** regularly to back up (it's a JSON file). **Import data** restores it, including on a new device/browser.

## Your timetable
Your real Batch P1/T1 schedule is baked into `data.js`. To edit it (new semester, timing change, etc.), just edit the `TIMETABLE` array — each entry is one weekly recurring class block. Add subjects to the `SUBJECTS` object first if new ones appear.

## Enabling cloud sync (optional, Firebase)
This build ships storage-agnostic: the `state` object in `app.js` is the single source of truth, saved via `saveState()`. To add Firebase sync:
1. Create a free Firebase project → enable **Firestore** and **Authentication** (anonymous auth is enough for single-user use).
2. Add the Firebase SDK via a `<script type="module">` in `index.html` and your project's config.
3. In `saveState()`, after the `localStorage.setItem` call, also `setDoc` the same `state` object to a Firestore document keyed by your anonymous auth UID.
4. On load, before `loadState()` falls back to localStorage, try fetching that Firestore doc first (with a short timeout) and merge if newer.
   This keeps the app fully working offline (localStorage) while syncing when online.

## Notifications
"Enable class reminders" in Settings requests browser Notification permission and checks every 5 minutes (while the tab/app is open) for classes that ended ~10 minutes ago and aren't yet marked. For true background push notifications (app closed), you'd need a backend push service (e.g. Firebase Cloud Messaging) — the current version is foreground-only, which covers the common case of leaving the PWA open/installed.

## Structure
- `index.html` — shell + styles
- `data.js` — your timetable & subjects (source of truth)
- `app.js` — state, attendance math, rendering, all views
- `sw.js` — offline caching
- `manifest.webmanifest` + `icon.svg` — installability

## Attendance math
- Cancelled classes never count toward total or attended — they're excluded entirely.
- "Classes you can miss" / "classes needed" are computed by simulating forward one class at a time until the percentage crosses your threshold — mathematically exact, not approximated.
- Unmarked past classes are treated as pending (not counted yet) rather than silently absent, so you won't get penalized for forgetting to log something until you actually mark it.
