// Pure helpers for snooze and scheduled send. No Worker or Durable Object APIs here, so they can
// be unit tested directly.

import { normalizeEmail } from "./suppression.ts";

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

export interface Recipients {
	/** Normalised addresses, in the order written. These are what is checked and what is delivered to. */
	valid: string[];
	/** Entries that are not a usable address, as written. */
	invalid: string[];
}

/**
 * Reads "Name <a@b>, c@d" style input (a string, or an array with one entry per item). Every send
 * path refuses a message with an `invalid` entry: such an entry ("a@b.co>", "Name <a@b.co") used to
 * be handed to the mail binding as written, where it no longer matched its do-not-contact entry.
 */
export function parseRecipients(input?: string | string[] | null): Recipients {
	const valid: string[] = [];
	const invalid: string[] = [];
	if (!input) return { valid, invalid };
	const isList = Array.isArray(input);
	// Pieces with no "@" seen since the last address. Splitting a string cuts a display name that
	// has a comma in it ("Doe, Jane <jane@x.io>" becomes "Doe" and "Jane <jane@x.io>"), so such
	// pieces are part of the name when a "Name <address>" piece follows them, and invalid otherwise.
	let nameParts: string[] = [];
	for (const item of isList ? input : input.split(/[,;\n]+/)) {
		const entry = String(item).trim();
		if (!entry) continue;
		if (!entry.includes("@")) {
			nameParts.push(entry);
			continue;
		}
		if (isList || !entry.includes("<")) invalid.push(...nameParts);
		nameParts = [];
		const email = normalizeEmail(entry);
		if (email) valid.push(email);
		else invalid.push(entry);
	}
	invalid.push(...nameParts);
	return { valid, invalid };
}

/**
 * One plain sentence naming the recipient entries that are not valid addresses. It is the API error
 * and, for a scheduled message, the draft's send error, so it says what to do about it.
 */
export function describeInvalidRecipients(entries: string[]): string {
	const shown = entries.slice(0, 5).map((e) => `"${e.length > 80 ? `${e.slice(0, 80)}...` : e}"`);
	const more = entries.length - shown.length;
	const names = more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
	return entries.length === 1
		? `${names} is not a valid email address. Correct it to send the message.`
		: `${names} are not valid email addresses. Correct them to send the message.`;
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
