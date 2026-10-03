import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import type { Env, Session } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

// Schemas
export const VapidPublicKeyResponseSchema = z.object({
	publicKey: z.string(),
});

export const PushSubscriptionKeysSchema = z.object({
	p256dh: z.string(),
	auth: z.string(),
});

export const SubscribePushRequestSchema = z.object({
	endpoint: z.string().url(),
	keys: PushSubscriptionKeysSchema,
	mailboxId: z.string().optional(),
	userAgent: z.string().optional(),
});

export const UnsubscribePushRequestSchema = z.object({
	endpoint: z.string().url(),
	mailboxId: z.string().optional(),
});

export const TestPushRequestSchema = z.object({
	endpoint: z.string().url().optional(),
	mailboxId: z.string().optional(),
});

export const PushSuccessResponseSchema = z.object({
	success: z.boolean(),
	message: z.string().optional(),
	sentCount: z.number().optional(),
	error: z.string().optional(),
});

export class GetVapidPublicKey extends OpenAPIRoute {
	schema = {
		summary: "Get VAPID public key for Web Push",
		operationId: "getVapidPublicKey",
		tags: ["Push Notifications"],
		responses: {
			"200": {
				description: "VAPID Application Server Public Key",
				...contentJson(VapidPublicKeyResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const authDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH"));
		const vapidKeys = await authDO.getVapidKeys();
		return c.json({ publicKey: vapidKeys.publicKey });
	}
}

export class PostSubscribePush extends OpenAPIRoute {
	schema = {
		summary: "Register a Web Push subscription",
		operationId: "subscribePush",
		tags: ["Push Notifications"],
		request: {
			body: contentJson(SubscribePushRequestSchema),
		},
		responses: {
			"200": {
				description: "Subscription registered successfully",
				...contentJson(PushSuccessResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { endpoint, keys, mailboxId, userAgent } = data.body;
		const ua = userAgent || c.req.header("user-agent") || null;

		// Always register on Auth DO as central registry
		const authDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH"));
		await authDO.savePushSubscription({
			endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth,
			userAgent: ua,
		});

		// If a specific mailboxId is given, also register on that mailbox DO
		if (mailboxId) {
			const mailboxDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
			await mailboxDO.savePushSubscription({
				endpoint,
				p256dh: keys.p256dh,
				auth: keys.auth,
				userAgent: ua,
			});
		}

		return c.json({
			success: true,
			message: "Push subscription registered successfully",
		});
	}
}

export class PostUnsubscribePush extends OpenAPIRoute {
	schema = {
		summary: "Unregister a Web Push subscription",
		operationId: "unsubscribePush",
		tags: ["Push Notifications"],
		request: {
			body: contentJson(UnsubscribePushRequestSchema),
		},
		responses: {
			"200": {
				description: "Subscription unregistered successfully",
				...contentJson(PushSuccessResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { endpoint, mailboxId } = data.body;

		const authDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH"));
		await authDO.deletePushSubscription(endpoint);

		if (mailboxId) {
			const mailboxDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
			await mailboxDO.deletePushSubscription(endpoint);
		}

		return c.json({
			success: true,
			message: "Push subscription unregistered successfully",
		});
	}
}

export class PostTestPush extends OpenAPIRoute {
	schema = {
		summary: "Send a test Web Push notification to current subscriptions",
		operationId: "testPush",
		tags: ["Push Notifications"],
		request: {
			body: contentJson(TestPushRequestSchema),
		},
		responses: {
			"200": {
				description: "Test notification dispatched",
				...contentJson(PushSuccessResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { endpoint, mailboxId } = data.body;

		let result: { success: boolean; sentCount: number; error?: string } = {
			success: false,
			sentCount: 0,
		};

		if (mailboxId) {
			const mailboxDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
			result = await mailboxDO.sendTestNotification(endpoint);
		}

		// Fallback to Auth DO registry if mailbox didn't send or wasn't specified
		if (!result.success || result.sentCount === 0) {
			const authDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH"));
			const authResult = await authDO.sendTestNotification(endpoint);
			if (authResult.sentCount > 0) {
				result = authResult;
			}
		}

		return c.json({
			success: result.success,
			sentCount: result.sentCount,
			message: result.success
				? `Dispatched test push to ${result.sentCount} subscription(s)`
				: result.error || "No active push subscriptions found to dispatch to",
			error: result.error,
		});
	}
}
