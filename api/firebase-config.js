export default function handler(req, res) {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };

  const missing = Object.entries(config).filter(([, value]) => !value);

  res.setHeader("Content-Type", "application/javascript");

  if (missing.length > 0) {
    const missingKeys = missing.map(([key]) => key).join(", ");
    res.status(200).send(
      `console.error('Firebase config missing env vars: ${missingKeys}');\nwindow.firebaseConfig = null;`
    );
    return;
  }

  res.status(200).send(`window.firebaseConfig = ${JSON.stringify(config)};`);
}
