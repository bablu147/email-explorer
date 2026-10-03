// Suppression list helpers: signed unsubscribe tokens, bounce (DSN) parsing, the outreach footer
// and the public unsubscribe page. Deliberately free of relative imports and Worker-only APIs so
// the unit tests can import it straight from node.

export type SuppressionReason = "bounce" | "unsubscribe" | "manual";

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

export function normalizeEmail(input: string): string | null {
	const m = String(input || "").match(/<([^>]+)>/);
	const email = (m ? m[1] : String(input || "")).trim().toLowerCase();
	return EMAIL_RE.test(email) ? email : null;
}

// ---------------------------------------------------------------------------------------------
// Unsubscribe tokens: base64url(email|mailboxId).signature  (HMAC-SHA256, no expiry)
// ---------------------------------------------------------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
	const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
	const bin = atob(padded);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function hmac(secret: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
	return toBase64Url(new Uint8Array(sig));
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export async function signUnsubscribeToken(
	secret: string,
	email: string,
	mailboxId: string,
): Promise<string> {
	const payload = toBase64Url(new TextEncoder().encode(`${email.toLowerCase()}|${mailboxId}`));
	return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyUnsubscribeToken(
	secret: string,
	token: string,
): Promise<{ email: string; mailboxId: string } | null> {
	try {
		const [payload, sig] = String(token || "").split(".");
		if (!payload || !sig) return null;
		if (!constantTimeEqual(await hmac(secret, payload), sig)) return null;
		const decoded = new TextDecoder().decode(fromBase64Url(payload));
		const idx = decoded.indexOf("|");
		if (idx < 1) return null;
		const email = normalizeEmail(decoded.slice(0, idx));
		if (!email) return null;
		return { email, mailboxId: decoded.slice(idx + 1) };
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------------------------
// Click-tracking link signatures. Without a signature the redirect endpoint would send visitors
// to any URL an attacker puts in the link (open redirect), so every tracked link is signed.
// ---------------------------------------------------------------------------------------------

export function isHttpUrl(url: string | undefined | null): url is string {
	if (!url) return false;
	try {
		const u = new URL(url);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

export async function signClickLink(
	secret: string,
	mailboxId: string,
	emailId: string,
	url: string,
): Promise<string> {
	return hmac(secret, `click|${mailboxId}|${emailId}|${url}`);
}

export async function verifyClickLink(
	secret: string,
	mailboxId: string,
	emailId: string,
	url: string,
	sig: string,
): Promise<boolean> {
	if (!sig) return false;
	return constantTimeEqual(await signClickLink(secret, mailboxId, emailId, url), sig);
}

// Shown for links sent before signing existed: they cannot be verified, so the visitor sees
// the destination and chooses whether to continue instead of being redirected silently.
export function renderLeavingPage(url: string): string {
	const safe = escapeHtml(url);
	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>Leaving Reflect</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;font:16px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827}
main{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;max-width:480px;margin:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 12px}p{margin:0 0 20px;color:#4b5563;word-break:break-all}
a.b{display:inline-block;background:#4f46e5;color:#fff;border-radius:8px;padding:10px 18px;font-size:15px;font-weight:600;text-decoration:none}
@media(prefers-color-scheme:dark){body{background:#0b0f19;color:#f3f4f6}main{background:#111827;border-color:#1f2937}p{color:#9ca3af}}
</style></head><body><main><h1>You are leaving this site</h1><p>${safe}</p><a class="b" href="${safe}" rel="noopener noreferrer nofollow">Continue</a></main></body></html>`;
}

// ---------------------------------------------------------------------------------------------
// Bounce (delivery status notification) parsing
// ---------------------------------------------------------------------------------------------

export interface BounceInput {
	fromAddress: string;
	subject?: string;
	/** Lower-cased header name -> value. */
	headers: Record<string, string>;
	/** Plain-text body plus the text of any message/delivery-status part. */
	bodyText: string;
}

const HARD_TEXT_RE =
	/\b5\.\d\.\d\b|\b55\d\b|user unknown|no such user|does not exist|mailbox unavailable|address (?:rejected|not found)|couldn'?t be found|invalid recipient|unknown (?:user|recipient)|recipient (?:address )?rejected/i;

export function isBounceSender(fromAddress: string): boolean {
	const local = String(fromAddress || "").toLowerCase().split("@")[0];
	return local === "mailer-daemon" || local === "postmaster";
}

/**
 * Returns the recipients that permanently failed (hard bounce), or null if the message is not a
 * bounce. Temporary failures (4.x.x, "delayed") are ignored on purpose: they usually resolve.
 */
export function parseBounce(input: BounceInput): { recipients: string[] } | null {
	const contentType = (input.headers["content-type"] || "").toLowerCase();
	const isReport = contentType.includes("multipart/report") || contentType.includes("delivery-status");
	if (!isBounceSender(input.fromAddress) && !isReport) return null;

	const found = new Set<string>();
	const body = input.bodyText || "";

	// Structured DSN: blocks separated by blank lines, each with Final-Recipient / Action / Status.
	let structured = false;
	for (const block of body.split(/\r?\n\s*\r?\n/)) {
		const rcpt = block.match(/^\s*(?:Final|Original)-Recipient:\s*rfc822;\s*(\S+)/im);
		if (!rcpt) continue;
		structured = true;
		const action = (block.match(/^\s*Action:\s*(\w+)/im)?.[1] || "").toLowerCase();
		const status = block.match(/^\s*Status:\s*(\d)\.\d+\.\d+/im)?.[1];
		const failed = action === "failed" || status === "5";
		if (failed && status !== "4") {
			const email = normalizeEmail(rcpt[1]);
			if (email) found.add(email);
		}
	}

	if (!structured) {
		const text = `${input.subject || ""}\n${body}`;
		if (!HARD_TEXT_RE.test(text)) return found.size ? { recipients: [...found] } : null;
		for (const addr of (input.headers["x-failed-recipients"] || "").split(/[,;\s]+/)) {
			const email = normalizeEmail(addr);
			if (email) found.add(email);
		}
		if (found.size === 0) {
			const m = body.match(/delivered to\s+<?([^\s<>]+@[^\s<>]+?)>?[\s.:]/i);
			const email = m ? normalizeEmail(m[1]) : null;
			if (email) found.add(email);
		}
	}

	return found.size ? { recipients: [...found] } : null;
}

// ---------------------------------------------------------------------------------------------
// Outreach footer + public page
// ---------------------------------------------------------------------------------------------

export function escapeHtml(s: string): string {
	return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function appendUnsubscribeFooter(
	html: string | undefined,
	text: string | undefined,
	url: string,
): { html: string | undefined; text: string | undefined } {
	const footerHtml = `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font:12px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#6b7280;">If you'd rather not hear from us, <a href="${escapeHtml(url)}" style="color:#6b7280;text-decoration:underline;">unsubscribe</a>.</div>`;
	const footerText = `\n\n--\nIf you'd rather not hear from us, unsubscribe: ${url}`;
	let outHtml = html;
	if (html) {
		outHtml = html.includes("</body>")
			? html.replace("</body>", `${footerHtml}</body>`)
			: `${html}${footerHtml}`;
	}
	return { html: outHtml, text: text ? `${text}${footerText}` : text };
}

export function renderUnsubscribePage(opts: {
	state: "confirm" | "done" | "invalid";
	email?: string;
}): string {
	const email = opts.email ? escapeHtml(opts.email) : "";
	let heading = "";
	let body = "";
	if (opts.state === "confirm") {
		heading = "Unsubscribe";
		body = `<p>Stop receiving outreach emails from Reflect at <strong>${email}</strong>?</p>
<form method="POST"><input type="hidden" name="List-Unsubscribe" value="One-Click" /><button type="submit">Confirm unsubscribe</button></form>`;
	} else if (opts.state === "done") {
		heading = "You're unsubscribed";
		body = `<p><strong>${email}</strong> will no longer receive outreach emails from us.</p>`;
	} else {
		heading = "Link not valid";
		body = "<p>This unsubscribe link is invalid or has been altered.</p>";
	}
	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${heading}</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;font:16px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827}
main{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;max-width:420px;margin:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 12px}p{margin:0 0 20px;color:#4b5563}
button{background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:15px;font-weight:600;cursor:pointer}
@media(prefers-color-scheme:dark){body{background:#0b0f19;color:#f3f4f6}main{background:#111827;border-color:#1f2937}p{color:#9ca3af}}
</style></head><body><main><h1>${heading}</h1>${body}</main></body></html>`;
}
