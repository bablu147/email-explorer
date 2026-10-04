import { fromHono } from "chanfana";
import { type Context, Hono } from "hono";
import { registerFollowUpRoutes, runFollowUps } from "./routes/followups";
import { registerSchedulingRoutes, runDueAcrossMailboxes } from "./routes/scheduling";
import { registerSuppressionRoutes } from "./routes/suppression";
import { registerTemplateRoutes } from "./routes/templates";
import { isHttpUrl, renderLeavingPage, verifyClickLink } from "./suppression";
import { injectEmailTracking } from "./tracking";
import { type InboundEmailEvent, receiveEmail } from "./inbound";

import {
	checkCookieRequest,
	checkJsonBody,
	clientIpKey,
	CREDENTIAL_PATHS,
	decideMailboxAccess,
	MAILBOX_REFUSALS,
	roleForMailbox,
} from "./access";
import { type PresentedToken, readSessionTokens } from "./session-cookie";

import {
	DeleteUser,
	GetMe,
	GetUsers,
	PostAdminRegister,
	PostChangePassword,
	PostGrantAccess,
	PostLogin,
	PostLogout,
	PostRegister,
	PostRevokeAccess,
	PostRevokeUserSessions,
	PutUser,
} from "./routes/auth";
import {
	DeleteAppBinding,
	GetAppBindingByEmail,
	GetAppBindings,
	GetAppLookup,
	PostAppBinding,
} from "./routes/app-bindings";
import {
	DeleteDiscoverLead,
	GetDiscoverApps,
	GetDiscoverLeads,
	PostDiscoverLead,
} from "./routes/discover";
import { PostForwardEmail, PostReplyEmail } from "./routes/reply-forward";
import {
	GetVapidPublicKey,
	PostSubscribePush,
	PostTestPush,
	PostUnsubscribePush,
} from "./routes/push";
import {
	GetFolders,
	PostFolder,
	PutFolder,
	DeleteFolder,
} from "./routes/folders";
import {
	GetContacts,
	PostContact,
	PutContact,
	DeleteContact,
} from "./routes/contacts";
import {
	GetMailboxes,
	GetMailbox,
	PutMailbox,
	DeleteMailbox,
	PostMailbox,
	PostForgotPassword,
	PostResetPassword,
	GetAppSettings,
} from "./routes/mailboxes";
import {
	base64ToBytes,
	GetEmails,
	PostEmail,
	GetEmail,
	GetThreadEmails,
	PutEmail,
	DeleteEmail,
	PostMoveEmail,
	GetAttachment,
	GetSearch,
} from "./routes/emails";

import type { EmailExplorerOptions, Env, Session } from "./types";

export { injectEmailTracking, base64ToBytes };
export { MailboxDO } from "./durableObject";

function jsonResponse(
	body: unknown,
	status: number,
	headers: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

// `via` is how the valid token arrived. A cookie is attached by the browser on its own, so only
// cookie-authenticated requests get the cross-site checks.
type Authenticated = { session: Session; via: PresentedToken["via"] };

// Tries each token the request presents, in order, and returns the first valid session. A tab
// still running the previous dashboard build sends "Authorization: Bearer undefined" once it has
// signed in again, and has to fall through to its cookie.
//
// null means there is no valid session. "unavailable" means no token was valid and at least one
// could not be checked at all. The two are kept apart because the dashboard answers a 401 by
// signing the user out, which a storage error must not cause.
async function authenticate(
	request: Request,
	env: Env,
): Promise<Authenticated | "unavailable" | null> {
	const tokens = readSessionTokens(request);
	if (tokens.length === 0) return null;

	const authId = env.MAILBOX.idFromName("AUTH");
	const authDO = env.MAILBOX.get(authId);

	let unchecked = false;
	for (const { token, via } of tokens) {
		try {
			const session = await authDO.validateSession(token);
			if (session) return { session, via };
		} catch (err) {
			console.error("Session check failed:", err);
			unchecked = true;
		}
	}
	return unchecked ? "unavailable" : null;
}

// Helper function to check if route is public
function isPublicRoute(pathname: string): boolean {
	const publicRoutes = [
		"/api/v1/auth/register",
		"/api/v1/auth/login",
		"/api/v1/auth/forgot-password",
		"/api/v1/auth/reset-password",
		"/api/v1/settings",
		"/api/docs",
		"/api/openapi.json",
		"/api/v1/track/",
		"/api/v1/unsubscribe/",
	];
	return publicRoutes.some((route) => pathname.startsWith(route));
}

// Helper function to check if route requires session (auth routes)
function requiresSession(pathname: string): boolean {
	const authRoutes = [
		"/api/v1/auth/me",
		"/api/v1/auth/logout",
		"/api/v1/auth/change-password",
		"/api/v1/auth/admin",
	];
	return authRoutes.some((route) => pathname.startsWith(route));
}

const app = new Hono<{ Bindings: Env; Variables: { session?: Session } }>();

// Credential endpoints: a ceiling per client IP, checked before the route looks at a password.
// Registered on the route's own method and path, ahead of the route, so it runs for exactly the
// requests the route answers. The binding is optional, and a limiter that fails lets the request
// through: a broken limiter must not stop everyone from signing in.
for (const path of CREDENTIAL_PATHS) {
	app.post(path, async (c, next) => {
		// Sign-in is public, so the cookie checks in the gate never see it. Without this, a form on
		// another site could sign the visitor into an account of that site's choosing. Refused before
		// the limiter, so such a page cannot use up the visitor's attempts either.
		const refusal = checkJsonBody(c.req.raw.headers);
		if (refusal) {
			return jsonResponse({ error: refusal.error }, refusal.status);
		}

		let allowed = true;
		try {
			const outcome = await c.env.AUTH_RATE_LIMITER?.limit({
				key: clientIpKey(c.req.raw.headers),
			});
			allowed = outcome?.success !== false;
		} catch (err) {
			console.error("Auth rate limiter failed:", err);
		}
		if (!allowed) {
			return c.json(
				{ error: "Too many attempts. Try again in a minute.", retry_after_seconds: 60 },
				429,
				{ "Retry-After": "60" },
			);
		}
		await next();
	});
}

// Transparent 1x1 GIF for open tracking
const TRANSPARENT_GIF_BYTES = Uint8Array.from(
	atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
	(c) => c.charCodeAt(0),
);

app.get("/api/v1/track/open/:mailboxId/:emailId", async (c) => {
	const rawMailboxId = c.req.param("mailboxId");
	const mailboxId = decodeURIComponent(rawMailboxId);
	const emailId = c.req.param("emailId");
	try {
		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);
		await stub.recordOpen(emailId);
	} catch (e) {
		// Suppress tracking errors so the recipient image load never fails
	}
	return new Response(TRANSPARENT_GIF_BYTES, {
		status: 200,
		headers: {
			"Content-Type": "image/gif",
			"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
			"Pragma": "no-cache",
			"Expires": "0",
			"Access-Control-Allow-Origin": "*",
			"Timing-Allow-Origin": "*",
			"Surrogate-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
});

app.get("/api/v1/track/click/:mailboxId/:emailId", async (c) => {
	const rawMailboxId = c.req.param("mailboxId");
	const mailboxId = decodeURIComponent(rawMailboxId);
	const emailId = c.req.param("emailId");
	const targetUrl = c.req.query("url");
	const sig = c.req.query("s") ?? "";
	const fallback = "https://reflect.cloud";
	if (!isHttpUrl(targetUrl)) return c.redirect(fallback, 302);

	let secret: string;
	try {
		secret = await c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH")).getUnsubscribeSecret();
	} catch {
		return c.redirect(fallback, 302);
	}

	const recordClick = async () => {
		try {
			await c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId)).recordClick(emailId);
		} catch {
			// Ignore recording failure, still redirect user
		}
	};

	if (sig) {
		// A signature that does not match means the link was altered: never redirect to it.
		if (!(await verifyClickLink(secret, mailboxId, emailId, targetUrl, sig))) {
			return c.redirect(fallback, 302);
		}
		await recordClick();
		return c.redirect(targetUrl, 302);
	}

	// Links sent before signing existed carry no signature and cannot be trusted, so the
	// visitor sees the destination and confirms instead of being redirected.
	await recordClick();
	return c.html(renderLeavingPage(targetUrl), 200, {
		"Cache-Control": "no-store",
		"Referrer-Policy": "no-referrer",
	});
});

registerSuppressionRoutes(app);
registerTemplateRoutes(app);
registerFollowUpRoutes(app);
registerSchedulingRoutes(app);

const openapi = fromHono(app);

// Auth endpoints
openapi.post("/api/v1/auth/register", PostRegister);
openapi.post("/api/v1/auth/login", PostLogin);
openapi.post("/api/v1/auth/logout", PostLogout);
openapi.get("/api/v1/auth/me", GetMe);
openapi.post("/api/v1/auth/change-password", PostChangePassword);
openapi.post("/api/v1/auth/forgot-password", PostForgotPassword);
openapi.post("/api/v1/auth/reset-password", PostResetPassword);
openapi.post("/api/v1/auth/admin/register", PostAdminRegister);
openapi.get("/api/v1/auth/admin/users", GetUsers);
openapi.put("/api/v1/auth/admin/users/:userId", PutUser);
openapi.delete("/api/v1/auth/admin/users/:userId", DeleteUser);
openapi.post("/api/v1/auth/admin/users/:userId/revoke-sessions", PostRevokeUserSessions);
openapi.post("/api/v1/auth/admin/grant-access", PostGrantAccess);
openapi.post("/api/v1/auth/admin/revoke-access", PostRevokeAccess);

// Settings endpoints
openapi.get("/api/v1/settings", GetAppSettings);

// App Bindings endpoints
openapi.get("/api/v1/app-bindings", GetAppBindings);
openapi.get("/api/v1/app-bindings/:email", GetAppBindingByEmail);
openapi.post("/api/v1/app-bindings", PostAppBinding);
openapi.delete("/api/v1/app-bindings/:email", DeleteAppBinding);
openapi.get("/api/v1/app-lookup", GetAppLookup);

// App Discovery & MMP Outreach endpoints
openapi.get("/api/v1/discover/apps", GetDiscoverApps);
openapi.get("/api/v1/discover/leads", GetDiscoverLeads);
openapi.post("/api/v1/discover/leads", PostDiscoverLead);
openapi.delete("/api/v1/discover/leads/:id", DeleteDiscoverLead);

// Web Push Notifications endpoints (supported with and without /v1)
openapi.get("/api/v1/push/vapid-public-key", GetVapidPublicKey);
openapi.post("/api/v1/push/subscribe", PostSubscribePush);
openapi.post("/api/v1/push/unsubscribe", PostUnsubscribePush);
openapi.post("/api/v1/push/test", PostTestPush);

openapi.get("/api/push/vapid-public-key", GetVapidPublicKey);
openapi.post("/api/push/subscribe", PostSubscribePush);
openapi.post("/api/push/unsubscribe", PostUnsubscribePush);
openapi.post("/api/push/test", PostTestPush);

// Mailbox & Email endpoints
openapi.get("/api/v1/mailboxes", GetMailboxes);
openapi.post("/api/v1/mailboxes", PostMailbox);
openapi.get("/api/v1/mailboxes/:mailboxId", GetMailbox);
openapi.put("/api/v1/mailboxes/:mailboxId", PutMailbox);
openapi.delete("/api/v1/mailboxes/:mailboxId", DeleteMailbox);
openapi.get("/api/v1/mailboxes/:mailboxId/emails", GetEmails);
openapi.post("/api/v1/mailboxes/:mailboxId/emails", PostEmail);
openapi.get("/api/v1/mailboxes/:mailboxId/emails/:id", GetEmail);
openapi.get("/api/v1/mailboxes/:mailboxId/threads/:threadId", GetThreadEmails);
openapi.put("/api/v1/mailboxes/:mailboxId/emails/:id", PutEmail);
openapi.delete("/api/v1/mailboxes/:mailboxId/emails/:id", DeleteEmail);
openapi.post("/api/v1/mailboxes/:mailboxId/emails/:id/move", PostMoveEmail);
openapi.post("/api/v1/mailboxes/:mailboxId/emails/:id/reply", PostReplyEmail);
openapi.post(
	"/api/v1/mailboxes/:mailboxId/emails/:id/forward",
	PostForwardEmail,
);
openapi.get("/api/v1/mailboxes/:mailboxId/folders", GetFolders);
openapi.post("/api/v1/mailboxes/:mailboxId/folders", PostFolder);
openapi.put("/api/v1/mailboxes/:mailboxId/folders/:id", PutFolder);
openapi.delete("/api/v1/mailboxes/:mailboxId/folders/:id", DeleteFolder);
openapi.get("/api/v1/mailboxes/:mailboxId/contacts", GetContacts);
openapi.post("/api/v1/mailboxes/:mailboxId/contacts", PostContact);
openapi.put("/api/v1/mailboxes/:mailboxId/contacts/:id", PutContact);
openapi.delete("/api/v1/mailboxes/:mailboxId/contacts/:id", DeleteContact);
openapi.get("/api/v1/mailboxes/:mailboxId/search", GetSearch);
openapi.get(
	"/api/v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId",
	GetAttachment,
);

const defaultOptions: EmailExplorerOptions = {
	auth: {
		enabled: true, // Auth is enabled by default for security
		registerEnabled: undefined, // Smart mode: first user becomes admin, then registration closes
	},
};

export function EmailExplorer(_options: EmailExplorerOptions = {}) {
	// Merge user options with defaults
	const options: EmailExplorerOptions = {
		...defaultOptions,
		auth: {
			...defaultOptions.auth,
			..._options.auth,
		},
	};

	return {
		async email(
			event: InboundEmailEvent,
			env: Env,
			context: ExecutionContext,
		) {
			await receiveEmail(event, env, context);
		},
		/** Cron: prepares follow-up drafts and runs due queue items across mailboxes. */
		async scheduled(_event: unknown, env: Env, context: ExecutionContext) {
			context.waitUntil(
				Promise.allSettled([
					runFollowUps(env).catch((err) => console.error("Scheduled follow-ups failed:", err)),
					runDueAcrossMailboxes(env).catch((err) => console.error("Scheduled mail queue check failed:", err)),
				]),
			);
		},
		async fetch(request: Request, env: Env, context: ExecutionContext) {
			// Make options available to routes via env
			env.config = options;

			// Create a new request with context for middleware
			const url = new URL(request.url);

			// Check if auth is required (either globally enabled or auth-specific routes)
			// Auth is enforced by default (when enabled is undefined) unless explicitly disabled
			const needsAuth =
				(options.auth?.enabled !== false && !isPublicRoute(url.pathname)) ||
				requiresSession(url.pathname);

			if (needsAuth) {
				const auth = await authenticate(request, env);
				if (auth === "unavailable") {
					return jsonResponse({ error: "Temporarily unavailable. Try again." }, 503);
				}
				if (!auth) {
					return jsonResponse({ error: "Unauthorized" }, 401);
				}
				const { session, via } = auth;

				if (via === "cookie") {
					const refusal = checkCookieRequest(request.method, request.url, request.headers);
					if (refusal) {
						return jsonResponse({ error: refusal.error }, refusal.status);
					}
				}

				// Create new Hono app with session in context
				const authApp = new Hono<{
					Bindings: Env;
					Variables: { session?: Session };
				}>();

				// Middleware to inject session
				authApp.use("*", async (c, next) => {
					c.set("session", session);
					await next();
				});

				// Middleware to check mailbox access for non-admin users: a grant must exist, and its
				// role must allow this method on this path.
				const checkMailboxAccess = async (c: any, next: any) => {
					if (session.isAdmin) {
						await next();
						return;
					}
					const mailboxId = c.req.param("mailboxId");
					if (!mailboxId) {
						await next();
						return;
					}
					const authId = env.MAILBOX.idFromName("AUTH");
					const authDO = env.MAILBOX.get(authId);
					const userMailboxes = await authDO.getUserMailboxes(session.userId);
					const role = roleForMailbox(userMailboxes, mailboxId);
					if (!role) {
						return c.json(
							{ error: "You don't have access to this mailbox" },
							403,
						);
					}
					const decision = decideMailboxAccess(role, c.req.method, c.req.path);
					if (decision !== "allowed") {
						return c.json(
							{ error: MAILBOX_REFUSALS[decision], code: decision },
							403,
						);
					}
					await next();
				};
				authApp.use("/api/v1/mailboxes/:mailboxId", checkMailboxAccess);
				authApp.use("/api/v1/mailboxes/:mailboxId/*", checkMailboxAccess);

				// Mount the main app
				authApp.route("/", app);

				return authApp.fetch(request, env, context);
			}

			return app.fetch(request, env, context);
		},
	};
}
