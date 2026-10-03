import { buildChains, type Chain } from "../outreach";
import { sendWebPush } from "../push-crypto";
import {
	DEFAULT_FOLLOWUP_TEMPLATE,
	DEFAULT_TEMPLATES,
	PITCH_TEMPLATE_ID,
	TEMPLATE_LIMITS,
} from "../templates";
import type { EmailData, Env } from "../types";

export interface FollowUpConfig {
	enabled: boolean;
	delay_days: number;
	max_followups: number;
	template_id: string;
	enabled_at: string | null;
	last_run: { at: string; drafts: number } | null;
}

export const DEFAULT_FOLLOWUP_CONFIG: FollowUpConfig = {
	enabled: false,
	delay_days: 3,
	max_followups: 2,
	template_id: DEFAULT_FOLLOWUP_TEMPLATE.id,
	enabled_at: null,
	last_run: null,
};

export interface StoredTemplate {
	id: string;
	kind: "reply" | "pitch";
	name: string;
	subject: string | null;
	body: string;
	updated_by: string | null;
	updated_at: string;
}

export class TemplateHandler {
	#sql: SqlStorage;
	#storage: DurableObjectStorage;
	#env: Env;
	#isAuthDO: boolean;
	#upsertDraftFn: (draftId: string, email: EmailData, attachments: any[]) => Promise<void>;

	constructor(
		sql: SqlStorage,
		storage: DurableObjectStorage,
		env: Env,
		isAuthDO: boolean,
		upsertDraftFn: (draftId: string, email: EmailData, attachments: any[]) => Promise<void>,
	) {
		this.#sql = sql;
		this.#storage = storage;
		this.#env = env;
		this.#isAuthDO = isAuthDO;
		this.#upsertDraftFn = upsertDraftFn;
	}

	#mapTemplate(r: any): StoredTemplate {
		return {
			id: String(r.id),
			kind: r.kind === "pitch" ? "pitch" : "reply",
			name: String(r.name),
			subject: r.subject ? String(r.subject) : null,
			body: String(r.body),
			updated_by: r.updated_by ? String(r.updated_by) : null,
			updated_at: String(r.updated_at),
		};
	}

	async listTemplates(): Promise<StoredTemplate[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const sql = this.#sql;
		const now = new Date().toISOString();
		if (!(await this.#storage.get("templates_seeded"))) {
			for (const t of DEFAULT_TEMPLATES) {
				sql.exec(
					`INSERT OR IGNORE INTO templates (id, kind, name, subject, body, updated_by, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
					t.id,
					t.kind,
					t.name,
					t.subject,
					t.body,
					now,
					now,
				);
			}
			await this.#storage.put("templates_seeded", true);
		}
		if (!(await this.#storage.get("followup_template_seeded"))) {
			sql.exec(
				`INSERT OR IGNORE INTO templates (id, kind, name, subject, body, updated_by, created_at, updated_at)
				 VALUES (?, 'reply', ?, NULL, ?, NULL, ?, ?)`,
				DEFAULT_FOLLOWUP_TEMPLATE.id,
				DEFAULT_FOLLOWUP_TEMPLATE.name,
				DEFAULT_FOLLOWUP_TEMPLATE.body,
				now,
				now,
			);
			await this.#storage.put("followup_template_seeded", true);
		}
		const rows = sql
			.exec(
				"SELECT id, kind, name, subject, body, updated_by, updated_at FROM templates ORDER BY kind DESC, name COLLATE NOCASE",
			)
			.toArray();
		const out = rows.map((r) => this.#mapTemplate(r));
		if (!out.some((t) => t.id === PITCH_TEMPLATE_ID)) {
			await this.resetPitchTemplate();
			return await this.listTemplates();
		}
		return out;
	}

	async saveTemplate(
		template: {
			id?: string;
			kind: "reply" | "pitch";
			name: string;
			subject: string | null;
			body: string;
		},
		userEmail: string,
	): Promise<StoredTemplate | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const sql = this.#sql;
		const now = new Date().toISOString();
		if (template.id) {
			const cursor = sql.exec(
				"UPDATE templates SET name = ?, subject = ?, body = ?, updated_by = ?, updated_at = ? WHERE id = ? AND kind = ?",
				template.name,
				template.subject,
				template.body,
				userEmail,
				now,
				template.id,
				template.kind,
			);
			if (cursor.rowsWritten === 0) return null;
			return this.#mapTemplate(
				sql.exec("SELECT * FROM templates WHERE id = ?", template.id).toArray()[0],
			);
		}
		const count = (sql.exec("SELECT COUNT(*) AS n FROM templates").toArray()[0] as any).n as number;
		if (count >= TEMPLATE_LIMITS.maxTemplates) throw new Error("Template limit reached");
		const id = crypto.randomUUID();
		sql.exec(
			`INSERT INTO templates (id, kind, name, subject, body, updated_by, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			template.kind,
			template.name,
			template.subject,
			template.body,
			userEmail,
			now,
			now,
		);
		return this.#mapTemplate(sql.exec("SELECT * FROM templates WHERE id = ?", id).toArray()[0]);
	}

	async deleteTemplate(id: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const cursor = this.#sql.exec(
			"DELETE FROM templates WHERE id = ? AND kind = 'reply'",
			id,
		);
		return cursor.rowsWritten > 0;
	}

	async resetPitchTemplate(): Promise<StoredTemplate> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const seed = DEFAULT_TEMPLATES.find((t) => t.id === PITCH_TEMPLATE_ID)!;
		const now = new Date().toISOString();
		this.#sql.exec(
			`INSERT INTO templates (id, kind, name, subject, body, updated_by, created_at, updated_at)
			 VALUES (?, 'pitch', ?, ?, ?, NULL, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET name = excluded.name, subject = excluded.subject,
			   body = excluded.body, updated_by = NULL, updated_at = excluded.updated_at`,
			seed.id,
			seed.name,
			seed.subject,
			seed.body,
			now,
			now,
		);
		return this.#mapTemplate(
			this.#sql.exec("SELECT * FROM templates WHERE id = ?", seed.id).toArray()[0],
		);
	}

	async getFollowUpConfig(): Promise<FollowUpConfig> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const stored = (await this.#storage.get("followup_config")) as Partial<FollowUpConfig> | undefined;
		return { ...DEFAULT_FOLLOWUP_CONFIG, ...(stored || {}) };
	}

	async setFollowUpConfig(
		patch: Partial<Pick<FollowUpConfig, "enabled" | "delay_days" | "max_followups" | "template_id">> & {
			catch_up_days?: number;
		},
	): Promise<FollowUpConfig> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const current = await this.getFollowUpConfig();
		const next: FollowUpConfig = { ...current };
		if (typeof patch.delay_days === "number") {
			next.delay_days = Math.max(1, Math.min(30, Math.round(patch.delay_days)));
		}
		if (typeof patch.max_followups === "number") {
			next.max_followups = Math.max(1, Math.min(3, Math.round(patch.max_followups)));
		}
		if (typeof patch.template_id === "string" && patch.template_id) {
			next.template_id = patch.template_id;
		}
		if (typeof patch.enabled === "boolean") {
			if (patch.enabled && !current.enabled) {
				const catchUp = Math.max(0, Math.min(30, Math.round(patch.catch_up_days || 0)));
				next.enabled_at = new Date(Date.now() - catchUp * 86_400_000).toISOString();
			}
			next.enabled = patch.enabled;
		}
		await this.#storage.put("followup_config", next);
		return next;
	}

	async recordFollowUpRun(drafts: number): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const current = await this.getFollowUpConfig();
		await this.#storage.put("followup_config", {
			...current,
			last_run: { at: new Date().toISOString(), drafts },
		});
	}

	async getOutreachChains(sinceIso: string): Promise<Chain[]> {
		const sql = this.#sql;
		const sent = sql
			.exec(
				`SELECT id, recipient, subject, date, in_reply_to, opened_count, clicked_count, delivery_status, thread_id
				 FROM emails WHERE folder_id = 'sent' AND date >= ? ORDER BY date ASC LIMIT 3000`,
				sinceIso,
			)
			.toArray() as any[];
		const inbound = sql
			.exec(
				`SELECT sender, date FROM emails WHERE folder_id NOT IN ('sent', 'drafts') AND date >= ? LIMIT 8000`,
				sinceIso,
			)
			.toArray() as any[];
		const pending = new Map<string, string>();
		const drafts = sql
			.exec(
				`SELECT f.draft_id AS draft_id, f.recipient AS recipient FROM followups f
				 JOIN emails e ON e.id = f.draft_id AND e.folder_id = 'drafts'`,
			)
			.toArray() as any[];
		for (const d of drafts) pending.set(String(d.recipient), String(d.draft_id));
		return buildChains(sent, inbound, pending);
	}

	async createFollowUpDraft(draft: {
		id: string;
		mailboxId: string;
		recipient: string;
		subject: string;
		html: string;
		threadId: string | null;
		originalEmailId: string;
	}): Promise<void> {
		await this.#upsertDraftFn(
			draft.id,
			{
				id: draft.id,
				subject: draft.subject,
				sender: draft.mailboxId,
				recipient: draft.recipient,
				cc: null,
				bcc: null,
				date: new Date().toISOString(),
				body: draft.html,
				in_reply_to: null,
				email_references: null,
				thread_id: draft.threadId || draft.originalEmailId,
				delivery_status: "draft",
				spam_score: 0.0,
			},
			[],
		);
		this.#sql.exec(
			"INSERT OR REPLACE INTO followups (draft_id, recipient, original_email_id, created_at) VALUES (?, ?, ?, ?)",
			draft.id,
			draft.recipient,
			draft.originalEmailId,
			new Date().toISOString(),
		);
	}

	async notifyFollowUps(mailboxId: string, count: number, firstRecipient: string): Promise<void> {
		try {
			const authDO = this.#env.MAILBOX.get(this.#env.MAILBOX.idFromName("AUTH"));
			const targets = await authDO.getPushTargetsForMailbox(mailboxId);
			if (targets.length === 0) return;
			const vapidKeys = await authDO.getVapidKeys();
			const subjectContact = this.#env.VAPID_SUBJECT || "support@reflect.cloud";
			const payload = {
				title: count === 1 ? "Follow-up ready to review" : `${count} follow-ups ready to review`,
				body:
					count === 1
						? `No reply yet from ${firstRecipient}. A draft is waiting in Drafts.`
						: `No reply yet from ${firstRecipient} and ${count - 1} more. Drafts are waiting.`,
				icon: "/icons/icon-192.png",
				badge: "/icons/badge-72.png",
				tag: `followups-${mailboxId}`,
				data: { mailboxId, url: `/mailbox/${encodeURIComponent(mailboxId)}/emails/drafts` },
				actions: [{ action: "open", title: "Review" }],
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
			console.error("Follow-up notification failed:", err);
		}
	}
}
