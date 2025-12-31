const COOKIE_NAME = "epic_oauth";

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = rest.join("=");
    return acc;
  }, {});
}

function buildRedirectUri(req, provided) {
  if (provided) return decodeURIComponent(provided);
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers.host;
  const origin = process.env.APP_ORIGIN || `${proto}://${host}`;
  return `${origin.replace(/\/$/, "")}/oauth-callback.html?oauth=epic`;
}

function clearCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  );
}

function sendError(res, status, message) {
  clearCookie(res);
  res.status(status).json({ ok: false, error: message });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  const { code, state, redirect_uri: redirectParam } = req.query || {};
  if (!code || !state) {
    sendError(res, 400, "Missing code or state");
    return;
  }

  const clientId = process.env.EPIC_CLIENT_ID;
  const clientSecret = process.env.EPIC_CLIENT_SECRET;
  if (!clientId) {
    sendError(res, 500, "Missing EPIC_CLIENT_ID env");
    return;
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const oauthCookie = cookies[COOKIE_NAME] ? decodeURIComponent(cookies[COOKIE_NAME]) : null;
  if (!oauthCookie) {
    sendError(res, 400, "Missing OAuth session");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(oauthCookie);
  } catch (e) {
    sendError(res, 400, "Invalid OAuth session");
    return;
  }

  if (!parsed.state || parsed.state !== state) {
    sendError(res, 400, "State mismatch");
    return;
  }

  const redirectUri = buildRedirectUri(req, redirectParam || parsed.redirectUri);

  if (!clientSecret) {
    sendError(res, 500, "Missing EPIC_CLIENT_SECRET env");
    return;
  }

  const tokenEndpoint = "https://api.epicgames.dev/epic/oauth/v1/token";
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: parsed.codeVerifier,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const resp = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      sendError(res, resp.status, data.error_description || data.error || "Token exchange failed");
      return;
    }

    const epicAccountId = data.account_id || data.sub || null;
    const displayName = data.display_name || data.displayName || null;

    clearCookie(res);
    res.status(200).json({ ok: true, linked: true, epicAccountId, displayName });
  } catch (e) {
    sendError(res, 500, "OAuth callback failed");
  }
}
