# Fortnite Jam Mixer
🎵 DJ mixing tool for Fortnite Festival - Find harmonically compatible tracks using the Camelot Wheel system. Browse songs by BPM, key, and build perfect setlists in Fortnite Jam Mixer.

## Firebase config via Vercel env vars
This app now loads Firebase configuration at runtime from the `/api/firebase-config.js` endpoint. Add the following Environment Variables in Vercel so the function can return a usable config:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

Steps:
1. Go to **Vercel → Project Settings → Environment Variables**.
2. Add each of the variables above (for Production/Preview as needed).
3. Redeploy the project so `/api/firebase-config.js` serves the config before the app initializes Firebase.

For local-only testing, you may copy `firebase-config.example.js` to `firebase-config.js` and fill in your keys, but production builds should rely on the Vercel environment variables.

### Safe community metrics (Firebase Admin)
Server-side metrics rely on the Firebase Admin SDK. Add one of the following credential configurations to Vercel:

- `FIREBASE_ADMIN_CREDENTIALS` — the full service-account JSON string.
- or `FIREBASE_ADMIN_PRIVATE_KEY` **and** `FIREBASE_ADMIN_CLIENT_EMAIL` (plus `FIREBASE_PROJECT_ID`).
- or `GOOGLE_APPLICATION_CREDENTIALS` pointing to a bundled credential file.

The API routes `/api/metrics/try` and `/api/metrics/ping` will initialize Admin from the values above to:

- Deduplicate “Tried it” counts in `metricsVisitors/{anonId}` and increment `stats/global.totalTried`.
- Calculate “New (24h)” via a rolling Firestore query.
- Track peak concurrent users in `stats/daily_YYYY-MM-DD` (America/Chicago).

Presence uses Firebase Realtime Database (`/presence/{uid}`) with anonymous auth so the client never writes to stats directly.

## Epic OAuth setup

The app keeps Firebase email/password as the primary login but now includes an Epic-link flow with server-side PKCE/state storage. Configure these Vercel env vars:

- `EPIC_CLIENT_ID`
- `EPIC_CLIENT_SECRET`
- `APP_ORIGIN` (optional; falls back to the current host)

Add the following redirect URI to your Epic Developer Portal configuration (must match `APP_ORIGIN` exactly):

- `<APP_ORIGIN>/oauth-callback.html?oauth=epic`

Redirect discipline:

- Register separate, exact redirect entries for production and preview domains (no wildcards, protocol/path/query must match
  exactly).
- Preview OAuth is blocked unless `ALLOW_PREVIEW_OAUTH=true` is set.
- Keep trailing-slash behavior identical to the configured callback above.

Flow overview (security-first):

1. `/api/oauth/epic/start` generates PKCE values + CSRF state, stores them in a short-lived, HttpOnly, Secure, SameSite=Lax cookie, and redirects to Epic.
2. Epic returns to `/oauth-callback.html` with `code` and `state`.
3. The callback page calls `/api/oauth/epic/callback` (credentials included) to validate state, enforce the cookie TTL, and exchange the code using the stored `code_verifier` + server-only `client_secret`.
4. On success, the user’s Firestore profile gets `oauth.epic = { linked: true, epicAccountId, displayName, linkedAt }`. Tokens are never returned to the client.

Notes:

- The OAuth cookie is cleared on every success/failure attempt to enforce single-use.
- The redirect URI is restricted to `APP_ORIGIN` to prevent code exfiltration.
- Firebase sign-in flows continue to work unchanged; OAuth is only for optional Epic account linking.
- Firestore shape is provider-agnostic under `users/{uid}/integrations/{provider}`; see `docs/epic-oauth-firestore.md` for
  the canonical schema and operational guardrails.
- Jam Track ownership remains manual; OAuth links only record Epic account ids for potential future entitlement APIs.

## Test checklist (manual)
- Production/Vercel: load app → Online banner shows when env vars are set; no config warning.
- Missing env vars: load app → Online unavailable banner + local profile flow.
- Sign up → refresh → still signed in (onAuthStateChanged restores session).
- Edit profile → refresh → changes persist online (Firestore) and offline (local storage).
- Friends search: <3 chars shows prompt; 3+ chars returns limited results; backspace doesn’t spam reads.
- Rules sanity: user A cannot write user B profile via devtools.
- Toggle offline in devtools → Offline banner shown; app continues to work locally.
