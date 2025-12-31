import { verifyFirebaseIdToken } from "./firebase-auth";
import { clearEpicLink } from "./link-store";

function extractIdToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return null;
}

export default async function handler(req, res) {
  if (!req.method || !["POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const idToken = extractIdToken(req);
  const firebaseUser = await verifyFirebaseIdToken(idToken);
  if (!firebaseUser?.uid) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const revokedAt = Date.now();
    const cleared = await clearEpicLink(firebaseUser.uid, idToken, { revokedAt });
    if (!cleared) {
      return res.status(500).json({ ok: false, error: "Failed to unlink Epic" });
    }
    return res.status(200).json({ ok: true, linked: false, revokedAt });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Failed to unlink Epic" });
  }
}
