import type { Env } from "../types";

export class SuppressionHandler {
	#sql: SqlStorage;
	#storage: DurableObjectStorage;
	#env: Env;
	#isAuthDO: boolean;

	constructor(
		sql: SqlStorage,
		storage: DurableObjectStorage,
		env: Env,
		isAuthDO: boolean,
	) {
		this.#sql = sql;
		this.#storage = storage;
		this.#env = env;
		this.#isAuthDO = isAuthDO;
	}

	async getUnsubscribeSecret(): Promise<string> {
		if (!this.#isAuthDO) {
			const authDO = this.#env.MAILBOX.get(this.#env.MAILBOX.idFromName("AUTH"));
			return await authDO.getUnsubscribeSecret();
		}
		const stored = (await this.#storage.get("unsubscribe_secret")) as string | undefined;
		if (stored) return stored;
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
		await this.#storage.put("unsubscribe_secret", secret);
		return secret;
	}

	async addSuppression(
		email: string,
		reason: "bounce" | "unsubscribe" | "manual",
		detail?: string | null,
		sourceMailbox?: string | null,
	): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const cursor = this.#sql.exec(
			`INSERT OR IGNORE INTO suppressions (email, reason, detail, source_mailbox, created_at)
			 VALUES (?, ?, ?, ?, ?)`,
			email.toLowerCase(),
			reason,
			detail ? detail.slice(0, 500) : null,
			sourceMailbox || null,
			new Date().toISOString(),
		);
		return cursor.rowsWritten > 0;
	}

	async removeSuppression(email: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const cursor = this.#sql.exec(
			"DELETE FROM suppressions WHERE email = ?",
			email.toLowerCase(),
		);
		return cursor.rowsWritten > 0;
	}

	async listSuppressions(limit = 500): Promise<
		Array<{
			email: string;
			reason: string;
			detail: string | null;
			source_mailbox: string | null;
			created_at: string;
		}>
	> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const rows = this.#sql
			.exec(
				"SELECT email, reason, detail, source_mailbox, created_at FROM suppressions ORDER BY created_at DESC LIMIT ?",
				Math.max(1, Math.min(limit, 2000)),
			)
			.toArray();
		return rows.map((r: any) => ({
			email: String(r.email),
			reason: String(r.reason),
			detail: r.detail ? String(r.detail) : null,
			source_mailbox: r.source_mailbox ? String(r.source_mailbox) : null,
			created_at: String(r.created_at),
		}));
	}

	async checkSuppressions(
		emails: string[],
	): Promise<Array<{ email: string; reason: string; created_at: string }>> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const out: Array<{ email: string; reason: string; created_at: string }> = [];
		const unique = Array.from(new Set(emails.map((e) => e.toLowerCase()))).slice(0, 200);
		for (const email of unique) {
			const row = this.#sql
				.exec("SELECT email, reason, created_at FROM suppressions WHERE email = ?", email)
				.toArray()[0] as any;
			if (row) {
				out.push({
					email: String(row.email),
					reason: String(row.reason),
					created_at: String(row.created_at),
				});
			}
		}
		return out;
	}

	async markBounced(address: string): Promise<boolean> {
		const addr = address.toLowerCase();
		const rows = this.#sql
			.exec(
				`SELECT id, recipient, cc, bcc FROM emails
				 WHERE folder_id = 'sent'
				   AND (instr(lower(recipient), ?1) > 0
				     OR instr(lower(COALESCE(cc, '')), ?1) > 0
				     OR instr(lower(COALESCE(bcc, '')), ?1) > 0)
				 ORDER BY date DESC LIMIT 10`,
				addr,
			)
			.toArray() as any[];
		const escaped = addr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const exact = new RegExp(`(^|[\\s,;<])${escaped}($|[\\s,;>])`, "i");
		const hit = rows.find((r) =>
			[r.recipient, r.cc, r.bcc].some((f) => typeof f === "string" && exact.test(f)),
		);
		if (!hit) return false;
		this.#sql.exec(
			"UPDATE emails SET delivery_status = 'bounced' WHERE id = ?",
			hit.id,
		);
		return true;
	}
}
