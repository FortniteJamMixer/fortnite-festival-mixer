import admin from "firebase-admin";

function normalizePrivateKey(key) {
  if (!key) return key;
  return key.replace(/\\n/g, "\n");
}

function parseServiceAccount(json) {
  if (!json) return null;
  try {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    if (parsed.private_key) parsed.private_key = normalizePrivateKey(parsed.private_key);
    return parsed;
  } catch (err) {
    console.error("Failed to parse Firebase Admin credentials", err);
    throw new Error("Invalid Firebase Admin credentials JSON");
  }
}

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT;
  const serviceAccount =
    parseServiceAccount(
      process.env.FIREBASE_ADMIN_CREDENTIALS ||
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.FIREBASE_SERVICE_ACCOUNT
    ) ||
    (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY) &&
      (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL)
      ? {
          project_id: projectId,
          private_key: normalizePrivateKey(
            process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY
          ),
          client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL,
        }
      : null;

  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp();
  }

  if (projectId) {
    try {
      return admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    } catch (err) {
      console.error("Failed to initialize Firebase Admin with applicationDefault", err);
    }
  }

  throw new Error("Firebase Admin credentials are not configured.");
}

export function getFirestore() {
  const app = getAdminApp();
  return admin.firestore(app);
}

export function getAdminAuth() {
  const app = getAdminApp();
  return admin.auth(app);
}

export const adminFieldValue = admin.firestore.FieldValue;
export const adminTimestamp = admin.firestore.Timestamp;
export { admin };
export { getAdminApp };
