// Where a request carries its session token, and the cookie a session is kept in.
// No imports, so the unit tests can load this straight from node.

export interface PresentedToken {
	token: string;
	via: "bearer" | "cookie";
}

// The "__Host-" prefix makes the browser refuse the cookie unless it is Secure, has no Domain and
// has Path=/, so a sibling subdomain (blog., agency.) can neither read nor overwrite it. Browsers
// accept that prefix only over https, hence the plain name on a local development host.
const HOST_COOKIE = "__Host-session";
// The only name before this release. Still read everywhere, so sessions created then keep working.
const PLAIN_COOKIE = "session";

const ATTRIBUTES = "HttpOnly; Secure; SameSite=Strict; Path=/";

// Every presented token costs a storage lookup, so one request cannot ask for an unbounded number.
const MAX_TOKENS = 4;

// A string test, not `new URL`: this runs on the login path and must not be able to throw.
function isHttps(requestUrl: string): boolean {
	return /^https:/i.test(requestUrl);
}

/** Every value the Cookie header holds for exactly this name (a browser may send the name twice). */
function cookieValues(header: string | null, name: string): string[] {
	const values: string[] = [];
	for (const pair of (header || "").split(";")) {
		const eq = pair.indexOf("=");
		if (eq === -1) continue;
		if (pair.slice(0, eq).trim() !== name) continue;
		values.push(pair.slice(eq + 1).trim());
	}
	return values;
}

/** Every token the request presents, in the order to try them: Authorization: Bearer first, then the session cookie. */
export function readSessionTokens(request: Request): PresentedToken[] {
	const tokens: PresentedToken[] = [];
	const add = (token: string, via: PresentedToken["via"]) => {
		if (!token || tokens.length >= MAX_TOKENS) return;
		// The same token in the header and in the cookie counts once, as the header: it was sent on
		// purpose, not attached by the browser.
		if (tokens.some((t) => t.token === token)) return;
		tokens.push({ token, via });
	};

	const bearer = /^Bearer\s+(.+)$/i.exec((request.headers.get("Authorization") || "").trim());
	if (bearer) add(bearer[1].trim(), "bearer");

	const cookie = request.headers.get("Cookie");
	for (const value of cookieValues(cookie, HOST_COOKIE)) add(value, "cookie");
	for (const value of cookieValues(cookie, PLAIN_COOKIE)) add(value, "cookie");

	return tokens;
}

/**
 * The Set-Cookie value for a new session. The token is written as it is, so it must not contain
 * a space, comma, semicolon, double quote or backslash.
 */
export function buildSessionCookie(token: string, requestUrl: string, maxAgeSeconds: number): string {
	const name = isHttps(requestUrl) ? HOST_COOKIE : PLAIN_COOKIE;
	return `${name}=${token}; ${ATTRIBUTES}; Max-Age=${Math.floor(maxAgeSeconds)}`;
}

// Marks a browser that has signed in to an account before. It is not a credential: all it does is
// let that browser past the account-wide lock for that account (see AuthHandler.beginLogin), so
// that guesses from elsewhere cannot keep a real user out of their own account.
const HOST_DEVICE_COOKIE = "__Host-device";
const PLAIN_DEVICE_COOKIE = "device";
const DEVICE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** The device token the request presents, if any. */
export function readDeviceToken(request: Request): string | null {
	const name = isHttps(request.url) ? HOST_DEVICE_COOKIE : PLAIN_DEVICE_COOKIE;
	const value = cookieValues(request.headers.get("Cookie"), name)[0];
	return value && value.length <= 128 ? value : null;
}

/** The Set-Cookie value that marks this browser as known. Same character rules as the session token. */
export function buildDeviceCookie(token: string, requestUrl: string): string {
	const name = isHttps(requestUrl) ? HOST_DEVICE_COOKIE : PLAIN_DEVICE_COOKIE;
	return `${name}=${token}; ${ATTRIBUTES}; Max-Age=${DEVICE_MAX_AGE_SECONDS}`;
}

/**
 * Set-Cookie values that clear the session cookie under every name it can have. Each one has to go
 * out as its own Set-Cookie header.
 */
export function clearSessionCookies(requestUrl: string): string[] {
	const names = isHttps(requestUrl) ? [HOST_COOKIE, PLAIN_COOKIE] : [PLAIN_COOKIE];
	return names.map((name) => `${name}=; ${ATTRIBUTES}; Max-Age=0`);
}
