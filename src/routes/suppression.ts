import type { Hono } from "hono";
import {
	normalizeEmail,
	renderUnsubscribePage,
	verifyUnsubscribeToken,
} from "../suppression";
import type { Env, Session } from "../types";

type App = Hono<{ Bindings: Env; Variables: { session?: Session } }>;

const html = (body: string, status = 200) =>
	new Response(body, {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Robots-Tag": "noindex",
			"Referrer-Policy": "no-referrer",
		},
	});

const authStub = (env: Env) => env.MAILBOX.get(env.MAILBOX.idFromName("AUTH"));

/**
 * Public routes (the recipient's mail client / browser calls these; no login):
 *   GET  /api/v1/unsubscribe/:token  confirmation page. It never unsubscribes by itself, because mail
 *                                    scanners and link previewers fetch URLs automatically.
 *   POST /api/v1/unsubscribe/:token  performs the unsubscribe (also the RFC 8058 one-click target).
 *
 * Authenticated routes (session required; they are not in isPublicRoute):
 *   GET    /api/v1/suppressions
 *   POST   /api/v1/suppressions          { email, detail? }  manual entry
 *   DELETE /api/v1/suppressions/:email   admin only
 *   POST   /api/v1/suppressions/check    { emails: string[] }
 */
export function registerSuppressionRoutes(app: App) {
	app.get("/api/v1/unsubscribe/:token", async (c) => {
		const secret = await authStub(c.env).getUnsubscribeSecret();
		const claim = await verifyUnsubscribeToken(secret, c.req.param("token"));
		if (!claim) return html(renderUnsubscribePage({ state: "invalid" }), 400);
		return html(renderUnsubscribePage({ state: "confirm", email: claim.email }));
	});

	app.post("/api/v1/unsubscribe/:token", async (c) => {
		const auth = authStub(c.env);
		const claim = await verifyUnsubscribeToken(
			await auth.getUnsubscribeSecret(),
			c.req.param("token"),
		);
		if (!claim) return html(renderUnsubscribePage({ state: "invalid" }), 400);
		await auth.addSuppression(
			claim.email,
			"unsubscribe",
			"Recipient used the unsubscribe link",
			claim.mailboxId,
		);
		return html(renderUnsubscribePage({ state: "done", email: claim.email }));
	});

	app.get("/api/v1/suppressions", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		return c.json({ suppressions: await authStub(c.env).listSuppressions(1000) });
	});

	app.post("/api/v1/suppressions", async (c) => {
		const session = c.get("session");
		if (!session) return c.json({ error: "Unauthorized" }, 401);
		const body = (await c.req.json().catch(() => ({}))) as { email?: string; detail?: string };
		const email = normalizeEmail(body.email || "");
		if (!email) return c.json({ error: "A valid email address is required" }, 400);
		const added = await authStub(c.env).addSuppression(
			email,
			"manual",
			body.detail?.trim() || `Added by ${session.email}`,
			null,
		);
		return c.json({ email, added }, added ? 201 : 200);
	});

	app.post("/api/v1/suppressions/check", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		const body = (await c.req.json().catch(() => ({}))) as { emails?: unknown };
		const emails = (Array.isArray(body.emails) ? body.emails : [])
			.map((e) => normalizeEmail(String(e)))
			.filter((e): e is string => !!e);
		return c.json({ suppressed: await authStub(c.env).checkSuppressions(emails) });
	});

	app.delete("/api/v1/suppressions/:email", async (c) => {
		const session = c.get("session");
		if (!session) return c.json({ error: "Unauthorized" }, 401);
		if (!session.isAdmin) return c.json({ error: "Only an admin can remove entries" }, 403);
		const email = normalizeEmail(decodeURIComponent(c.req.param("email")));
		if (!email) return c.json({ error: "Invalid email address" }, 400);
		const removed = await authStub(c.env).removeSuppression(email);
		return c.json({ email, removed });
	});
}
