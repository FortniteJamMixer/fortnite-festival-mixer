# fortnite-festival-mixer
🎵 DJ mixing tool for Fortnite Festival - Find harmonically compatible tracks using the Camelot Wheel system. Browse songs by BPM, key, and build perfect setlists.

## Firebase setup
- Copy `firebase-config.example.js` to `firebase-config.js` and fill in your Firebase Web App credentials from **Project Settings → General → Your Apps → Config**.
- Keep `firebase-config.js` out of version control (it's already in `.gitignore`). On Vercel, supply the file via Environment Variables or another secure file injection so the client can load it at build/runtime.
- After deploying, restrict your API key to trusted referrers and only the Identity Toolkit API in the Google Cloud Console for better protection.
