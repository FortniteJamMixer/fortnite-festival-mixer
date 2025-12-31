import { buildClearCookie, COOKIE_NAME } from "./constants";
import { verifyFirebaseIdToken } from "./firebase-auth";
import { getEpicLink } from "./link-store";

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = rest.join("=");
    return acc;
  }, {});
}

function clearSessionCookieIfPresent(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies[COOKIE_NAME]) {
    res.setHeader("Set-Cookie", buildClearCookie());
  }
}

function extractIdToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

export default async function handler(req, res) {
  if (!req.method || req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ linked: false, error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const idToken = extractIdToken(req);
  const firebaseUser = await verifyFirebaseIdToken(idToken);
  if (!firebaseUser?.uid) {
    clearSessionCookieIfPresent(req, res);
    return res.status(401).json({ linked: false, error: "Authentication required" });
  }

  try {
    const link = await getEpicLink(firebaseUser.uid, idToken);
    clearSessionCookieIfPresent(req, res);

    if (!link || !link.linked) {
      return res.status(200).json({ linked: false });
    }

    return res.status(200).json({
      linked: true,
      provider: link.provider || "epic",
      accountId: link.accountId || link.epicAccountId || null,
      epicAccountId: link.epicAccountId || null,
      displayName: link.displayName || null,
      linkedAt: link.linkedAt || null,
      lastValidatedAt: link.lastValidatedAt || null,
      revokedAt: link.revokedAt || null,
      scopes: link.scopes || [],
    });
  } catch (e) {
    return res.status(500).json({ linked: false, error: "Failed to fetch Epic status" });
  }
}
