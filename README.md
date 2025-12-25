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
