import crypto from "crypto";

const COOKIE_NAME = "epic_oauth";
// Short-lived window (10m) keeps state + PKCE single-use and limits replay risk
const COOKIE_MAX_AGE = 600; // seconds

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getOrigin(req) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function buildSessionCookie(payload) {
  return `${COOKIE_NAME}=${payload}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId = process.env.EPIC_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: "Missing EPIC_CLIENT_ID env" });
    return;
  }

  const origin = getOrigin(req);
  const redirectParam = req.query.redirect_uri;
  let proposedRedirect;
  try {
    proposedRedirect = redirectParam
      ? decodeURIComponent(redirectParam)
      : `${origin}/oauth-callback.html?oauth=epic`;
  } catch (e) {
    res.status(400).json({ error: "Invalid redirect URI" });
    return;
  }
  const allowedOrigin = origin.replace(/\/$/, "");
  // Only allow redirecting back to the same origin so the auth code cannot be sent elsewhere.
  if (!proposedRedirect.startsWith(allowedOrigin)) {
    res
      .status(400)
      .json({ error: "Redirect URI must stay on the app origin" });
    return;
  }
  const redirectUri = proposedRedirect;

  const codeVerifier = base64UrlEncode(crypto.randomBytes(64));
  const codeChallenge = base64UrlEncode(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );
  const state = base64UrlEncode(crypto.randomBytes(24));

  // Persist PKCE verifier + CSRF state in an HttpOnly, Secure cookie so the browser
  // cannot leak them to client JS. Issued-at is stored to enforce a short TTL server-side.
  const cookiePayload = encodeURIComponent(
    JSON.stringify({ state, codeVerifier, redirectUri, issuedAt: Date.now() })
  );
  res.setHeader("Set-Cookie", buildSessionCookie(cookiePayload));
  res.setHeader("Cache-Control", "no-store");

  const authorizeUrl = new URL(
    "https://www.epicgames.com/id/api/epic/oauth/v1/authorize"
  );
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "basic_profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
}
