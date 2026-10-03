import type { DOQB } from "workers-qb";
import { buildSearchFilterSql, parseSearchQuery } from "../search-query";
import type { PushHandler } from "./push";
import type { EmailData } from "../types";

export type { EmailData };

export const ALLOWED_SORT_COLUMNS = [
	"id",
	"subject",
	"sender",
	"recipient",
	"date",
	"read",
	"starred",
] as const;

export type SortColumn = (typeof ALLOWED_SORT_COLUMNS)[number];

export interface GetEmailsOptions {
	folder?: string;
	page?: number;
	limit?: number;
	offset?: number;
	beforeDate?: string;
	beforeId?: string;
	sortColumn?: SortColumn;
	sortDirection?: "ASC" | "DESC";
}


export interface AttachmentData {
	id: string;
	email_id: string;
	filename: string;
	mimetype: string;
	size: number;
	content_id?: string | null;
	disposition?: string | null;
}

export class EmailHandler {
	#sql: SqlStorage;
	#qb: DOQB;
	#pushHandler: PushHandler;
	#waitUntil: (promise: Promise<any>) => void;

	constructor(
		sql: SqlStorage,
		qb: DOQB,
		pushHandler: PushHandler,
		waitUntil: (promise: Promise<any>) => void,
	) {
		this.#sql = sql;
		this.#qb = qb;
		this.#pushHandler = pushHandler;
		this.#waitUntil = waitUntil;
	}

	async getEmails(options: GetEmailsOptions = {}) {
		const {
			folder,
			page = 1,
			limit = 25,
			sortColumn: rawSortColumn = "date",
			sortDirection = "DESC",
		} = options;

		const sortColumn: SortColumn = ALLOWED_SORT_COLUMNS.includes(
			rawSortColumn as SortColumn,
		)
			? rawSortColumn
			: "date";

		let query = this.#qb
			.select<EmailData>("emails")
			.fields([
				"id",
				"folder_id",
				"subject",
				"sender",
				"recipient",
				"cc",
				"bcc",
				"date",
				"read",
				"starred",
				"in_reply_to",
				"email_references",
				"thread_id",
				"opened_at",
				"opened_count",
				"clicked_at",
				"clicked_count",
				"delivery_status",
				"spam_score",
				"snoozed_until",
				"scheduled_at",
				"send_error",
				"body",
			]);

		if (folder) {
			if (folder.toLowerCase() === "snoozed") {
				query = query.where("snoozed_until IS NOT NULL AND folder_id = 'inbox'");
			} else if (folder.toLowerCase() === "scheduled") {
				query = query.where("scheduled_at IS NOT NULL AND folder_id = 'drafts'");
			} else if (folder.toLowerCase() === "starred") {
				query = query.where(
					"starred = 1 AND (folder_id IS NULL OR folder_id NOT IN ('trash', 'spam')) AND snoozed_until IS NULL AND scheduled_at IS NULL",
				);
			} else {
				const folderIdSubquery = this.#qb
					.select("folders")
					.fields(["id"])
					.where("name = ? OR id = ?", [folder, folder])
					.limit(1);
				query = query.where("folder_id = ?", folderIdSubquery as any);
				query = query.where("snoozed_until IS NULL AND scheduled_at IS NULL");
			}
		}

		const useCursor =
			sortColumn === "date" &&
			sortDirection === "DESC" &&
			typeof options.beforeDate === "string" &&
			options.beforeDate.length > 0;
		if (useCursor) {
			const beforeDate = options.beforeDate as string;
			if (options.beforeId) {
				query = query.where("(date < ? OR (date = ? AND id < ?))", [
					beforeDate,
					beforeDate,
					options.beforeId,
				]);
			} else {
				query = query.where("date < ?", beforeDate);
			}
		}

		const offset = useCursor
			? 0
			: typeof options.offset === "number" && options.offset >= 0
				? options.offset
				: (page - 1) * limit;

		const order =
			sortColumn === "id"
				? [`id ${sortDirection}`]
				: [`${sortColumn} ${sortDirection}`, `id ${sortDirection}`];
		query = query.orderBy(order).limit(limit).offset(offset);

		const result = query.execute();

		return (
			result.results?.map((email) => ({
				...email,
				read: !!email.read,
				starred: !!email.starred,
			})) ?? []
		);
	}

	async getEmail(id: string) {
		const email = this.#qb
			.select("emails")
			.fields(["*"])
			.where("id = ?", id)
			.one();

		if (!email.results) {
			return null;
		}

		const attachments = this.#qb
			.select("attachments")
			.fields(["*"])
			.where("email_id = ?", id)
			.execute();

		return {
			...email.results,
			read: !!email.results.read,
			starred: !!email.results.starred,
			attachments: attachments.results || [],
		};
	}

	async recordOpen(id: string) {
		const now = new Date().toISOString();
		this.#sql.exec(
			"UPDATE emails SET opened_at = COALESCE(opened_at, ?), opened_count = COALESCE(opened_count, 0) + 1 WHERE id = ?",
			now,
			id,
		);
		return true;
	}

	async recordClick(id: string) {
		const now = new Date().toISOString();
		this.#sql.exec(
			"UPDATE emails SET clicked_at = ?, clicked_count = COALESCE(clicked_count, 0) + 1 WHERE id = ?",
			now,
			id,
		);
		return true;
	}

	async updateEmail(
		id: string,
		{ read, starred }: { read?: boolean; starred?: boolean },
	) {
		const data: { read?: number; starred?: number } = {};
		if (read !== undefined) {
			data.read = read ? 1 : 0;
		}
		if (starred !== undefined) {
			data.starred = starred ? 1 : 0;
		}

		if (Object.keys(data).length === 0) {
			return this.getEmail(id);
		}

		this.#qb
			.update({
				tableName: "emails",
				data,
				where: {
					conditions: "id = ?",
					params: [id],
				},
			})
			.execute();

		return this.getEmail(id);
	}

	async deleteEmail(id: string) {
		const attachments = this.#qb
			.select("attachments")
			.fields(["id", "filename"])
			.where("email_id = ?", id)
			.execute();

		this.#qb
			.delete({
				tableName: "emails",
				where: {
					conditions: "id = ?",
					params: [id],
				},
			})
			.execute();

		this.#qb
			.delete({
				tableName: "attachments",
				where: {
					conditions: "email_id = ?",
					params: [id],
				},
			})
			.execute();

		return attachments.results || [];
	}

	async getAttachment(id: string) {
		const result = this.#qb
			.select<AttachmentData>("attachments")
			.fields(["*"])
			.where("id = ?", id)
			.one();
		return result.results;
	}

	async moveEmail(id: string, folderId: string) {
		const folder = this.#qb
			.select("folders")
			.fields(["id"])
			.where("id = ?", folderId)
			.one();

		if (!folder.results) {
			return false;
		}

		this.#qb
			.update({
				tableName: "emails",
				data: { folder_id: folderId },
				where: {
					conditions: "id = ?",
					params: [id],
				},
			})
			.execute();

		this.#sql.exec(
			`UPDATE emails SET snoozed_until = NULL,
			   delivery_status = CASE WHEN scheduled_at IS NOT NULL AND delivery_status = 'scheduled' THEN 'draft' ELSE delivery_status END,
			   scheduled_at = NULL
			 WHERE id = ?`,
			id,
		);

		return true;
	}

	async searchEmails(options: {
		query: string;
		folder?: string;
		from?: string;
		to?: string;
		date_start?: string;
		date_end?: string;
		page?: number;
		limit?: number;
	}) {
		const { query, folder, from, to, date_start, date_end, page = 1, limit = 50 } = options;
		const offset = (page - 1) * limit;

		// Parse search filter tokens and plain text terms
		const parsed = parseSearchQuery(query || "");

		// Explicit params override if provided
		if (from && !parsed.from) parsed.from = from;
		if (to && !parsed.to) parsed.to = to;
		if (date_start && !parsed.after) parsed.after = date_start;
		if (date_end && !parsed.before) parsed.before = date_end;

		const { whereSql, params } = buildSearchFilterSql(parsed, folder);

		const limitIdx = params.length + 1;
		const offsetIdx = params.length + 2;
		params.push(limit, offset);

		const sqlStr = `
			SELECT id, subject, sender, recipient, cc, bcc, date, read, starred,
			       in_reply_to, email_references, thread_id, opened_at, opened_count,
			       clicked_at, clicked_count, delivery_status, spam_score, snoozed_until,
			       scheduled_at, send_error, body
			FROM emails
			WHERE ${whereSql}
			ORDER BY date DESC
			LIMIT ?${limitIdx} OFFSET ?${offsetIdx}
		`;

		const rows = this.#sql.exec(sqlStr, ...params).toArray();

		return rows.map((email: any) => ({
			...email,
			read: !!email.read,
			starred: !!email.starred,
		}));
	}

	async createEmail(
		folder: string,
		email: EmailData,
		attachments: AttachmentData[],
		mailboxId?: string,
	) {
		this.#qb
			.insert({
				tableName: "emails",
				data: { ...email, folder_id: folder },
			})
			.execute();

		if (attachments.length > 0) {
			this.#qb
				.insert({
					tableName: "attachments",
					data: attachments as any,
				})
				.execute();
		}

		if (folder === "inbox") {
			this.#waitUntil(this.#pushHandler.dispatchPushNotifications(email, mailboxId));
		}
	}

	async upsertDraft(
		draftId: string,
		email: EmailData,
		attachments: AttachmentData[],
	) {
		const existing = this.#qb
			.select("emails")
			.fields(["id"])
			.where("id = ?", draftId)
			.one();

		if (existing.results) {
			this.#qb
				.update({
					tableName: "emails",
					data: {
						subject: email.subject,
						sender: email.sender,
						recipient: email.recipient,
						cc: email.cc,
						bcc: email.bcc,
						date: email.date,
						body: email.body,
						in_reply_to: email.in_reply_to,
						email_references: email.email_references,
						thread_id: email.thread_id,
						delivery_status: "draft",
						folder_id: "drafts",
						scheduled_at: null,
						send_error: null,
					},
					where: {
						conditions: "id = ?",
						params: [draftId],
					},
				})
				.execute();

			this.#qb
				.delete({
					tableName: "attachments",
					where: {
						conditions: "email_id = ?",
						params: [draftId],
					},
				})
				.execute();

			if (attachments && attachments.length > 0) {
				this.#qb
					.insert({
						tableName: "attachments",
						data: attachments as any,
					})
					.execute();
			}
		} else {
			this.#qb
				.insert({
					tableName: "emails",
					data: { ...email, id: draftId, folder_id: "drafts", delivery_status: "draft" },
				})
				.execute();

			if (attachments && attachments.length > 0) {
				this.#qb
					.insert({
						tableName: "attachments",
						data: attachments as any,
					})
					.execute();
			}
		}
	}

	async getThreadEmails(threadId: string) {
		const rows = this.#sql
			.exec(
				`SELECT * FROM emails 
				 WHERE thread_id = ? 
				    OR id = ? 
				    OR in_reply_to = ? 
				    OR thread_id = (SELECT thread_id FROM emails WHERE id = ? AND thread_id IS NOT NULL)
				 ORDER BY date ASC`,
				threadId,
				threadId,
				threadId,
				threadId,
			)
			.toArray();

		if (rows.length === 0) {
			return [];
		}

		const emailMap = new Map<string, any>();
		for (const row of rows) {
			emailMap.set(String(row.id), {
				...row,
				read: !!row.read,
				starred: !!row.starred,
				attachments: [],
			});
		}

		const emailIds = Array.from(emailMap.keys());
		if (emailIds.length > 0) {
			const placeholders = emailIds.map(() => "?").join(", ");
			const attRows = this.#sql
				.exec(
					`SELECT * FROM attachments WHERE email_id IN (${placeholders})`,
					...emailIds,
				)
				.toArray();

			for (const att of attRows) {
				const email = emailMap.get(String(att.email_id));
				if (email) {
					email.attachments.push(att);
				}
			}
		}

		return Array.from(emailMap.values());
	}
}
