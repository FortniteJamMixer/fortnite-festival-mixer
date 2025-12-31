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

function clearCookie(req, res) {
  const secureFlag = (req.headers["x-forwarded-proto"] || "").includes("https")
    ? " Secure;"
    : "";
  res.setHeader(
    "Set-Cookie",
    `epic_oauth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;${secureFlag}`
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  const { code, state, redirect_uri: redirectParam } = req.query || {};
  if (!code || !state) {
    res.status(400).json({ ok: false, error: "Missing code or state" });
    return;
  }

  const clientId = process.env.EPIC_CLIENT_ID;
  const clientSecret = process.env.EPIC_CLIENT_SECRET;
  if (!clientId) {
    res.status(500).json({ ok: false, error: "Missing EPIC_CLIENT_ID env" });
    return;
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const oauthCookie = cookies["epic_oauth"] ? decodeURIComponent(cookies["epic_oauth"]) : null;
  if (!oauthCookie) {
    res.status(400).json({ ok: false, error: "Missing OAuth session" });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(oauthCookie);
  } catch (e) {
    res.status(400).json({ ok: false, error: "Invalid OAuth session" });
    return;
  }

  if (!parsed.state || parsed.state !== state) {
    clearCookie(req, res);
    res.status(400).json({ ok: false, error: "State mismatch" });
    return;
  }

  const redirectUri = buildRedirectUri(req, redirectParam || parsed.redirectUri);

  if (!clientSecret) {
    res.status(500).json({ ok: false, error: "Missing EPIC_CLIENT_SECRET env" });
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
      clearCookie(req, res);
      res.status(resp.status).json({ ok: false, error: data.error_description || data.error || "Token exchange failed" });
      return;
    }

    const epicAccountId = data.account_id || data.sub || null;
    const displayName = data.display_name || data.displayName || null;

    clearCookie(req, res);
    res.status(200).json({ ok: true, linked: true, epicAccountId, displayName });
  } catch (e) {
    clearCookie(req, res);
    res.status(500).json({ ok: false, error: "OAuth callback failed" });
  }
}
