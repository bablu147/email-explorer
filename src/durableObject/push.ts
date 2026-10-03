import { generateVapidKeys, sendWebPush, type VapidKeys } from "../push-crypto";
import type { EmailData, Env, PushSubscriptionRecord } from "../types";

export class PushHandler {
	#sql: SqlStorage;
	#storage: DurableObjectStorage;
	#env: Env;
	#isAuthDO: boolean;

	static readonly MAX_PUSH_SUBSCRIPTIONS_PER_USER = 20;

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

	async dispatchPushNotifications(
		email: EmailData,
		explicitMailboxId?: string,
	): Promise<void> {
		try {
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
				return;
			}

			const authDO = this.#env.MAILBOX.get(this.#env.MAILBOX.idFromName("AUTH"));
			let allSubs: PushSubscriptionRecord[] = [];
			try {
				allSubs = await authDO.getPushTargetsForMailbox(resolvedMailboxId);
			} catch (authErr) {
				console.warn("Could not query AUTH DO subscriptions:", authErr);
				return;
			}

			if (allSubs.length === 0) return;

			const vapidKeys = await this.getVapidKeys();
			const subjectContact = this.#env.VAPID_SUBJECT || "support@reflect.cloud";

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
		if (this.#env.VAPID_PUBLIC_KEY && this.#env.VAPID_PRIVATE_KEY) {
			return {
				publicKey: this.#env.VAPID_PUBLIC_KEY,
				privateKey: this.#env.VAPID_PRIVATE_KEY,
			};
		}

		if (this.#isAuthDO) {
			const stored = (await this.#storage.get("vapid_keys")) as VapidKeys | undefined;
			if (stored && stored.publicKey && stored.privateKey) {
				return stored;
			}
			const generated = await generateVapidKeys();
			await this.#storage.put("vapid_keys", generated);
			return generated;
		}

		const authDO = this.#env.MAILBOX.get(this.#env.MAILBOX.idFromName("AUTH"));
		return await authDO.getVapidKeys();
	}

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

		this.#sql.exec(
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

		this.#sql.exec(
			`DELETE FROM push_subscriptions
			 WHERE user_id = ?
			   AND id NOT IN (
			     SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
			   )`,
			userId,
			userId,
			PushHandler.MAX_PUSH_SUBSCRIPTIONS_PER_USER,
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

	async deletePushSubscription(endpoint: string, userId: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const cursor = this.#sql.exec(
			"DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?",
			endpoint,
			userId,
		);
		return cursor.rowsWritten > 0;
	}

	async purgePushEndpoint(endpoint: string): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		this.#sql.exec("DELETE FROM push_subscriptions WHERE endpoint = ?", endpoint);
	}

	async getPushTargetsForMailbox(mailboxId: string): Promise<PushSubscriptionRecord[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const rows = this.#sql
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

	async sendTestNotification(
		userId: string,
		endpoint?: string,
	): Promise<{ success: boolean; sentCount: number; error?: string }> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		try {
			const rows = endpoint
				? this.#sql
						.exec(
							"SELECT id, endpoint, p256dh, auth, user_agent, user_id, created_at FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
							userId,
							endpoint,
						)
						.toArray()
				: this.#sql
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
			const subjectContact = this.#env.VAPID_SUBJECT || "support@reflect.cloud";

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
}
