// Outreach chains: who we cold-emailed, whether they engaged, and who is due a follow-up.
// Pure (only imports the pure suppression helpers) so node tests can load it.

import { normalizeEmail } from "./suppression.ts";

export interface SentRow {
	id: string;
	recipient: string;
	subject: string | null;
	date: string;
	in_reply_to: string | null;
	opened_count: number | null;
	clicked_count: number | null;
	delivery_status: string | null;
	thread_id: string | null;
}

export interface InboundRow {
	sender: string;
	date: string;
}

export type Stage = "contacted" | "opened" | "clicked" | "replied" | "bounced";

export interface Chain {
	recipient: string;
	start_id: string;
	start_subject: string;
	start_date: string;
	thread_id: string | null;
	last_date: string;
	sent_count: number;
	opened: boolean;
	clicked: boolean;
	bounced: boolean;
	replied: boolean;
	replied_at: string | null;
	pending_draft_id: string | null;
	stage: Stage;
}

/** Free mailbox providers: a reply from the same domain only counts as the same org when it isn't one of these. */
const FREE_PROVIDERS = new Set([
	"gmail.com",
	"googlemail.com",
	"outlook.com",
	"hotmail.com",
	"live.com",
	"yahoo.com",
	"icloud.com",
	"me.com",
	"proton.me",
	"protonmail.com",
	"aol.com",
	"gmx.com",
	"qq.com",
	"163.com",
	"yandex.com",
	"mail.com",
]);

export function firstAddress(field: string | null | undefined): string | null {
	if (!field) return null;
	const parts = field.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
	if (parts.length !== 1) return null; // multi-recipient messages are not one-to-one outreach
	return normalizeEmail(parts[0]);
}

/** The key two addresses must share to count as the same person/company. */
export function orgKey(address: string): string {
	const domain = address.split("@")[1] || address;
	return FREE_PROVIDERS.has(domain) ? address : domain;
}

export function stageOf(c: Pick<Chain, "bounced" | "replied" | "clicked" | "opened">): Stage {
	if (c.bounced) return "bounced";
	if (c.replied) return "replied";
	if (c.clicked) return "clicked";
	if (c.opened) return "opened";
	return "contacted";
}

/**
 * Groups one-to-one new messages (no In-Reply-To) by recipient. A recipient we have also replied to
 * is a conversation, not outreach, and is left out.
 *
 * @param pendingDrafts recipient -> id of an unsent follow-up draft that is still in Drafts
 */
export function buildChains(
	sent: SentRow[],
	inbound: InboundRow[],
	pendingDrafts: Map<string, string> = new Map(),
): Chain[] {
	const ordered = [...sent].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
	const conversation = new Set<string>();
	const byRecipient = new Map<string, SentRow[]>();

	for (const row of ordered) {
		if (row.delivery_status === "draft") continue;
		const addr = firstAddress(row.recipient);
		if (!addr) continue;
		if (row.in_reply_to) {
			conversation.add(addr);
			continue;
		}
		const list = byRecipient.get(addr) || [];
		list.push(row);
		byRecipient.set(addr, list);
	}

	const inboundByOrg = new Map<string, number[]>();
	for (const msg of inbound) {
		const addr = normalizeEmail(msg.sender);
		const ts = Date.parse(msg.date);
		if (!addr || Number.isNaN(ts)) continue;
		const key = orgKey(addr);
		const arr = inboundByOrg.get(key) || [];
		arr.push(ts);
		inboundByOrg.set(key, arr);
	}

	const chains: Chain[] = [];
	for (const [recipient, rows] of byRecipient) {
		if (conversation.has(recipient)) continue;
		const start = rows[0];
		const last = rows[rows.length - 1];
		const startTs = Date.parse(start.date);
		const replies = (inboundByOrg.get(orgKey(recipient)) || []).filter((t) => t > startTs);
		const base = {
			recipient,
			start_id: start.id,
			start_subject: start.subject || "",
			start_date: start.date,
			thread_id: start.thread_id,
			last_date: last.date,
			sent_count: rows.length,
			opened: rows.some((r) => (r.opened_count || 0) > 0),
			clicked: rows.some((r) => (r.clicked_count || 0) > 0),
			bounced: rows.some((r) => r.delivery_status === "bounced"),
			replied: replies.length > 0,
			replied_at: replies.length ? new Date(Math.min(...replies)).toISOString() : null,
			pending_draft_id: pendingDrafts.get(recipient) || null,
		};
		chains.push({ ...base, stage: stageOf(base) });
	}
	return chains.sort((a, b) => Date.parse(b.last_date) - Date.parse(a.last_date));
}

export interface DueOptions {
	now: number;
	delayMs: number;
	maxFollowUps: number;
}

/** A chain is due when nobody has answered, nothing is waiting in Drafts, and enough time has passed. */
export function isDue(chain: Chain, opts: DueOptions): boolean {
	if (chain.replied || chain.bounced || chain.pending_draft_id) return false;
	if (chain.sent_count - 1 >= opts.maxFollowUps) return false;
	return opts.now - Date.parse(chain.last_date) >= opts.delayMs;
}
