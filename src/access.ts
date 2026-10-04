// The gate's decisions that need no storage: what a mailbox role may do, when a request that was
// authenticated by the session cookie is refused, and what the login rate limit is keyed by.
// Its one import is equally free of dependencies, so the unit tests can load this straight from node.
import { networkOf } from "./login-backoff.ts";

export type MailboxRole = "owner" | "admin" | "write" | "read";

// Weakest first: the position is the rank.
const ROLES: MailboxRole[] = ["read", "write", "admin", "owner"];

/** A stored role as one of the four roles. Anything else is treated as the weakest, read. */
export function normalizeRole(role: unknown): MailboxRole {
	return ROLES.find((r) => r === role) ?? "read";
}

/**
 * The user's role on a mailbox, or null when no grant names it.
 *
 * Letter case is ignored: mailbox ids are lower-case, but a grant made before grants were
 * normalised is stored as the admin typed it ("Support@Reflect.cloud"). If several spellings of
 * one mailbox are granted with different roles the weakest applies, so that lowering someone's
 * role cannot be undone by a leftover row.
 */
export function roleForMailbox(
	grants: Array<{ mailboxId: string; role: string }>,
	mailboxId: string,
): MailboxRole | null {
	const wanted = String(mailboxId).toLowerCase();
	let weakest: MailboxRole | null = null;
	for (const grant of grants) {
		if (String(grant.mailboxId).toLowerCase() !== wanted) continue;
		const role = normalizeRole(grant.role);
		if (weakest === null || ROLES.indexOf(role) < ROLES.indexOf(weakest)) weakest = role;
	}
	return weakest;
}

export type MailboxAccessDecision = "allowed" | "view_only" | "mailbox_admin_required";

/** The sentence sent with each refusal; the decision itself is sent as `code`. */
export const MAILBOX_REFUSALS: Record<Exclude<MailboxAccessDecision, "allowed">, string> = {
	view_only: "Your access to this mailbox is view-only.",
	mailbox_admin_required: "Only a mailbox admin can change mailbox settings.",
};

const MAILBOX_PREFIX = "/api/v1/mailboxes/";

// What the write role may change, named by the path segment after the mailbox id. Everything else
// needs a mailbox admin: the mailbox itself (its settings), and any route added later until it is
// listed here on purpose.
const WRITE_SECTIONS = new Set(["emails", "folders", "contacts", "queue"]);

/**
 * Whether a role may make this request to /api/v1/mailboxes/:mailboxId or anything under it.
 * `path` is the request path as the router sees it. Global admins never get here.
 */
export function decideMailboxAccess(role: string, method: string, path: string): MailboxAccessDecision {
	const verb = method.toUpperCase();
	if (verb === "GET" || verb === "HEAD") return "allowed";

	const rank = ROLES.indexOf(normalizeRole(role));
	if (rank < ROLES.indexOf("write")) return "view_only";
	if (rank >= ROLES.indexOf("admin")) return "allowed";

	const section = path.startsWith(MAILBOX_PREFIX)
		? path.slice(MAILBOX_PREFIX.length).split("/")[1]
		: undefined;
	return WRITE_SECTIONS.has(section) ? "allowed" : "mailbox_admin_required";
}

export interface RequestRefusal {
	status: number;
	error: string;
}

type HeaderReader = { get(name: string): string | null };

const CROSS_SITE: RequestRefusal = { status: 403, error: "Cross-site request refused" };

function sameHost(origin: string, requestUrl: string): boolean {
	try {
		return new URL(origin).host === new URL(requestUrl).host;
	} catch {
		// "null" (an origin the browser will not name) or anything else that is not a URL.
		return false;
	}
}

// Told from the headers, not from `request.body`: a browser sends "Content-Length: 0" with an empty
// POST, and the runtime then still hands the Worker a (zero-length) body stream.
function carriesBody(headers: HeaderReader): boolean {
	const length = headers.get("Content-Length");
	if (length != null) return Number(length) > 0;
	return headers.get("Transfer-Encoding") != null;
}

function isJson(contentType: string | null): boolean {
	return (contentType || "").split(";")[0].trim().toLowerCase() === "application/json";
}

/**
 * The refusal for a request whose body is not declared as JSON, or null to let it through.
 *
 * A form on another site can only post the three form types, and the routes would otherwise parse
 * any of them as JSON. A script on another origin that declares JSON has to ask first (a CORS
 * preflight), and nothing here answers that.
 */
export function checkJsonBody(headers: HeaderReader): RequestRefusal | null {
	if (carriesBody(headers) && !isJson(headers.get("Content-Type"))) {
		return { status: 415, error: "Content-Type must be application/json" };
	}
	return null;
}

/**
 * The refusal for a request that was authenticated by the session cookie, or null to let it through.
 *
 * The browser attaches that cookie by itself, so another site could otherwise act as the signed-in
 * user. SameSite=Strict already keeps the cookie away from other sites, but not from our own
 * sibling subdomains (blog., agency.), which count as the same site. So a request that changes
 * something must be one the browser says came from this origin: Sec-Fetch-Site where the browser
 * sends it, else Origin. A request with neither header does not come from a browser page.
 *
 * A body must also be declared as JSON (see checkJsonBody).
 *
 * Never call this for a request authenticated by a Bearer token: a page has to add that header
 * itself, and another origin cannot.
 */
export function checkCookieRequest(
	method: string,
	requestUrl: string,
	headers: HeaderReader,
): RequestRefusal | null {
	const verb = method.toUpperCase();
	if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return null;

	const site = headers.get("Sec-Fetch-Site");
	if (site != null) {
		const value = site.trim().toLowerCase();
		// "none" is a request the user made directly (address bar, bookmark), not one a page made.
		if (value !== "same-origin" && value !== "none") return CROSS_SITE;
	} else {
		const origin = headers.get("Origin");
		if (origin != null && !sameHost(origin, requestUrl)) return CROSS_SITE;
	}

	return checkJsonBody(headers);
}

/** The endpoints that take a password or start a reset. Each is a POST, limited per client IP. */
export const CREDENTIAL_PATHS = [
	"/api/v1/auth/login",
	"/api/v1/auth/register",
	"/api/v1/auth/forgot-password",
	"/api/v1/auth/reset-password",
	"/api/v1/auth/change-password",
];

/**
 * What the per-IP rate limit counts by. Cloudflare sets this header itself; a client cannot forge
 * it. An IPv6 client is counted by its /64 (see networkOf).
 */
export function clientIpKey(headers: HeaderReader): string {
	const ip = (headers.get("CF-Connecting-IP") || "").trim();
	return ip ? networkOf(ip) : "unknown";
}
