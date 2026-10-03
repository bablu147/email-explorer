import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import type { Env, Session } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

/**
 * Browser push services. A subscription endpoint is a URL this server will POST to, so only the
 * real push gateways are accepted (Chrome/Edge/Brave/Samsung via FCM, Firefox, Safari, Windows).
 */
const PUSH_SERVICE_HOST_SUFFIXES = [
	"fcm.googleapis.com",
	"android.googleapis.com",
	"push.services.mozilla.com",
	"push.apple.com",
	"notify.windows.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return false;
	}
	if (url.protocol !== "https:" || url.username || url.password) return false;
	const host = url.hostname.toLowerCase();
	return PUSH_SERVICE_HOST_SUFFIXES.some(
		(suffix) => host === suffix || host.endsWith(`.${suffix}`),
	);
}

const unauthorized = (c: AppContext) =>
	c.json({ success: false, error: "Unauthorized" }, 401);

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
	/** Accepted for older clients; subscriptions are per user, not per mailbox. */
	mailboxId: z.string().optional(),
	userAgent: z.string().optional(),
});

export const UnsubscribePushRequestSchema = z.object({
	endpoint: z.string().url(),
	/** Accepted for older clients; ignored. */
	mailboxId: z.string().optional(),
});

export const TestPushRequestSchema = z.object({
	endpoint: z.string().url().optional(),
	/** Accepted for older clients; ignored. */
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
		if (!c.get("session")) return unauthorized(c);
		const authDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH"));
		const vapidKeys = await authDO.getVapidKeys();
		return c.json({ publicKey: vapidKeys.publicKey });
	}
}

export class PostSubscribePush extends OpenAPIRoute {
	schema = {
		summary: "Register a Web Push subscription for the signed-in user",
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
		const session = c.get("session");
		if (!session) return unauthorized(c);

		const data = await this.getValidatedData<typeof this.schema>();
		const { endpoint, keys, userAgent } = data.body;

		if (!isAllowedPushEndpoint(endpoint)) {
			return c.json(
				{ success: false, error: "Unsupported push service endpoint" },
				400,
			);
		}

		const ua = (userAgent || c.req.header("user-agent") || "").slice(0, 300) || null;

		const authDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH"));
		await authDO.savePushSubscription(
			{ endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua },
			session.userId,
		);

		return c.json({
			success: true,
			message: "Push subscription registered successfully",
		});
	}
}

export class PostUnsubscribePush extends OpenAPIRoute {
	schema = {
		summary: "Unregister one of the signed-in user's Web Push subscriptions",
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
		const session = c.get("session");
		if (!session) return unauthorized(c);

		const data = await this.getValidatedData<typeof this.schema>();
		const { endpoint } = data.body;

		const authDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH"));
		await authDO.deletePushSubscription(endpoint, session.userId);

		return c.json({
			success: true,
			message: "Push subscription unregistered successfully",
		});
	}
}

export class PostTestPush extends OpenAPIRoute {
	schema = {
		summary: "Send a test Web Push notification to the signed-in user's devices",
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
		const session = c.get("session");
		if (!session) return unauthorized(c);

		const data = await this.getValidatedData<typeof this.schema>();
		const { endpoint } = data.body;

		const authDO = c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH"));
		const result = await authDO.sendTestNotification(session.userId, endpoint);

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
