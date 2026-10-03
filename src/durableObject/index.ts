import { DurableObject } from "cloudflare:workers";
import { DOQB } from "workers-qb";
import type { AppBinding, DiscoverLead, Env, PushSubscriptionRecord, Session, User } from "../types";
import type { Chain } from "../outreach";
import { authMigrations, mailboxMigrations } from "./migrations";

import { AuthHandler } from "./auth";
import { FolderHandler } from "./folders";
import { ContactHandler } from "./contacts";
import { BindingsLeadsHandler } from "./bindings-leads";
import { PushHandler } from "./push";
import { SuppressionHandler } from "./suppression";
import {
	DEFAULT_FOLLOWUP_CONFIG,
	type FollowUpConfig,
	type StoredTemplate,
	TemplateHandler,
} from "./templates";
import { SchedulingHandler } from "./scheduling";
import {
	ALLOWED_SORT_COLUMNS,
	type EmailData,
	EmailHandler,
	type GetEmailsOptions,
	type SortColumn,
} from "./emails";

export {
	DEFAULT_FOLLOWUP_CONFIG,
	type FollowUpConfig,
	type StoredTemplate,
	ALLOWED_SORT_COLUMNS,
	type SortColumn,
	type GetEmailsOptions,
	type EmailData,
};

export class MailboxDO extends DurableObject<Env> {
	declare __DURABLE_OBJECT_BRAND: never;
	static readonly MAX_PUSH_SUBSCRIPTIONS_PER_USER = 20;

	#qb: DOQB;
	#isAuthDO: boolean;

	#auth: AuthHandler;
	#folders: FolderHandler;
	#contacts: ContactHandler;
	#bindingsLeads: BindingsLeadsHandler;
	#push: PushHandler;
	#suppression: SuppressionHandler;
	#scheduling: SchedulingHandler;
	#emails: EmailHandler;
	#templates: TemplateHandler;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.#qb = new DOQB(this.ctx.storage.sql);

		const authMarker = this.ctx.storage.sql
			.exec(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
			)
			.toArray();
		const hasAuthTables = authMarker.length > 0;

		const isFirstInit =
			this.ctx.storage.sql
				.exec(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'",
				)
				.toArray().length === 0;

		if (isFirstInit) {
			const testAuthId = env.MAILBOX.idFromName("AUTH");
			this.#isAuthDO = this.ctx.id.equals(testAuthId);
		} else {
			this.#isAuthDO = hasAuthTables;
		}

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

		// Initialize domain handlers
		this.#auth = new AuthHandler(this.#qb, this.#isAuthDO);
		this.#folders = new FolderHandler(this.ctx.storage.sql, this.#qb);
		this.#contacts = new ContactHandler(this.#qb);
		this.#bindingsLeads = new BindingsLeadsHandler(this.ctx.storage.sql, this.#isAuthDO);
		this.#push = new PushHandler(this.ctx.storage.sql, this.ctx.storage, this.env, this.#isAuthDO);
		this.#suppression = new SuppressionHandler(this.ctx.storage.sql, this.ctx.storage, this.env, this.#isAuthDO);
		this.#scheduling = new SchedulingHandler(
			this.ctx.storage.sql,
			this.ctx.storage,
			this.env,
			this.#isAuthDO,
			(p) => this.ctx.waitUntil(p),
		);
		this.#emails = new EmailHandler(
			this.ctx.storage.sql,
			this.#qb,
			this.#push,
			(p) => this.ctx.waitUntil(p),
		);
		this.#templates = new TemplateHandler(
			this.ctx.storage.sql,
			this.ctx.storage,
			this.env,
			this.#isAuthDO,
			(draftId, email, atts) => this.#emails.upsertDraft(draftId, email, atts),
		);
	}

	// Auth operations
	async hasUsers(): Promise<boolean> {
		return this.#auth.hasUsers();
	}

	async isAdmin(userId: string): Promise<boolean> {
		return this.#auth.isAdmin(userId);
	}

	async register(email: string, password: string, isFirstUser = false): Promise<User> {
		return this.#auth.register(email, password, isFirstUser);
	}

	async login(email: string, password: string): Promise<Session | null> {
		return this.#auth.login(email, password);
	}

	async validateSession(sessionId: string): Promise<Session | null> {
		return this.#auth.validateSession(sessionId);
	}

	async logout(sessionId: string): Promise<boolean> {
		return this.#auth.logout(sessionId);
	}

	async getUsers(): Promise<User[]> {
		return this.#auth.getUsers();
	}

	async getUserByEmail(email: string): Promise<User | null> {
		return this.#auth.getUserByEmail(email);
	}

	async updateUserPassword(userId: string, newPassword: string): Promise<void> {
		return this.#auth.updateUserPassword(userId, newPassword);
	}

	async grantMailboxAccess(userId: string, mailboxId: string, role: string): Promise<void> {
		return this.#auth.grantMailboxAccess(userId, mailboxId, role);
	}

	async revokeMailboxAccess(userId: string, mailboxId: string): Promise<void> {
		return this.#auth.revokeMailboxAccess(userId, mailboxId);
	}

	async getUserMailboxes(userId: string): Promise<Array<{ mailboxId: string; role: string }>> {
		return this.#auth.getUserMailboxes(userId);
	}

	// Email operations
	async getEmails(options: GetEmailsOptions = {}) {
		return this.#emails.getEmails(options);
	}

	async getEmail(id: string) {
		return this.#emails.getEmail(id);
	}

	async recordOpen(id: string) {
		return this.#emails.recordOpen(id);
	}

	async recordClick(id: string) {
		return this.#emails.recordClick(id);
	}

	async updateEmail(id: string, updates: { read?: boolean; starred?: boolean }) {
		return this.#emails.updateEmail(id, updates);
	}

	async deleteEmail(id: string) {
		return this.#emails.deleteEmail(id);
	}

	async getAttachment(id: string) {
		return this.#emails.getAttachment(id);
	}

	async moveEmail(id: string, folderId: string) {
		return this.#emails.moveEmail(id, folderId);
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
		return this.#emails.searchEmails(options);
	}

	async createEmail(folder: string, email: EmailData, attachments: any[], mailboxId?: string) {
		return this.#emails.createEmail(folder, email, attachments, mailboxId);
	}

	async upsertDraft(draftId: string, email: EmailData, attachments: any[]) {
		return this.#emails.upsertDraft(draftId, email, attachments);
	}

	async getThreadEmails(threadId: string) {
		return this.#emails.getThreadEmails(threadId);
	}

	// Folder operations
	async getFolders(): Promise<Array<{ id: string; name: string; unreadCount: number }>> {
		return this.#folders.getFolders();
	}

	async createFolder(id: string, name: string): Promise<{ id: string; name: string; unreadCount: number } | null> {
		return this.#folders.createFolder(id, name);
	}

	async updateFolder(id: string, name: string): Promise<{ id: string; name: string; unreadCount: number } | null> {
		return this.#folders.updateFolder(id, name);
	}

	async deleteFolder(id: string): Promise<boolean> {
		return this.#folders.deleteFolder(id);
	}

	// Contact operations
	async getContacts() {
		return this.#contacts.getContacts();
	}

	async createContact(contact: { name?: string; email: string }) {
		return this.#contacts.createContact(contact);
	}

	async updateContact(id: number, contact: { name?: string; email?: string }) {
		return this.#contacts.updateContact(id, contact);
	}

	async deleteContact(id: number): Promise<boolean> {
		return this.#contacts.deleteContact(id);
	}

	// App Bindings & Discover Leads
	async getAllAppBindings(): Promise<AppBinding[]> {
		return this.#bindingsLeads.getAllAppBindings();
	}

	async getAppBinding(email: string): Promise<AppBinding | null> {
		return this.#bindingsLeads.getAppBinding(email);
	}

	async setAppBinding(binding: {
		email: string;
		app_name: string;
		app_icon_url: string;
		app_url: string;
		platform: string;
		developer_name?: string | null;
	}): Promise<AppBinding> {
		return this.#bindingsLeads.setAppBinding(binding);
	}

	async deleteAppBinding(email: string): Promise<boolean> {
		return this.#bindingsLeads.deleteAppBinding(email);
	}

	async getAllDiscoverLeads(): Promise<DiscoverLead[]> {
		return this.#bindingsLeads.getAllDiscoverLeads();
	}

	async getDiscoverLead(id: string): Promise<DiscoverLead | null> {
		return this.#bindingsLeads.getDiscoverLead(id);
	}

	async setDiscoverLead(lead: any): Promise<DiscoverLead> {
		return this.#bindingsLeads.setDiscoverLead(lead);
	}

	async deleteDiscoverLead(id: string): Promise<boolean> {
		return this.#bindingsLeads.deleteDiscoverLead(id);
	}

	async getSentEmailRecipients(emails: string[]): Promise<Record<string, { sent: boolean; opened_count: number }>> {
		return this.#bindingsLeads.getSentEmailRecipients(emails);
	}

	// Push Notifications
	async getVapidKeys() {
		return this.#push.getVapidKeys();
	}

	async savePushSubscription(
		sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string | null },
		userId: string,
	): Promise<PushSubscriptionRecord> {
		return this.#push.savePushSubscription(sub, userId);
	}

	async deletePushSubscription(endpoint: string, userId: string): Promise<boolean> {
		return this.#push.deletePushSubscription(endpoint, userId);
	}

	async purgePushEndpoint(endpoint: string): Promise<void> {
		return this.#push.purgePushEndpoint(endpoint);
	}

	async getPushTargetsForMailbox(mailboxId: string): Promise<PushSubscriptionRecord[]> {
		return this.#push.getPushTargetsForMailbox(mailboxId);
	}

	async sendTestNotification(userId: string, endpoint?: string) {
		return this.#push.sendTestNotification(userId, endpoint);
	}

	// Suppression & Bounce
	async getUnsubscribeSecret(): Promise<string> {
		return this.#suppression.getUnsubscribeSecret();
	}

	async addSuppression(
		email: string,
		reason: "bounce" | "unsubscribe" | "manual",
		detail?: string | null,
		sourceMailbox?: string | null,
	): Promise<boolean> {
		return this.#suppression.addSuppression(email, reason, detail, sourceMailbox);
	}

	async removeSuppression(email: string): Promise<boolean> {
		return this.#suppression.removeSuppression(email);
	}

	async listSuppressions(limit = 500) {
		return this.#suppression.listSuppressions(limit);
	}

	async checkSuppressions(emails: string[]) {
		return this.#suppression.checkSuppressions(emails);
	}

	async markBounced(address: string): Promise<boolean> {
		return this.#suppression.markBounced(address);
	}

	// Templates & Follow-ups
	async listTemplates(): Promise<StoredTemplate[]> {
		return this.#templates.listTemplates();
	}

	async saveTemplate(
		template: { id?: string; kind: "reply" | "pitch"; name: string; subject: string | null; body: string },
		userEmail: string,
	): Promise<StoredTemplate | null> {
		return this.#templates.saveTemplate(template, userEmail);
	}

	async deleteTemplate(id: string): Promise<boolean> {
		return this.#templates.deleteTemplate(id);
	}

	async resetPitchTemplate(): Promise<StoredTemplate> {
		return this.#templates.resetPitchTemplate();
	}

	async getFollowUpConfig(): Promise<FollowUpConfig> {
		return this.#templates.getFollowUpConfig();
	}

	async setFollowUpConfig(patch: any): Promise<FollowUpConfig> {
		return this.#templates.setFollowUpConfig(patch);
	}

	async recordFollowUpRun(drafts: number): Promise<void> {
		return this.#templates.recordFollowUpRun(drafts);
	}

	async getOutreachChains(sinceIso: string): Promise<Chain[]> {
		return this.#templates.getOutreachChains(sinceIso);
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
		return this.#templates.createFollowUpDraft(draft);
	}

	async notifyFollowUps(mailboxId: string, count: number, firstRecipient: string): Promise<void> {
		return this.#templates.notifyFollowUps(mailboxId, count, firstRecipient);
	}

	// Snooze, Scheduling & Alarms
	async snoozeEmail(id: string, untilIso: string | null, mailboxId: string): Promise<boolean> {
		return this.#scheduling.snoozeEmail(id, untilIso, mailboxId);
	}

	async scheduleDraft(id: string, sendAtIso: string | null, mailboxId: string): Promise<boolean> {
		return this.#scheduling.scheduleDraft(id, sendAtIso, mailboxId);
	}

	async getQueueSummary(): Promise<{ snoozed: number; scheduled: number; next_wake: string | null }> {
		return this.#scheduling.getQueueSummary();
	}

	async sendScheduledNow(id: string, mailboxId: string): Promise<{ ok: boolean; error?: string }> {
		return this.#scheduling.sendScheduledNow(id, mailboxId);
	}

	async alarm(): Promise<void> {
		return this.#scheduling.alarm();
	}

	async runDue(): Promise<{ woke: number; sent: number; failed: number }> {
		return this.#scheduling.runDue();
	}
}
