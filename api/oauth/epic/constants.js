export const COOKIE_NAME = "epic_oauth";
export const COOKIE_MAX_AGE = 600; // seconds

export function buildClearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function buildSessionCookie(payload) {
  return `${COOKIE_NAME}=${payload}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}
