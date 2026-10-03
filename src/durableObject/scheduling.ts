import { deliverMessage } from "../delivery";
import { sendWebPush } from "../push-crypto";
import { earliest, htmlToText, parseEmailList } from "../scheduling";
import type { Env } from "../types";

const STALE_SENDING_MS = 10 * 60_000;

function bytesToBase64(bytes: Uint8Array): string {
	let bin = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(bin);
}

export class SchedulingHandler {
	#sql: SqlStorage;
	#storage: DurableObjectStorage;
	#env: Env;
	#isAuthDO: boolean;
	#waitUntil: (promise: Promise<any>) => void;

	constructor(
		sql: SqlStorage,
		storage: DurableObjectStorage,
		env: Env,
		isAuthDO: boolean,
		waitUntil: (promise: Promise<any>) => void,
	) {
		this.#sql = sql;
		this.#storage = storage;
		this.#env = env;
		this.#isAuthDO = isAuthDO;
		this.#waitUntil = waitUntil;
	}

	async snoozeEmail(id: string, untilIso: string | null, mailboxId: string): Promise<boolean> {
		if (this.#isAuthDO) throw new Error("Not a mailbox DO");
		const sql = this.#sql;
		const row = sql.exec("SELECT folder_id, snoozed_until FROM emails WHERE id = ?", id).toArray()[0] as any;
		if (!row) return false;
		if (untilIso === null) {
			sql.exec("UPDATE emails SET snoozed_until = NULL WHERE id = ?", id);
		} else {
			if (row.folder_id !== "inbox") return false;
			sql.exec("UPDATE emails SET snoozed_until = ? WHERE id = ?", untilIso, id);
		}
		await this.#storage.put("mailbox_id", mailboxId);
		await this.rescheduleAlarm();
		return true;
	}

	async scheduleDraft(id: string, sendAtIso: string | null, mailboxId: string): Promise<boolean> {
		if (this.#isAuthDO) throw new Error("Not a mailbox DO");
		const sql = this.#sql;
		const row = sql.exec("SELECT folder_id, delivery_status FROM emails WHERE id = ?", id).toArray()[0] as any;
		if (!row || row.folder_id !== "drafts") return false;
		if (sendAtIso === null) {
			if (row.delivery_status === "sending") return false;
			sql.exec(
				"UPDATE emails SET scheduled_at = NULL, send_error = NULL, delivery_status = 'draft' WHERE id = ?",
				id,
			);
		} else {
			if (row.delivery_status === "sending") return false;
			sql.exec(
				"UPDATE emails SET scheduled_at = ?, send_error = NULL, delivery_status = 'scheduled' WHERE id = ?",
				sendAtIso,
				id,
			);
		}
		await this.#storage.put("mailbox_id", mailboxId);
		await this.rescheduleAlarm();
		return true;
	}

	async getQueueSummary(): Promise<{ snoozed: number; scheduled: number; next_wake: string | null }> {
		if (this.#isAuthDO) throw new Error("Not a mailbox DO");
		const sql = this.#sql;
		const snoozed = sql
			.exec("SELECT COUNT(*) AS n, MIN(snoozed_until) AS next FROM emails WHERE snoozed_until IS NOT NULL AND folder_id = 'inbox'")
			.toArray()[0] as any;
		const scheduled = sql
			.exec("SELECT COUNT(*) AS n FROM emails WHERE scheduled_at IS NOT NULL AND folder_id = 'drafts'")
			.toArray()[0] as any;
		return {
			snoozed: Number(snoozed?.n || 0),
			scheduled: Number(scheduled?.n || 0),
			next_wake: snoozed?.next ? String(snoozed.next) : null,
		};
	}

	async sendScheduledNow(id: string, mailboxId: string): Promise<{ ok: boolean; error?: string }> {
		if (this.#isAuthDO) throw new Error("Not a mailbox DO");
		const sql = this.#sql;
		const row = sql.exec("SELECT folder_id, delivery_status FROM emails WHERE id = ?", id).toArray()[0] as any;
		if (!row || row.folder_id !== "drafts") return { ok: false, error: "Not found" };
		if (row.delivery_status === "sending") return { ok: false, error: "Already sending" };
		await this.#storage.put("mailbox_id", mailboxId);
		return this.sendScheduled(id, mailboxId);
	}

	async alarm(): Promise<void> {
		try {
			await this.runDue();
		} catch (err) {
			console.error("Mailbox alarm failed:", err);
			try {
				await this.rescheduleAlarm();
			} catch {
				// nothing more to do
			}
		}
	}

	async runDue(): Promise<{ woke: number; sent: number; failed: number }> {
		if (this.#isAuthDO) throw new Error("Not a mailbox DO");
		const sql = this.#sql;
		const now = Date.now();
		const nowIso = new Date(now).toISOString();
		const mailboxId = ((await this.#storage.get("mailbox_id")) as string | undefined) || "";

		// 1. Snoozed messages returning to inbox
		const woken = sql
			.exec(
				"SELECT id, subject, sender FROM emails WHERE snoozed_until IS NOT NULL AND snoozed_until <= ? ORDER BY snoozed_until ASC LIMIT 200",
				nowIso,
			)
			.toArray() as any[];
		if (woken.length > 0) {
			sql.exec("UPDATE emails SET snoozed_until = NULL, read = 0 WHERE snoozed_until IS NOT NULL AND snoozed_until <= ?", nowIso);
			if (mailboxId) {
				const first = woken[0];
				this.#waitUntil(
					this.#notifyMembers(mailboxId, {
						title: woken.length === 1 ? "Snoozed message is back" : `${woken.length} snoozed messages are back`,
						body: woken.length === 1 ? `${first.subject || "(No Subject)"} from ${first.sender}` : `${first.subject || "(No Subject)"} and ${woken.length - 1} more`,
						tag: `snooze-${mailboxId}`,
						url: `/mailbox/${encodeURIComponent(mailboxId)}/emails/inbox`,
					}),
				);
			}
		}

		// 2. Interrupted "sending" messages recover to Drafts
		const staleBefore = new Date(now - STALE_SENDING_MS).toISOString();
		sql.exec(
			`UPDATE emails SET delivery_status = 'draft', scheduled_at = NULL,
			   send_error = 'Sending was interrupted. Check Sent before sending again.'
			 WHERE delivery_status = 'sending' AND folder_id = 'drafts' AND scheduled_at <= ?`,
			staleBefore,
		);

		// 3. Due scheduled drafts
		const due = sql
			.exec(
				"SELECT id FROM emails WHERE scheduled_at IS NOT NULL AND scheduled_at <= ? AND folder_id = 'drafts' AND delivery_status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 20",
				nowIso,
			)
			.toArray() as any[];
		let sent = 0;
		let failed = 0;
		for (const d of due) {
			const result = await this.sendScheduled(String(d.id), mailboxId);
			if (result.ok) sent++;
			else failed++;
		}

		await this.rescheduleAlarm();
		return { woke: woken.length, sent, failed };
	}

	async sendScheduled(id: string, mailboxIdHint: string): Promise<{ ok: boolean; error?: string }> {
		const sql = this.#sql;
		const row = sql.exec("SELECT * FROM emails WHERE id = ?", id).toArray()[0] as any;
		if (!row || row.folder_id !== "drafts" || (row.delivery_status !== "scheduled" && row.delivery_status !== "draft")) {
			return { ok: false, error: "Not available to send" };
		}
		sql.exec(
			"UPDATE emails SET delivery_status = 'sending', scheduled_at = ?, send_error = NULL WHERE id = ?",
			new Date().toISOString(),
			id,
		);
		const mailboxId = mailboxIdHint || String(row.sender || "");

		const fail = async (message: string) => {
			sql.exec(
				"UPDATE emails SET delivery_status = 'draft', scheduled_at = NULL, send_error = ? WHERE id = ?",
				message,
				id,
			);
			if (mailboxId) {
				this.#waitUntil(
					this.#notifyMembers(mailboxId, {
						title: "Scheduled email was not sent",
						body: `${row.subject || "(No Subject)"}: ${message}`,
						tag: `scheduled-failed-${id}`,
						url: `/mailbox/${encodeURIComponent(mailboxId)}/emails/drafts`,
					}),
				);
			}
			return { ok: false, error: message };
		};

		try {
			const to = parseEmailList(row.recipient);
			if (to.length === 0 && parseEmailList(row.cc).length === 0 && parseEmailList(row.bcc).length === 0) {
				return await fail("This draft has no recipients.");
			}
			const atts = sql.exec("SELECT * FROM attachments WHERE email_id = ?", id).toArray() as any[];
			const attachments = [];
			for (const a of atts) {
				const obj = await this.#env.BUCKET.get(`attachments/${id}/${a.id}/${a.filename}`);
				if (!obj) return await fail(`Attachment "${a.filename}" is missing.`);
				attachments.push({
					filename: String(a.filename),
					content: bytesToBase64(new Uint8Array(await obj.arrayBuffer())),
					type: String(a.mimetype),
					disposition: (a.disposition === "inline" ? "inline" : "attachment") as "inline" | "attachment",
					contentId: a.content_id ? String(a.content_id) : undefined,
				});
			}
			const body = String(row.body || "");
			const looksLikeHtml = /<[a-z][\s\S]*>/i.test(body);
			let references: string[] | undefined;
			try {
				const parsed = row.email_references ? JSON.parse(row.email_references) : null;
				if (Array.isArray(parsed)) references = parsed.map(String);
			} catch {
				references = undefined;
			}
			await deliverMessage(this.#env, {
				mailboxId,
				messageId: id,
				from: String(row.sender),
				to,
				cc: parseEmailList(row.cc),
				bcc: parseEmailList(row.bcc),
				subject: String(row.subject || "(No Subject)"),
				html: looksLikeHtml ? body : undefined,
				text: looksLikeHtml ? htmlToText(body) : body,
				attachments,
				inReplyTo: row.in_reply_to ? String(row.in_reply_to) : undefined,
				references,
			});
		} catch (err) {
			return await fail(err instanceof Error ? err.message : "Sending failed");
		}

		sql.exec(
			"UPDATE emails SET folder_id = 'sent', date = ?, delivery_status = 'inbox', scheduled_at = NULL, send_error = NULL WHERE id = ?",
			new Date().toISOString(),
			id,
		);
		return { ok: true };
	}

	async rescheduleAlarm(): Promise<void> {
		const sql = this.#sql;
		const snooze = sql
			.exec("SELECT MIN(snoozed_until) AS t FROM emails WHERE snoozed_until IS NOT NULL")
			.toArray()[0] as any;
		const scheduled = sql
			.exec("SELECT MIN(scheduled_at) AS t FROM emails WHERE scheduled_at IS NOT NULL AND delivery_status = 'scheduled' AND folder_id = 'drafts'")
			.toArray()[0] as any;
		const stuck = sql
			.exec("SELECT COUNT(*) AS n FROM emails WHERE delivery_status = 'sending' AND folder_id = 'drafts'")
			.toArray()[0] as any;
		const staleCheck = Number(stuck?.n || 0) > 0 ? new Date(Date.now() + STALE_SENDING_MS).toISOString() : null;
		const next = earliest(snooze?.t ? String(snooze.t) : null, scheduled?.t ? String(scheduled.t) : null, staleCheck);
		if (!next) {
			await this.#storage.deleteAlarm();
			return;
		}
		await this.#storage.setAlarm(Math.max(Date.parse(next), Date.now() + 1000));
	}

	async #notifyMembers(
		mailboxId: string,
		n: { title: string; body: string; tag: string; url: string },
	): Promise<void> {
		try {
			const authDO = this.#env.MAILBOX.get(this.#env.MAILBOX.idFromName("AUTH"));
			const targets = await authDO.getPushTargetsForMailbox(mailboxId);
			if (targets.length === 0) return;
			const vapidKeys = await authDO.getVapidKeys();
			const subjectContact = this.#env.VAPID_SUBJECT || "support@reflect.cloud";
			const payload = {
				title: n.title,
				body: n.body,
				icon: "/icons/icon-192.png",
				badge: "/icons/badge-72.png",
				tag: n.tag,
				data: { mailboxId, url: n.url },
				actions: [{ action: "open", title: "Open" }],
			};
			await Promise.allSettled(
				targets.map(async (sub) => {
					const result = await sendWebPush(
						{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
						payload,
						vapidKeys,
						subjectContact,
					);
					if (!result.success && (result.statusCode === 404 || result.statusCode === 410)) {
						await authDO.purgePushEndpoint(sub.endpoint).catch(() => {});
					}
				}),
			);
		} catch (err) {
			console.error("Notification failed:", err);
		}
	}
}
