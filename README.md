# fortnite-festival-mixer
🎵 DJ mixing tool for Fortnite Festival - Find harmonically compatible tracks using the Camelot Wheel system. Browse songs by BPM, key, and build perfect setlists.

## Firebase configuration
- The app ships with a baked-in Firebase config so it can run without any local files.
- To use a private/local config, create or edit `firebase-config.js` in the project root. It is loaded automatically when present and any non-empty values override the defaults.
- Missing or invalid config keys will skip Firebase initialization; warnings only appear when running on `localhost`.
