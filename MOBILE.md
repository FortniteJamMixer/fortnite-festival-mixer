# Mobile Performance + Onboarding Notes

## Pagination / windowing
- Mobile viewports (<768px) render a **windowed list** of tracks using a 40-card chunk size and a hard cap of 80 cards in the DOM.
- The list starts with 40 cards and uses an IntersectionObserver to auto-load up to 80. Once the cap is hit, the "Next" / "Previous" buttons shift the window by 40 so we never exceed 80 cards at once.
- Desktop continues to use the existing page-size selector and pagination bar.

### Tweak page size for mobile
- Update `MOBILE_PAGE_CHUNK` (default 40) and `MOBILE_MAX_CARDS` (default 80) in `index.html`.

## Caching behavior
- Tracks are cached in IndexedDB (`ffm-track-cache`).
- On load, cached tracks render immediately (if available) for instant UI, then a background refresh fetches the network source and swaps if newer.
- If the network fails and no cache exists, the app falls back to sample tracks with a user-facing banner.

## Quick perf snapshot
- The app logs these to the console:
  - **First list render time** from `loadSongs()` start → list render.
  - **Max cards rendered at once on mobile** (should remain ≤ 80).

## Perf smoke test
- In a browser session with the app loaded, run:
  ```js
  import('/perf.smoke.test.js').then(mod => mod.runPerfSmokeTests());
  ```
- The test asserts:
  - Mobile render caps at <= 80 cards.
  - Search debounce limits rapid render calls.
  - Owned toggle updates UI without full list re-render.
