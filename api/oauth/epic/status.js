import { buildClearCookie, COOKIE_NAME } from "./constants";
import { verifyFirebaseIdToken } from "./firebase-auth";
import { clearEpicLink, getEpicLink } from "./link-store";

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
  if (req.method === "POST" || req.method === "DELETE") {
    return req.body?.idToken || null;
  }
  return req.query?.idToken || null;
}

export default async function handler(req, res) {
  if (!req.method || !["GET", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ linked: false, error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const idToken = extractIdToken(req);
  const firebaseUser = await verifyFirebaseIdToken(idToken);
  if (!firebaseUser?.uid) {
    clearSessionCookieIfPresent(req, res);
    return res.status(401).json({ linked: false, error: "Authentication required" });
  }

  if (req.method === "DELETE") {
    clearEpicLink(firebaseUser.uid);
    clearSessionCookieIfPresent(req, res);
    return res.status(200).json({ linked: false });
  }

  const link = getEpicLink(firebaseUser.uid);
  if (!link) {
    clearSessionCookieIfPresent(req, res);
    return res.status(200).json({ linked: false });
  }

  clearSessionCookieIfPresent(req, res);
  return res.status(200).json({
    linked: true,
    epicAccountId: link.epicAccountId || null,
    displayName: link.displayName || null,
    linkedAt: link.linkedAt || null,
    lastValidatedAt: link.lastValidatedAt || null,
  });
}
