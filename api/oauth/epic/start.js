import crypto from "crypto";

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function isSecure(req) {
  const protoHeader = (req.headers["x-forwarded-proto"] || "").split(",")[0];
  if (protoHeader) return protoHeader === "https";
  return !!req.connection?.encrypted;
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
  const redirectParam = req.query.redirect_uri;
  const redirectUri = redirectParam
    ? decodeURIComponent(redirectParam)
    : `${origin}/oauth-callback.html?oauth=epic`;

  const codeVerifier = base64UrlEncode(crypto.randomBytes(64));
  const codeChallenge = base64UrlEncode(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );
  const state = base64UrlEncode(crypto.randomBytes(24));

  const cookiePayload = encodeURIComponent(
    JSON.stringify({ state, codeVerifier, redirectUri })
  );
  const secureFlag = isSecure(req) ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `epic_oauth=${cookiePayload}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600;${secureFlag}`
  );
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
