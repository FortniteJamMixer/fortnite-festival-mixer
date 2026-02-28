# Cloud Sync + Offline Removal QA Checklist

Use this script to validate sync reliability in Chrome and cross-browser.

## Chrome (primary)
1. **Fresh session**
   - Open the app in a fresh Chrome profile.
   - Sign in.
   - Confirm the sync pill transitions to **Synced ✅** within 10s.
2. **Owned sync stress**
   - Mark 10 tracks as Owned quickly.
   - Confirm the pill shows **Saving…** then **Synced ✅**.
3. **Refresh persistence**
   - Refresh immediately after marking tracks.
   - Owned tracks remain marked.
4. **Logout flush**
   - Mark a track, then log out immediately.
   - If sync fails, the modal offers **Retry** or **Download backup**.
   - Log back in and verify Owned persists.
5. **New Chrome profile / Incognito**
   - Sign in and verify Owned tracks load.

## Cross-browser
1. Sign in on Chrome, mark Owned tracks.
2. Sign in on another browser (Edge/Firefox).
3. Verify the same Owned tracks appear.

## Offline behavior
1. Open DevTools → toggle offline.
2. Confirm the UI shows **Offline — Cloud Sync unavailable** and disables sync.
3. Ensure no messaging claims offline browsing is available.

## Debug panel (optional)
1. Open `/index.html?debug=1` and go to Profile.
2. Verify Auth status, Firestore readiness, sync state, and last sync data are visible.
3. Use **Retry Sync** and **Export Backup JSON** buttons.
