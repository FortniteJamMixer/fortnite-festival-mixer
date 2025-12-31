# Fortnite Festival Pro Mixer – Architecture & Optimization Review

## Executive Summary
The app successfully combines Fortnite song data, harmonic scoring, and profile management in a single-page build, but the monolithic 2.8k-line `index.html` mixes rendering, state, and networking without module boundaries. Repeated full-list renders and duplicated listeners create noticeable work for 500+ songs, and auth/profile flows have edge cases around listener cleanup and offline imports. Admin override persistence is reliable, yet overrides are applied client-side regardless of admin role. Targeted modularization, virtualization of song lists, and stricter auth/OAuth lifecycle handling will improve maintainability, responsiveness, and data safety.

## Critical Issues (Priority 1)
1. **Firebase auth listener never cleaned up** – `firebaseAuthUnsub` is set but never called on logout or re-init, so repeated sign-ins create stacked listeners that re-run `resolveAuthSuccess`, leading to duplicate saves/renders and possible race conditions during imports. Severity: High. 【F:index.html†L1398-L1405】【F:index.html†L1457-L1464】
2. **Stale song loads overwrite state** – `loadSongs()` performs sequential proxy fetches without cancellation; if called multiple times (login → profile switch → manual refresh) a slower earlier response can overwrite newer state, causing regression warnings or outdated genre overrides. Severity: Medium. 【F:index.html†L1467-L1513】
3. **Admin overrides enforced client-side only** – `applyCamelotOverride`/`applyBpmOverride` read overrides from localStorage for all users; non-admins can manually inject overrides in devtools to change compatibility scoring locally (and potentially sync via local backup/import). Severity: Medium. 【F:index.html†L815-L828】【F:index.html†L871-L903】

## Refactoring Recommendations (Priority 2)
1. **Split into modules** (High impact, Medium effort): Extract auth/profile, data fetch/parsing, scoring, and UI rendering into ES modules or separate script files to reduce coupling and enable targeted tests. Start with `loadSongs`, scoring helpers, and profile persistence. 【F:index.html†L1467-L1513】【F:index.html†L789-L809】
2. **Centralize state store** (High impact, Medium effort): Replace ad-hoc globals with a predictable store (e.g., lightweight observable or Redux-style reducer) to avoid desynchronized state between `renderSongList`, `renderProfile`, and sandbox/setlist views. 【F:index.html†L602-L666】【F:index.html†L1550-L1656】
3. **Reuse DOM & listeners** (Medium impact, Low effort): Convert string-based `innerHTML` renders to keyed item renderers (document fragments or templated components) and attach event listeners once; keep list items updated via data-binding to prevent repeated querySelectorAll passes. 【F:index.html†L1550-L1656】
4. **Auth lifecycle utilities** (Medium impact, Low effort): Add helper to attach/detach auth listener and reset auth-related state, called from login/logout and component teardown to prevent dangling async work. 【F:index.html†L1398-L1405】【F:index.html†L1457-L1464】
5. **Profile import pipeline** (Medium impact, Medium effort): Encapsulate offline-import logic so races between local imports and backend loads are resolved deterministically (e.g., compare timestamps, gate imports behind a mutex). 【F:index.html†L1353-L1395】

## Performance Optimizations (Priority 3)
1. **Virtualize song list** – Render only visible rows using an intersection observer or a tiny virtual scroller; expected to drop render time from O(n) DOM creation (~15–20ms per 100 cards) to O(visible) and eliminate >500ms spikes when toggling filters on 500+ songs. 【F:index.html†L1550-L1656】
2. **Memoize compatibility scoring** – Cache `priorityRank` results per anchor/mode and reuse across filter/search changes; reduces repeated `mashupCompatibility`/`camelotDistance` calls currently run on every render for each song. 【F:index.html†L789-L809】【F:index.html†L1550-L1577】
3. **Parallelize + cache song fetches** – Fire both proxy requests with `Promise.allSettled`, short-circuit on first success, and debounce `loadSongs()` to avoid duplicate work; prevents the double JSON parse and DOM rebuild per invocation. 【F:index.html†L1467-L1495】
4. **Batch sandbox drag updates** – Debounce drag/drop state writes and avoid re-rendering full list when sandbox changes; keep sandbox UI isolated to reduce main list churn. 【F:index.html†L1550-L1656】

## Security & Data Integrity Notes
- OAuth PKCE handling on the server enforces state, redirect URI equality, and HttpOnly storage of the verifier, aligning with best practices. 【F:api/oauth/epic/start.js†L43-L94】【F:api/oauth/epic/callback.js†L111-L235】
- Client callback gracefully handles Epic error codes but depends on Firebase being available; add a signed, short-lived nonce in the callback payload to defend against tab preloading or malicious retries. 【F:oauth-callback.html†L52-L205】

## Code Snippets (before → after)
- **Auth listener cleanup**
  - Before: listener assigned once, never detached on logout. 【F:index.html†L1398-L1405】【F:index.html†L1457-L1464】
  - After: store `firebaseAuthUnsub` and call it inside `logoutUser()`; guard `setupFirebaseAuthListener()` with unsubscribe/reattach for multi-login sessions.
- **Virtualized render**
  - Before: full list regenerated with template strings and fresh event binding every render. 【F:index.html†L1550-L1656】
  - After: maintain a pool of row elements keyed by song id; update text/content only, and let a virtual scroller dictate which rows mount/unmount.
- **Concurrent fetch protection**
  - Before: sequential proxy requests with no cancellation can overwrite fresh state. 【F:index.html†L1467-L1495】
  - After: use an abortable fetch with request token; ignore late responses and persist the first successful payload.

## Implementation Roadmap (Priority 4)
**Phase 1 – Foundations (S)**
- Add auth listener teardown, debounce `loadSongs()`, and ignore late fetches.
- Introduce a central state module exporting getters/setters and event hooks.

**Phase 2 – Performance (M)**
- Implement virtualized song list renderer and memoized compatibility cache.
- Isolate sandbox/setlist renders from main list updates.

**Phase 3 – Reliability (M)**
- Formalize profile import/merge with timestamps and conflict resolution.
- Gate admin override application behind an `isAdmin()` check before applying local overrides.

**Phase 4 – Modularization (L-M)**
- Extract scoring, data-fetch, auth/profile, and UI components into separate modules/files and add unit tests for scoring and overrides.
