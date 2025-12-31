# fortnite-festival-mixer
🎵 DJ mixing tool for Fortnite Festival - Find harmonically compatible tracks using the Camelot Wheel system. Browse songs by BPM, key, and build perfect setlists.

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

## Epic OAuth setup

The app keeps Firebase email/password as the primary login but now includes an Epic-link flow with server-side PKCE/state storage. Configure these Vercel env vars:

- `EPIC_CLIENT_ID`
- `EPIC_CLIENT_SECRET`
- `APP_ORIGIN` (optional; falls back to the current host)

Add the following redirect URI to your Epic Developer Portal configuration (must match `APP_ORIGIN` exactly):

- `<APP_ORIGIN>/oauth-callback.html?oauth=epic`

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
