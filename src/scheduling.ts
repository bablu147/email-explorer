// Pure helpers for snooze and scheduled send. No Worker or Durable Object APIs here, so they can
// be unit tested directly.

const MINUTE_MS = 60_000;

/** A message can't be scheduled closer than this to now (it would just be a normal send). */
export const MIN_SEND_LEAD_MS = 30_000;
/** Farthest in the future a scheduled send or snooze may be set. */
export const MAX_LEAD_MS = 366 * 24 * 60 * MINUTE_MS;
/** Snoozing for less than this is pointless; the minimum keeps the wake-up after the request. */
export const MIN_SNOOZE_LEAD_MS = 10_000;

export interface TimeCheck {
	ok: boolean;
	/** Normalised ISO time, when `ok`. */
	iso?: string;
	error?: string;
}

function checkFuture(
	value: unknown,
	now: number,
	minLeadMs: number,
	label: string,
): TimeCheck {
	if (typeof value !== "string" || value.trim() === "") {
		return { ok: false, error: `${label} time is required` };
	}
	const ms = Date.parse(value);
	if (!Number.isFinite(ms)) return { ok: false, error: `${label} time is not a valid date` };
	if (ms < now + minLeadMs) return { ok: false, error: `${label} time must be in the future` };
	if (ms > now + MAX_LEAD_MS) return { ok: false, error: `${label} time is more than a year away` };
	return { ok: true, iso: new Date(ms).toISOString() };
}

export const checkSendAt = (value: unknown, now = Date.now()): TimeCheck =>
	checkFuture(value, now, MIN_SEND_LEAD_MS, "Send");

export const checkSnoozeUntil = (value: unknown, now = Date.now()): TimeCheck =>
	checkFuture(value, now, MIN_SNOOZE_LEAD_MS, "Snooze");

/** The earlier of two optional ISO times, or null. Used to pick the next Durable Object alarm. */
export function earliest(...times: Array<string | null | undefined>): string | null {
	let best: string | null = null;
	let bestMs = Number.POSITIVE_INFINITY;
	for (const t of times) {
		if (!t) continue;
		const ms = Date.parse(t);
		if (Number.isFinite(ms) && ms < bestMs) {
			bestMs = ms;
			best = t;
		}
	}
	return best;
}

/** Extract bare addresses from "Name <a@b>, c@d" style input (string or array). */
export function parseEmailList(input?: string | string[] | null): string[] {
	if (!input) return [];
	const rawList = Array.isArray(input) ? input : input.split(/[,;\n]+/);
	const results: string[] = [];
	for (const item of rawList) {
		const match = item.match(/<([^>]+)>/) || [null, item];
		const email = (match[1] || item).trim();
		if (email && email.includes("@")) results.push(email);
	}
	return results;
}

/** Plain-text alternative for an HTML body (used when a stored draft only kept the HTML). */
export function htmlToText(html: string): string {
	return html
		.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
		.replace(/<li[^>]*>/gi, "- ")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/gi, " ")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&amp;/gi, "&")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
