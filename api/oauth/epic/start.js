import crypto from "crypto";
import { buildSessionCookie } from "./constants";

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
  const configuredOrigin = process.env.APP_ORIGIN?.replace(/\/$/, "") || null;
  const requestOrigin = origin.replace(/\/$/, "");
  if (configuredOrigin && configuredOrigin !== requestOrigin) {
    if (process.env.ALLOW_PREVIEW_OAUTH !== "true") {
      res
        .status(400)
        .json({ error: "Preview OAuth is disabled; use the production origin redirect URI" });
      return;
    }
  }

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
  const allowedRedirect = `${allowedOrigin}/oauth-callback.html?oauth=epic`;
  // Only allow redirecting back to the same origin so the auth code cannot be sent elsewhere.
  if (proposedRedirect !== allowedRedirect) {
    res
      .status(400)
      .json({
        error:
          "Redirect URI must match the configured Epic callback exactly, including path and query string",
      });
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
