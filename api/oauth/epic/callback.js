import { COOKIE_MAX_AGE, COOKIE_NAME, buildClearCookie } from "./constants";
import { verifyFirebaseIdToken } from "./firebase-auth";
import { setEpicLink } from "./link-store";

const ERROR_CODES = {
  badRequest: "OAUTH_MISSING_PARAMS",
  noSession: "OAUTH_SESSION_MISSING",
  expired: "OAUTH_EXPIRED",
  stateMismatch: "OAUTH_STATE_MISMATCH",
  redirectMismatch: "OAUTH_REDIRECT_MISMATCH",
  incomplete: "OAUTH_SESSION_INCOMPLETE",
  unauthenticated: "OAUTH_AUTH_REQUIRED",
  exchangeFailed: "TOKEN_EXCHANGE_FAILED",
  generic: "OAUTH_CALLBACK_FAILED",
};

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
  res.setHeader("Set-Cookie", buildClearCookie());
}

function sendError(res, status, message, code = ERROR_CODES.generic, redirectUri) {
  clearCookie(res);
  const payload = { ok: false, error: message, errorCode: code };
  if (redirectUri) payload.redirect = redirectUri;
  res.status(status).json(payload);
}

function extractIdToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return null;
}

function extractRequestValues(req) {
  const method = req.method || "GET";
  if (method === "POST") {
    return req.body || {};
  }
  return req.query || {};
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    sendError(res, 405, "Method not allowed", ERROR_CODES.badRequest);
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  const values = extractRequestValues(req);
  const code = values.code;
  const state = values.state;
  const redirectParam = values.redirect_uri;
  if (!code || !state) {
    sendError(res, 400, "Missing code or state", ERROR_CODES.badRequest);
    return;
  }

  const clientId = process.env.EPIC_CLIENT_ID;
  if (!clientId) {
    sendError(res, 500, "Missing EPIC_CLIENT_ID env", ERROR_CODES.generic);
    return;
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const oauthCookie = cookies[COOKIE_NAME] ? decodeURIComponent(cookies[COOKIE_NAME]) : null;
  if (!oauthCookie) {
    sendError(res, 400, "Missing OAuth session", ERROR_CODES.noSession, buildRedirectUri(req, redirectParam));
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(oauthCookie);
  } catch (e) {
    sendError(res, 400, "Invalid OAuth session", ERROR_CODES.noSession, buildRedirectUri(req, redirectParam));
    return;
  }

  if (!parsed.issuedAt || Date.now() - parsed.issuedAt > COOKIE_MAX_AGE * 1000) {
    sendError(res, 400, "OAuth session expired", ERROR_CODES.expired, buildRedirectUri(req, redirectParam));
    return;
  }

  if (!parsed.state || parsed.state !== state) {
    sendError(res, 400, "State mismatch", ERROR_CODES.stateMismatch, buildRedirectUri(req, redirectParam));
    return;
  }

  const storedRedirectUri = parsed.redirectUri || buildRedirectUri(req, redirectParam);
  if (redirectParam) {
    const provided = decodeURIComponent(redirectParam);
    if (storedRedirectUri && provided !== storedRedirectUri) {
      sendError(res, 400, "Redirect mismatch", ERROR_CODES.redirectMismatch, storedRedirectUri);
      return;
    }
  }
  const redirectUri = storedRedirectUri;

  if (!redirectUri || !parsed.codeVerifier) {
    sendError(res, 400, "OAuth session incomplete", ERROR_CODES.incomplete, redirectUri);
    return;
  }

  const idToken = extractIdToken(req);
  const firebaseUser = await verifyFirebaseIdToken(idToken);
  if (!firebaseUser?.uid) {
    sendError(res, 401, "Authentication required", ERROR_CODES.unauthenticated, redirectUri);
    return;
  }

  const tokenEndpoint = "https://api.epicgames.dev/epic/oauth/v1/token";
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: parsed.codeVerifier,
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  const clientSecret = process.env.EPIC_CLIENT_SECRET;
  if (clientSecret) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basicAuth}`;
  } else {
    form.set("client_id", clientId);
  }

  try {
    const resp = await fetch(tokenEndpoint, {
      method: "POST",
      headers,
      body: form.toString(),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      sendError(
        res,
        resp.status,
        data.error_description || data.error || "Token exchange failed",
        ERROR_CODES.exchangeFailed,
        redirectUri
      );
      return;
    }

    const epicAccountId = data.account_id || data.sub || data.accountId || null;
    const displayName = data.display_name || data.displayName || null;
    const now = Date.now();

    if (!epicAccountId) {
      sendError(res, 400, "Epic account identifier missing", ERROR_CODES.exchangeFailed, redirectUri);
      return;
    }

    const linkPayload = {
      linked: true,
      epicAccountId,
      displayName,
      linkedAt: now,
      lastValidatedAt: now,
    };
    try {
      await setEpicLink(firebaseUser.uid, linkPayload, idToken);
    } catch (err) {
      sendError(res, 500, "Failed to store Epic link", ERROR_CODES.generic, redirectUri);
      return;
    }

    clearCookie(res);
    res
      .status(200)
      .json({ ok: true, linked: true, epicAccountId, displayName, linkedAt: now, lastValidatedAt: now });
  } catch (e) {
    sendError(res, 500, "OAuth callback failed", ERROR_CODES.generic, redirectUri);
  }
}
