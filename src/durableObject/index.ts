import { DurableObject } from "cloudflare:workers";
import {
	DEFAULT_TEMPLATES,
	PITCH_TEMPLATE_ID,
	TEMPLATE_LIMITS,
} from "../templates";
import { DOQB } from "workers-qb";
import { generateVapidKeys, sendWebPush, type VapidKeys } from "../push-crypto";
import type { AppBinding, DiscoverLead, Env, PushSubscriptionRecord, Session, User } from "../types";
import { authMigrations, mailboxMigrations } from "./migrations";

const ALLOWED_SORT_COLUMNS = [
	"id",
	"subject",
	"sender",
	"recipient",
	"date",
	"read",
	"starred",
] as const;

type SortColumn = (typeof ALLOWED_SORT_COLUMNS)[number];

interface GetEmailsOptions {
	folder?: string;
	page?: number;
	limit?: number;
	/** Explicit row offset; takes precedence over `page`. */
	offset?: number;
	/**
	 * Keyset cursor for infinite scroll (default date-DESC sort only): return rows strictly older than
	 * (`beforeDate`, `beforeId`). Unlike `offset`, rows moved out of / into the folder between pages can't
	 * make the next page skip or repeat a message. Takes precedence over `offset`/`page`.
	 */
	beforeDate?: string;
	beforeId?: string;
	sortColumn?: SortColumn;
	sortDirection?: "ASC" | "DESC";
}

interface EmailData {
	id: string;
	folder_id?: string | null;
	subject: string;
	sender: string;
	recipient: string;
	date: string;
	body: string;
	read?: boolean;
	starred?: boolean;
	in_reply_to?: string | null;
	email_references?: string | null;
	thread_id?: string | null;
	cc?: string | null;
	bcc?: string | null;
	opened_at?: string | null;
	opened_count?: number;
	clicked_at?: string | null;
	clicked_count?: number;
	delivery_status?: string | null;
	spam_score?: number | null;
}

interface AttachmentData {
	id: string;
	email_id: string;
	filename: string;
	mimetype: string;
	size: number;
	content_id?: string | null;
	disposition?: string | null;
}

export interface StoredTemplate {
	id: string;
	kind: "reply" | "pitch";
	name: string;
	subject: string | null;
	body: string;
	updated_by: string | null;
	updated_at: string;
}

export class MailboxDO extends DurableObject<Env> {
	declare __DURABLE_OBJECT_BRAND: never;
	#qb: DOQB;
	#isAuthDO: boolean;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.#qb = new DOQB(this.ctx.storage.sql);
		// this.#qb.setDebugger(true);

		// Detect if this is the auth singleton
		// We use a marker in storage to identify the auth DO
		const authMarker = this.ctx.storage.sql
			.exec(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
			)
			.toArray();
		const hasAuthTables = authMarker.length > 0;

		// Check if this is first initialization
		const isFirstInit =
			this.ctx.storage.sql
				.exec(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'",
				)
				.toArray().length === 0;

		// If first init, check the ID to determine type
		// idFromName creates deterministic IDs, so we check if this ID matches the expected AUTH ID
		if (isFirstInit) {
			// Create a test ID to compare
			const testAuthId = env.MAILBOX.idFromName("AUTH");
			this.#isAuthDO = this.ctx.id.equals(testAuthId);
		} else {
			// On subsequent loads, check if auth tables exist
			this.#isAuthDO = hasAuthTables;
		}

		// Apply appropriate migrations
		if (this.#isAuthDO) {
			this.#qb.migrations({ migrations: authMigrations }).apply();
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS app_bindings (
					email TEXT PRIMARY KEY,
					app_name TEXT NOT NULL,
					app_icon_url TEXT NOT NULL,
					app_url TEXT NOT NULL,
					platform TEXT NOT NULL,
					developer_name TEXT,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL
				);
				CREATE INDEX IF NOT EXISTS idx_app_bindings_platform ON app_bindings(platform);

				CREATE TABLE IF NOT EXISTS discover_leads (
					id TEXT PRIMARY KEY,
					bundle_id TEXT NOT NULL,
					platform TEXT NOT NULL,
					app_name TEXT NOT NULL,
					app_icon_url TEXT NOT NULL,
					app_url TEXT NOT NULL,
					developer_name TEXT,
					developer_email TEXT,
					developer_website TEXT,
					installs_bracket TEXT,
					rating REAL,
					reviews_count INTEGER,
					category TEXT,
					country TEXT,
					has_iap INTEGER DEFAULT 0,
					has_ads INTEGER DEFAULT 0,
					release_date TEXT,
					updated_date TEXT,
					status TEXT DEFAULT 'uncontacted',
					notes TEXT,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL
				);
				CREATE INDEX IF NOT EXISTS idx_discover_leads_bundle ON discover_leads(bundle_id, platform);
				CREATE INDEX IF NOT EXISTS idx_discover_leads_email ON discover_leads(developer_email);
			`);
		} else {
			this.#qb.migrations({ migrations: mailboxMigrations }).apply();
		}
	}

	// Auth helper: hash password using Web Crypto API
	async #hashPassword(password: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(password);
		const hash = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hash));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	// Auth helper: verify password
	async #verifyPassword(password: string, hash: string): Promise<boolean> {
		const passwordHash = await this.#hashPassword(password);
		return passwordHash === hash;
	}

	// Auth helper: generate session token
	#generateToken(): string {
		return crypto.randomUUID();
	}

	// Auth operation: check if any users exist
	async hasUsers(): Promise<boolean> {
		if (!this.#isAuthDO) return false;
		const result = this.#qb.select("users").fields(["COUNT(*) as count"]).one();
		return (result.results?.count as number) > 0;
	}

	// Auth operation: check if user is admin
	async isAdmin(userId: string): Promise<boolean> {
		if (!this.#isAuthDO) return false;
		const result = this.#qb
			.select("users")
			.fields(["is_admin"])
			.where("id = ?", userId)
			.one();
		return result.results?.is_admin === 1;
	}

	// Auth operation: register a user
	async register(
		email: string,
		password: string,
		isFirstUser = false,
	): Promise<User> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const userId = crypto.randomUUID();
		const passwordHash = await this.#hashPassword(password);
		const now = Date.now();

		this.#qb
			.insert({
				tableName: "users",
				data: {
					id: userId,
					email,
					password_hash: passwordHash,
					is_admin: isFirstUser ? 1 : 0,
					created_at: now,
					updated_at: now,
				},
			})
			.execute();

		return {
			id: userId,
			email,
			isAdmin: isFirstUser,
			createdAt: now,
			updatedAt: now,
		};
	}

	// Auth operation: login
	async login(email: string, password: string): Promise<Session | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("users")
			.fields(["id", "email", "password_hash", "is_admin"])
			.where("email = ?", email)
			.one();

		if (!result.results) return null;

		const user = result.results;
		const isValid = await this.#verifyPassword(
			password,
			String(user.password_hash),
		);

		if (!isValid) return null;

		// Create session (30 days expiry)
		const sessionId = this.#generateToken();
		const now = Date.now();
		const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

		this.#qb
			.insert({
				tableName: "sessions",
				data: {
					id: sessionId,
					user_id: String(user.id),
					expires_at: expiresAt,
					created_at: now,
				},
			})
			.execute();

		return {
			id: sessionId,
			userId: String(user.id),
			email: String(user.email),
			isAdmin: user.is_admin === 1,
			expiresAt,
		};
	}

	// Auth operation: validate session
	async validateSession(sessionId: string): Promise<Session | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("sessions")
			.fields(["id", "user_id", "expires_at"])
			.where("id = ?", sessionId)
			.one();

		if (!result.results) return null;

		const session = result.results;
		const expiresAt = Number(session.expires_at);

		// Check if expired
		if (expiresAt < Date.now()) {
			this.#qb
				.delete({
					tableName: "sessions",
					where: {
						conditions: "id = ?",
						params: [sessionId],
					},
				})
				.execute();
			return null;
		}

		// Get user info
		const userResult = this.#qb
			.select("users")
			.fields(["email", "is_admin"])
			.where("id = ?", String(session.user_id))
			.one();

		if (!userResult.results) return null;

		return {
			id: String(session.id),
			userId: String(session.user_id),
			email: String(userResult.results.email),
			isAdmin: userResult.results.is_admin === 1,
			expiresAt,
		};
	}

	// Auth operation: logout
	async logout(sessionId: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		this.#qb
			.delete({
				tableName: "sessions",
				where: {
					conditions: "id = ?",
					params: [sessionId],
				},
			})
			.execute();

		return true;
	}

	// Auth operation: get all users (admin only)
	async getUsers(): Promise<User[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("users")
			.fields(["id", "email", "is_admin", "created_at", "updated_at"])
			.execute();

		return (
			result.results?.map((user) => ({
				id: String(user.id),
				email: String(user.email),
				isAdmin: user.is_admin === 1,
				createdAt: Number(user.created_at),
				updatedAt: Number(user.updated_at),
			})) ?? []
		);
	}

	// Auth operation: get user by email
	async getUserByEmail(email: string): Promise<User | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("users")
			.fields(["id", "email", "is_admin", "created_at", "updated_at"])
			.where("email = ?", email)
			.execute();

		if (!result.results || result.results.length === 0) {
			return null;
		}

		const user = result.results[0];
		return {
			id: String(user.id),
			email: String(user.email),
			isAdmin: user.is_admin === 1,
			createdAt: Number(user.created_at),
			updatedAt: Number(user.updated_at),
		};
	}

	// Auth operation: update user password
	async updateUserPassword(userId: string, newPassword: string): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const hashedPassword = await this.#hashPassword(newPassword);

		this.#qb
			.update({
				tableName: "users",
				data: {
					password_hash: hashedPassword,
					updated_at: Date.now(),
				},
				where: {
					conditions: "id = ?",
					params: [userId],
				},
			})
			.execute();
	}

	// Auth operation: grant mailbox access
	async grantMailboxAccess(
		userId: string,
		mailboxId: string,
		role: string,
	): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		this.#qb
			.insert({
				tableName: "user_mailboxes",
				data: {
					user_id: userId,
					mailbox_id: mailboxId,
					role,
				},
			})
			.execute();
	}

	// Auth operation: revoke mailbox access
	async revokeMailboxAccess(userId: string, mailboxId: string): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		this.#qb
			.delete({
				tableName: "user_mailboxes",
				where: {
					conditions: "user_id = ? AND mailbox_id = ?",
					params: [userId, mailboxId],
				},
			})
			.execute();
	}

	// Auth operation: get user mailboxes
	async getUserMailboxes(
		userId: string,
	): Promise<Array<{ mailboxId: string; role: string }>> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("user_mailboxes")
			.fields(["mailbox_id", "role"])
			.where("user_id = ?", userId)
			.execute();

		return (
			result.results?.map((row) => ({
				mailboxId: String(row.mailbox_id),
				role: String(row.role),
			})) ?? []
		);
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
				"body",
			]);

		if (folder) {
			if (folder.toLowerCase() === "starred") {
				// Virtual "Starred" view: don't resurface messages the user has trashed or that are spam.
				query = query.where(
					"starred = 1 AND (folder_id IS NULL OR folder_id NOT IN ('trash', 'spam'))",
				);
			} else {
				const folderIdSubquery = this.#qb
					.select("folders")
					.fields(["id"])
					.where("name = ? OR id = ?", [folder, folder])
					.limit(1);
				query = query.where("folder_id = ?", folderIdSubquery as any);
			}
		}

		// Keyset cursor (only meaningful for the default newest-first order). `date` is always an ISO-8601
		// UTC string, so lexical comparison == chronological comparison.
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
		// `id` tie-breaker makes the order total, so pages (offset or cursor) are deterministic when
		// several messages share the same timestamp.
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
		this.ctx.storage.sql.exec(
			"UPDATE emails SET opened_at = COALESCE(opened_at, ?), opened_count = COALESCE(opened_count, 0) + 1 WHERE id = ?",
			now,
			id,
		);
		return true;
	}

	async recordClick(id: string) {
		const now = new Date().toISOString();
		this.ctx.storage.sql.exec(
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

	async getFolders(): Promise<Array<{ id: string; name: string; unreadCount: number }>> {
		const rows = this.ctx.storage.sql
			.exec(
				`SELECT f.id, f.name, COUNT(CASE WHEN e.read = 0 THEN 1 END) as unreadCount
				 FROM folders f
				 LEFT JOIN emails e ON f.id = e.folder_id
				 GROUP BY f.id, f.name`,
			)
			.toArray();
		return rows.map((r: any) => ({
			id: String(r.id),
			name: String(r.name),
			unreadCount: Number(r.unreadCount || 0),
		}));
	}

	async createFolder(
		id: string,
		name: string,
	): Promise<{ id: string; name: string; unreadCount: number } | null> {
		try {
			const result = this.#qb
				.insert({
					tableName: "folders",
					data: { id, name },
					returning: ["id", "name"],
				})
				.execute();
			const newFolder = result.results as any;
			return { id: String(newFolder.id), name: String(newFolder.name), unreadCount: 0 };
		} catch (e: any) {
			if (e.message.includes("UNIQUE constraint failed")) {
				return null;
			}
			throw e;
		}
	}

	async updateFolder(
		id: string,
		name: string,
	): Promise<{ id: string; name: string; unreadCount: number } | null> {
		this.#qb
			.update({
				tableName: "folders",
				data: { name },
				where: {
					conditions: "id = ?",
					params: [id],
				},
			})
			.execute();
		const rows = this.ctx.storage.sql
			.exec(
				`SELECT f.id, f.name, COUNT(CASE WHEN e.read = 0 THEN 1 END) as unreadCount
				 FROM folders f
				 LEFT JOIN emails e ON f.id = e.folder_id
				 WHERE f.id = ?
				 GROUP BY f.id, f.name`,
				id,
			)
			.toArray();
		if (rows.length > 0) {
			const r: any = rows[0];
			return {
				id: String(r.id),
				name: String(r.name),
				unreadCount: Number(r.unreadCount || 0),
			};
		}
		return null;
	}

	async deleteFolder(id: string) {
		const folder = this.#qb
			.select<{ is_deletable: number }>("folders")
			.fields(["is_deletable"])
			.where("id = ?", id)
			.one();

		if (!folder.results || folder.results.is_deletable === 0) {
			return false;
		}

		this.#qb
			.delete({
				tableName: "folders",
				where: {
					conditions: "id = ?",
					params: [id],
				},
			})
			.execute();

		return true;
	}

	async getContacts() {
		const query = this.#qb.select("contacts").fields(["id", "name", "email"]);
		const result = query.execute();
		return result.results || [];
	}

	async createContact(contact: { name?: string; email: string }) {
		const result = this.#qb
			.insert({
				tableName: "contacts",
				data: contact,
				returning: ["id", "name", "email"],
			})
			.execute();
		return result.results;
	}

	async updateContact(id: number, contact: { name?: string; email?: string }) {
		this.#qb
			.update({
				tableName: "contacts",
				data: contact,
				where: {
					conditions: "id = ?",
					params: [id],
				},
			})
			.execute();
		const query = this.#qb
			.select("contacts")
			.fields(["id", "name", "email"])
			.where("id = ?", id);
		const result = query.one();
		return result.results;
	}

	async deleteContact(id: number) {
		this.#qb
			.delete({
				tableName: "contacts",
				where: {
					conditions: "id = ?",
					params: [id],
				},
			})
			.execute();
		return true;
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

		return true;
	}

	async searchEmails(options: {
		query: string;
		folder?: string;
		from?: string;
		to?: string;
		date_start?: string;
		date_end?: string;
	}) {
		const { query, folder, from, to, date_start, date_end } = options;
		let qb = this.#qb
			.select<EmailData>("emails")
			.fields([
				"id",
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
				"body",
			]);

		if (folder) {
			const folderIdSubquery = this.#qb
				.select("folders")
				.fields(["id"])
				.where("name = ? OR id = ?", [folder, folder])
				.limit(1);
			qb = qb.where("folder_id = ?", folderIdSubquery as any);
		}

		if (from) {
			qb = qb.where("sender LIKE ?", `%${from}%`);
		}

		if (to) {
			qb = qb.where("recipient LIKE ?", `%${to}%`);
		}

		if (date_start) {
			qb = qb.where("date >= ?", date_start);
		}

		if (date_end) {
			qb = qb.where("date <= ?", date_end);
		}

		qb = qb.where("(subject LIKE ? OR body LIKE ?)", [
			`%${query}%`,
			`%${query}%`,
		]);

		const result = qb.execute();

		return (
			result.results?.map((email) => ({
				...email,
				read: !!email.read,
				starred: !!email.starred,
			})) ?? []
		);
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
			this.ctx.waitUntil(this.#dispatchPushNotifications(email, mailboxId));
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
		const rows = this.ctx.storage.sql
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
			const attRows = this.ctx.storage.sql
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

	// App Bindings methods (AUTH DO singleton)
	async getAllAppBindings(): Promise<AppBinding[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const rows = this.ctx.storage.sql
			.exec(
				"SELECT email, app_name, app_icon_url, app_url, platform, developer_name, created_at, updated_at FROM app_bindings ORDER BY updated_at DESC",
			)
			.toArray();
		return rows.map((r: any) => ({
			email: String(r.email),
			app_name: String(r.app_name),
			app_icon_url: String(r.app_icon_url),
			app_url: String(r.app_url),
			platform: String(r.platform) as any,
			developer_name: r.developer_name ? String(r.developer_name) : null,
			created_at: Number(r.created_at),
			updated_at: Number(r.updated_at),
		}));
	}

	async getAppBinding(email: string): Promise<AppBinding | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const match = email.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
		const cleanEmail = match
			? match[0].toLowerCase()
			: email.split(",")[0].replace(/^["']|["']$/g, "").trim().toLowerCase();
		const rows = this.ctx.storage.sql
			.exec(
				"SELECT email, app_name, app_icon_url, app_url, platform, developer_name, created_at, updated_at FROM app_bindings WHERE email = ?",
				cleanEmail,
			)
			.toArray();
		if (rows.length === 0) return null;
		const r: any = rows[0];
		return {
			email: String(r.email),
			app_name: String(r.app_name),
			app_icon_url: String(r.app_icon_url),
			app_url: String(r.app_url),
			platform: String(r.platform) as any,
			developer_name: r.developer_name ? String(r.developer_name) : null,
			created_at: Number(r.created_at),
			updated_at: Number(r.updated_at),
		};
	}

	async setAppBinding(binding: {
		email: string;
		app_name: string;
		app_icon_url: string;
		app_url: string;
		platform: string;
		developer_name?: string | null;
	}): Promise<AppBinding> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const match = binding.email.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
		const cleanEmail = match
			? match[0].toLowerCase()
			: binding.email.split(",")[0].replace(/^["']|["']$/g, "").trim().toLowerCase();
		const now = Date.now();
		const devName = binding.developer_name?.trim() || null;

		const existing = this.ctx.storage.sql
			.exec("SELECT created_at FROM app_bindings WHERE email = ?", cleanEmail)
			.toArray();
		const createdAt = existing.length > 0 ? Number(existing[0].created_at) : now;

		this.ctx.storage.sql.exec(
			`INSERT INTO app_bindings (email, app_name, app_icon_url, app_url, platform, developer_name, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(email) DO UPDATE SET
			   app_name = excluded.app_name,
			   app_icon_url = excluded.app_icon_url,
			   app_url = excluded.app_url,
			   platform = excluded.platform,
			   developer_name = excluded.developer_name,
			   updated_at = excluded.updated_at`,
			cleanEmail,
			binding.app_name.trim(),
			binding.app_icon_url.trim(),
			binding.app_url.trim(),
			binding.platform,
			devName,
			createdAt,
			now,
		);

		return {
			email: cleanEmail,
			app_name: binding.app_name.trim(),
			app_icon_url: binding.app_icon_url.trim(),
			app_url: binding.app_url.trim(),
			platform: binding.platform as any,
			developer_name: devName,
			created_at: createdAt,
			updated_at: now,
		};
	}

	async deleteAppBinding(email: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const match = email.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
		const cleanEmail = match
			? match[0].toLowerCase()
			: email.split(",")[0].replace(/^["']|["']$/g, "").trim().toLowerCase();
		this.ctx.storage.sql.exec(
			"DELETE FROM app_bindings WHERE email = ?",
			cleanEmail,
		);
		return true;
	}

	// Discover Leads methods (AUTH DO singleton)
	async getAllDiscoverLeads(): Promise<DiscoverLead[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const rows = this.ctx.storage.sql
			.exec(
				"SELECT id, bundle_id, platform, app_name, app_icon_url, app_url, developer_name, developer_email, developer_website, installs_bracket, rating, reviews_count, category, country, has_iap, has_ads, release_date, updated_date, status, notes, created_at, updated_at FROM discover_leads ORDER BY updated_at DESC",
			)
			.toArray();
		return rows.map((r: any) => ({
			id: String(r.id),
			bundle_id: String(r.bundle_id),
			platform: String(r.platform) as any,
			app_name: String(r.app_name),
			app_icon_url: String(r.app_icon_url),
			app_url: String(r.app_url),
			developer_name: r.developer_name ? String(r.developer_name) : null,
			developer_email: r.developer_email ? String(r.developer_email) : null,
			developer_website: r.developer_website ? String(r.developer_website) : null,
			installs_bracket: r.installs_bracket ? String(r.installs_bracket) : null,
			rating: r.rating !== null && r.rating !== undefined ? Number(r.rating) : null,
			reviews_count: r.reviews_count !== null && r.reviews_count !== undefined ? Number(r.reviews_count) : null,
			category: r.category ? String(r.category) : null,
			country: r.country ? String(r.country) : null,
			has_iap: Boolean(r.has_iap),
			has_ads: Boolean(r.has_ads),
			release_date: r.release_date ? String(r.release_date) : null,
			updated_date: r.updated_date ? String(r.updated_date) : null,
			status: (r.status as any) || "uncontacted",
			notes: r.notes ? String(r.notes) : null,
			created_at: Number(r.created_at),
			updated_at: Number(r.updated_at),
		}));
	}

	async getDiscoverLead(id: string): Promise<DiscoverLead | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const rows = this.ctx.storage.sql
			.exec(
				"SELECT id, bundle_id, platform, app_name, app_icon_url, app_url, developer_name, developer_email, developer_website, installs_bracket, rating, reviews_count, category, country, has_iap, has_ads, release_date, updated_date, status, notes, created_at, updated_at FROM discover_leads WHERE id = ?",
				id,
			)
			.toArray();
		if (rows.length === 0) return null;
		const r: any = rows[0];
		return {
			id: String(r.id),
			bundle_id: String(r.bundle_id),
			platform: String(r.platform) as any,
			app_name: String(r.app_name),
			app_icon_url: String(r.app_icon_url),
			app_url: String(r.app_url),
			developer_name: r.developer_name ? String(r.developer_name) : null,
			developer_email: r.developer_email ? String(r.developer_email) : null,
			developer_website: r.developer_website ? String(r.developer_website) : null,
			installs_bracket: r.installs_bracket ? String(r.installs_bracket) : null,
			rating: r.rating !== null && r.rating !== undefined ? Number(r.rating) : null,
			reviews_count: r.reviews_count !== null && r.reviews_count !== undefined ? Number(r.reviews_count) : null,
			category: r.category ? String(r.category) : null,
			country: r.country ? String(r.country) : null,
			has_iap: Boolean(r.has_iap),
			has_ads: Boolean(r.has_ads),
			release_date: r.release_date ? String(r.release_date) : null,
			updated_date: r.updated_date ? String(r.updated_date) : null,
			status: (r.status as any) || "uncontacted",
			notes: r.notes ? String(r.notes) : null,
			created_at: Number(r.created_at),
			updated_at: Number(r.updated_at),
		};
	}

	async setDiscoverLead(lead: {
		id?: string;
		bundle_id: string;
		platform: string;
		app_name: string;
		app_icon_url: string;
		app_url: string;
		developer_name?: string | null;
		developer_email?: string | null;
		developer_website?: string | null;
		installs_bracket?: string | null;
		rating?: number | null;
		reviews_count?: number | null;
		category?: string | null;
		country?: string | null;
		has_iap?: boolean;
		has_ads?: boolean;
		release_date?: string | null;
		updated_date?: string | null;
		status?: string;
		notes?: string | null;
	}): Promise<DiscoverLead> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const id = lead.id || `${lead.platform}_${lead.bundle_id}`;
		const now = Date.now();
		const existing = this.ctx.storage.sql
			.exec("SELECT created_at FROM discover_leads WHERE id = ?", id)
			.toArray();
		const createdAt = existing.length > 0 ? Number(existing[0].created_at) : now;

		this.ctx.storage.sql.exec(
			`INSERT INTO discover_leads (
				id, bundle_id, platform, app_name, app_icon_url, app_url,
				developer_name, developer_email, developer_website, installs_bracket,
				rating, reviews_count, category, country, has_iap, has_ads,
				release_date, updated_date, status, notes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				app_name = excluded.app_name,
				app_icon_url = excluded.app_icon_url,
				app_url = excluded.app_url,
				developer_name = excluded.developer_name,
				developer_email = excluded.developer_email,
				developer_website = excluded.developer_website,
				installs_bracket = excluded.installs_bracket,
				rating = excluded.rating,
				reviews_count = excluded.reviews_count,
				category = excluded.category,
				country = excluded.country,
				has_iap = excluded.has_iap,
				has_ads = excluded.has_ads,
				release_date = excluded.release_date,
				updated_date = excluded.updated_date,
				status = excluded.status,
				notes = excluded.notes,
				updated_at = excluded.updated_at`,
			id,
			lead.bundle_id,
			lead.platform,
			lead.app_name,
			lead.app_icon_url,
			lead.app_url,
			lead.developer_name || null,
			lead.developer_email || null,
			lead.developer_website || null,
			lead.installs_bracket || null,
			lead.rating !== undefined ? lead.rating : null,
			lead.reviews_count !== undefined ? lead.reviews_count : null,
			lead.category || null,
			lead.country || null,
			lead.has_iap ? 1 : 0,
			lead.has_ads ? 1 : 0,
			lead.release_date || null,
			lead.updated_date || null,
			lead.status || "uncontacted",
			lead.notes || null,
			createdAt,
			now,
		);

		return {
			id,
			bundle_id: lead.bundle_id,
			platform: lead.platform as any,
			app_name: lead.app_name,
			app_icon_url: lead.app_icon_url,
			app_url: lead.app_url,
			developer_name: lead.developer_name || null,
			developer_email: lead.developer_email || null,
			developer_website: lead.developer_website || null,
			installs_bracket: lead.installs_bracket || null,
			rating: lead.rating !== undefined ? lead.rating : null,
			reviews_count: lead.reviews_count !== undefined ? lead.reviews_count : null,
			category: lead.category || null,
			country: lead.country || null,
			has_iap: Boolean(lead.has_iap),
			has_ads: Boolean(lead.has_ads),
			release_date: lead.release_date || null,
			updated_date: lead.updated_date || null,
			status: (lead.status as any) || "uncontacted",
			notes: lead.notes || null,
			created_at: createdAt,
			updated_at: now,
		};
	}

	async deleteDiscoverLead(id: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		this.ctx.storage.sql.exec(
			"DELETE FROM discover_leads WHERE id = ? OR bundle_id = ? OR id = ? OR id = ?",
			id,
			id,
			`playstore_${id}`,
			`appstore_${id}`,
		);
		return true;
	}

	// Mailbox DO method: query recipient outreach stats from emails table
	async getSentEmailRecipients(emails: string[]): Promise<Record<string, { sent: boolean; opened_count: number }>> {
		if (emails.length === 0) return {};
		const result: Record<string, { sent: boolean; opened_count: number }> = {};
		for (const rawEmail of emails) {
			const clean = rawEmail.trim().toLowerCase();
			if (!clean) continue;
			try {
				const rows = this.ctx.storage.sql
					.exec(
						"SELECT opened_count, opened_at FROM emails WHERE LOWER(recipient) LIKE ? OR LOWER(recipient) = ? ORDER BY opened_count DESC LIMIT 1",
						`%${clean}%`,
						clean,
					)
					.toArray();
				if (rows.length > 0) {
					const r: any = rows[0];
					const opened = Number(r.opened_count || 0) > 0 ? Number(r.opened_count) : (r.opened_at ? 1 : 0);
					result[clean] = {
						sent: true,
						opened_count: opened,
					};
				}
			} catch {
				// Table might not exist or error, ignore
			}
		}
		return result;
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Web Push Engine & Subscriptions Registry (RFC 8291 / 8292)
	// ═══════════════════════════════════════════════════════════════════════════

	async #dispatchPushNotifications(
		email: EmailData,
		explicitMailboxId?: string,
	): Promise<void> {
		try {
			// Determine clean mailboxId for access checks, client routing & the mark_read action
			let resolvedMailboxId = explicitMailboxId || "";
			if (!resolvedMailboxId && email.recipient) {
				const match = email.recipient.match(/<([^>]+)>/);
				if (match) {
					resolvedMailboxId = match[1].trim().toLowerCase();
				} else {
					resolvedMailboxId = email.recipient.split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase();
				}
			}
			if (!resolvedMailboxId || resolvedMailboxId === "default") {
				// Without a known mailbox we can't tell who may see this message, so tell nobody.
				return;
			}

			// Only devices owned by a user who can access this mailbox (members and admins) are notified.
			const authDO = this.env.MAILBOX.get(this.env.MAILBOX.idFromName("AUTH"));
			let allSubs: PushSubscriptionRecord[] = [];
			try {
				allSubs = await authDO.getPushTargetsForMailbox(resolvedMailboxId);
			} catch (authErr) {
				console.warn("Could not query AUTH DO subscriptions:", authErr);
				return;
			}

			if (allSubs.length === 0) return;

			const vapidKeys = await this.getVapidKeys();
			const subjectContact = this.env.VAPID_SUBJECT || "support@reflect.cloud";

			const senderDisplay = email.sender
				? email.sender.replace(/<.*>/, "").replace(/^["']|["']$/g, "").trim() || email.sender
				: "Someone";
			const cleanSubject = email.subject || "(No subject)";

			let preview = email.body || "";
			if (preview.includes("<") && preview.includes(">")) {
				preview = preview.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
			}
			if (preview.length > 120) {
				preview = preview.slice(0, 117) + "...";
			}

			const payload = {
				title: `New Email: ${senderDisplay}`,
				body: `${cleanSubject}\n${preview}`,
				icon: "/icons/icon-192.png",
				badge: "/icons/badge-72.png",
				tag: `email-${email.id}`,
				data: {
					emailId: email.id,
					mailboxId: resolvedMailboxId,
					url: `/mailbox/${encodeURIComponent(resolvedMailboxId)}/email/${email.id}`,
				},
				actions: [
					{ action: "open", title: "Open" },
					{ action: "mark_read", title: "Mark Read" },
				],
			};

			const sendPromises = allSubs.map(async (sub) => {
				const result = await sendWebPush(
					{
						endpoint: sub.endpoint,
						keys: {
							p256dh: sub.p256dh,
							auth: sub.auth,
						},
					},
					payload,
					vapidKeys,
					subjectContact,
				);

				if (!result.success && (result.statusCode === 404 || result.statusCode === 410)) {
					try {
						await authDO.purgePushEndpoint(sub.endpoint);
					} catch {}
				}
			});

			await Promise.allSettled(sendPromises);
		} catch (err) {
			console.error("Web Push dispatch error:", err);
		}
	}

	async getVapidKeys(): Promise<VapidKeys> {
		if (this.env.VAPID_PUBLIC_KEY && this.env.VAPID_PRIVATE_KEY) {
			return {
				publicKey: this.env.VAPID_PUBLIC_KEY,
				privateKey: this.env.VAPID_PRIVATE_KEY,
			};
		}

		if (this.#isAuthDO) {
			const stored = (await this.ctx.storage.get("vapid_keys")) as VapidKeys | undefined;
			if (stored && stored.publicKey && stored.privateKey) {
				return stored;
			}
			const generated = await generateVapidKeys();
			await this.ctx.storage.put("vapid_keys", generated);
			return generated;
		}

		const authDO = this.env.MAILBOX.get(this.env.MAILBOX.idFromName("AUTH"));
		return await authDO.getVapidKeys();
	}

	/** Max devices a single user can have registered; the oldest are dropped beyond this. */
	static readonly MAX_PUSH_SUBSCRIPTIONS_PER_USER = 20;

	#mapPushRow(r: any): PushSubscriptionRecord {
		return {
			id: String(r.id),
			endpoint: String(r.endpoint),
			p256dh: String(r.p256dh),
			auth: String(r.auth),
			user_agent: r.user_agent ? String(r.user_agent) : null,
			user_id: r.user_id ? String(r.user_id) : null,
			created_at: String(r.created_at),
		};
	}

	/**
	 * Registers (or re-owns) a device for `userId`. AUTH DO only. If the same browser is used by another
	 * account later, the endpoint moves to that account.
	 */
	async savePushSubscription(
		sub: {
			endpoint: string;
			p256dh: string;
			auth: string;
			userAgent?: string | null;
		},
		userId: string,
	): Promise<PushSubscriptionRecord> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		if (!userId) throw new Error("A user is required to register push notifications");

		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		this.ctx.storage.sql.exec(
			`INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_agent, user_id, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(endpoint) DO UPDATE SET
			   p256dh = excluded.p256dh,
			   auth = excluded.auth,
			   user_agent = excluded.user_agent,
			   user_id = excluded.user_id,
			   created_at = excluded.created_at`,
			id,
			sub.endpoint,
			sub.p256dh,
			sub.auth,
			sub.userAgent || null,
			userId,
			now,
		);

		this.ctx.storage.sql.exec(
			`DELETE FROM push_subscriptions
			 WHERE user_id = ?
			   AND id NOT IN (
			     SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
			   )`,
			userId,
			userId,
			MailboxDO.MAX_PUSH_SUBSCRIPTIONS_PER_USER,
		);

		return {
			id,
			endpoint: sub.endpoint,
			p256dh: sub.p256dh,
			auth: sub.auth,
			user_agent: sub.userAgent || null,
			user_id: userId,
			created_at: now,
		};
	}

	/** A user removing one of their own devices. Returns false if it isn't theirs / doesn't exist. */
	async deletePushSubscription(endpoint: string, userId: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const cursor = this.ctx.storage.sql.exec(
			"DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?",
			endpoint,
			userId,
		);
		return cursor.rowsWritten > 0;
	}

	/** Server-side cleanup of an endpoint the push service reported as gone (404 / 410). */
	async purgePushEndpoint(endpoint: string): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		this.ctx.storage.sql.exec("DELETE FROM push_subscriptions WHERE endpoint = ?", endpoint);
	}

	/** Devices belonging to admins and to users who are members of `mailboxId`. */
	async getPushTargetsForMailbox(mailboxId: string): Promise<PushSubscriptionRecord[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const rows = this.ctx.storage.sql
			.exec(
				`SELECT id, endpoint, p256dh, auth, user_agent, user_id, created_at
				 FROM push_subscriptions
				 WHERE user_id IS NOT NULL
				   AND (
				     user_id IN (SELECT id FROM users WHERE is_admin = 1)
				     OR user_id IN (SELECT user_id FROM user_mailboxes WHERE LOWER(mailbox_id) = LOWER(?))
				   )`,
				mailboxId,
			)
			.toArray();
		return rows.map((r) => this.#mapPushRow(r));
	}

	/** Sends a test notification to the calling user's own devices (optionally just one endpoint). */
	async sendTestNotification(
		userId: string,
		endpoint?: string,
	): Promise<{ success: boolean; sentCount: number; error?: string }> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		try {
			const rows = endpoint
				? this.ctx.storage.sql
						.exec(
							"SELECT id, endpoint, p256dh, auth, user_agent, user_id, created_at FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
							userId,
							endpoint,
						)
						.toArray()
				: this.ctx.storage.sql
						.exec(
							"SELECT id, endpoint, p256dh, auth, user_agent, user_id, created_at FROM push_subscriptions WHERE user_id = ?",
							userId,
						)
						.toArray();
			const targets = rows.map((r) => this.#mapPushRow(r));

			if (targets.length === 0) {
				return { success: false, sentCount: 0, error: "No matching push subscription found" };
			}

			const vapidKeys = await this.getVapidKeys();
			const subjectContact = this.env.VAPID_SUBJECT || "support@reflect.cloud";

			const payload = {
				title: "Reflect Mail — Test Notification",
				body: "Web Push notifications are live and fully operational on this device!",
				icon: "/icons/icon-192.png",
				badge: "/icons/badge-72.png",
				tag: "test-push",
				data: {
					url: "/",
				},
				actions: [
					{ action: "open", title: "Open Reflect Mail" },
				],
			};

			let sentCount = 0;
			for (const sub of targets) {
				const result = await sendWebPush(
					{
						endpoint: sub.endpoint,
						keys: {
							p256dh: sub.p256dh,
							auth: sub.auth,
						},
					},
					payload,
					vapidKeys,
					subjectContact,
				);
				if (result.success) {
					sentCount++;
				} else if (result.statusCode === 404 || result.statusCode === 410) {
					await this.purgePushEndpoint(sub.endpoint);
				}
			}

			return { success: sentCount > 0, sentCount };
		} catch (err: any) {
			return { success: false, sentCount: 0, error: err?.message || String(err) };
		}
	}

	// ---------------------------------------------------------------------------------------
	// Suppression list (AUTH DO) and bounce marking (mailbox DO)
	// ---------------------------------------------------------------------------------------

	/** Secret used to sign unsubscribe links. Generated once and kept in AUTH DO storage. */
	async getUnsubscribeSecret(): Promise<string> {
		if (!this.#isAuthDO) {
			const authDO = this.env.MAILBOX.get(this.env.MAILBOX.idFromName("AUTH"));
			return await authDO.getUnsubscribeSecret();
		}
		const stored = (await this.ctx.storage.get("unsubscribe_secret")) as string | undefined;
		if (stored) return stored;
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
		await this.ctx.storage.put("unsubscribe_secret", secret);
		return secret;
	}

	/** Adds an address to the suppression list. An existing entry is kept as-is. Returns true if new. */
	async addSuppression(
		email: string,
		reason: "bounce" | "unsubscribe" | "manual",
		detail?: string | null,
		sourceMailbox?: string | null,
	): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const cursor = this.ctx.storage.sql.exec(
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
		const cursor = this.ctx.storage.sql.exec(
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
		const rows = this.ctx.storage.sql
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

	/** Which of `emails` are on the list (lower-cased). */
	async checkSuppressions(
		emails: string[],
	): Promise<Array<{ email: string; reason: string; created_at: string }>> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const out: Array<{ email: string; reason: string; created_at: string }> = [];
		const unique = Array.from(new Set(emails.map((e) => e.toLowerCase()))).slice(0, 200);
		for (const email of unique) {
			const row = this.ctx.storage.sql
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

	/**
	 * Flags the most recent sent message to `address` as bounced. Returns false when this mailbox
	 * never wrote to that address, so a forged bounce can't put an arbitrary address on the list.
	 */
	async markBounced(address: string): Promise<boolean> {
		const addr = address.toLowerCase();
		const rows = this.ctx.storage.sql
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
		this.ctx.storage.sql.exec(
			"UPDATE emails SET delivery_status = 'bounced' WHERE id = ?",
			hit.id,
		);
		return true;
	}

	// ---------------------------------------------------------------------------------------
	// Shared templates (AUTH DO)
	// ---------------------------------------------------------------------------------------

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

	/** Lists templates. The built-in ones are written the first time, so they can be edited or deleted. */
	async listTemplates(): Promise<StoredTemplate[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const sql = this.ctx.storage.sql;
		const now = new Date().toISOString();
		if (!(await this.ctx.storage.get("templates_seeded"))) {
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
			await this.ctx.storage.put("templates_seeded", true);
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
		const sql = this.ctx.storage.sql;
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

	/** Reply templates only: the pitch can be reset but never deleted. */
	async deleteTemplate(id: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const cursor = this.ctx.storage.sql.exec(
			"DELETE FROM templates WHERE id = ? AND kind = 'reply'",
			id,
		);
		return cursor.rowsWritten > 0;
	}

	async resetPitchTemplate(): Promise<StoredTemplate> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const seed = DEFAULT_TEMPLATES.find((t) => t.id === PITCH_TEMPLATE_ID)!;
		const now = new Date().toISOString();
		this.ctx.storage.sql.exec(
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
			this.ctx.storage.sql.exec("SELECT * FROM templates WHERE id = ?", seed.id).toArray()[0],
		);
	}
}
