export default function handler(req, res) {
  const clean = (v) => (v ?? "").toString().trim().replace(/^"|"$/g, "");

  const config = {
    apiKey: clean(process.env.FIREBASE_API_KEY),
    authDomain: clean(process.env.FIREBASE_AUTH_DOMAIN),
    projectId: clean(process.env.FIREBASE_PROJECT_ID),
    storageBucket: clean(process.env.FIREBASE_STORAGE_BUCKET),
    messagingSenderId: clean(process.env.FIREBASE_MESSAGING_SENDER_ID),
    appId: clean(process.env.FIREBASE_APP_ID),
    measurementId: clean(process.env.FIREBASE_MEASUREMENT_ID),
  };

  const requiredKeys = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];
  const missingKeys = requiredKeys.filter((key) => !config[key]);

  if (!config.measurementId) delete config.measurementId;

  res.setHeader("Cache-Control", "no-store");

  const wantsJson =
    req.query.format === "json" ||
    (req.headers.accept || "").includes("application/json");

  if (missingKeys.length > 0) {
    if (wantsJson) {
      res.status(500).json({ error: "Missing Firebase env vars", missingKeys });
    } else {
      res
        .status(500)
        .send(
          `console.error('Firebase config missing env vars: ${missingKeys.join(", ")}');window.firebaseConfig = null;`
        );
    }
    return;
  }

  if (wantsJson) {
    res.status(200).json(config);
    return;
  }

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");

  res.status(200).send(`window.firebaseConfig = ${JSON.stringify(config)};`);
}
