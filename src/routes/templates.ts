import type { Hono } from "hono";
import { PITCH_TEMPLATE_ID, validateTemplateInput } from "../templates";
import type { Env, Session } from "../types";

type App = Hono<{ Bindings: Env; Variables: { session?: Session } }>;

const authStub = (env: Env) => env.MAILBOX.get(env.MAILBOX.idFromName("AUTH"));

/**
 * Shared template library (all routes need a login):
 *   GET    /api/v1/templates
 *   POST   /api/v1/templates                  { name, body }            new reply template
 *   PUT    /api/v1/templates/:id              { name, body, subject? }  edit (the pitch: admin only)
 *   DELETE /api/v1/templates/:id              reply templates only
 *   POST   /api/v1/templates/pitch/reset      admin only; restores the built-in pitch
 */
export function registerTemplateRoutes(app: App) {
	app.get("/api/v1/templates", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		return c.json({ templates: await authStub(c.env).listTemplates() });
	});

	app.post("/api/v1/templates", async (c) => {
		const session = c.get("session");
		if (!session) return c.json({ error: "Unauthorized" }, 401);
		const input = validateTemplateInput(await c.req.json().catch(() => ({})), "reply");
		if ("error" in input) return c.json({ error: input.error }, 400);
		try {
			const template = await authStub(c.env).saveTemplate(
				{ kind: "reply", name: input.name, subject: null, body: input.body },
				session.email,
			);
			return c.json({ template }, 201);
		} catch (err) {
			return c.json({ error: (err as Error).message }, 400);
		}
	});

	app.put("/api/v1/templates/:id", async (c) => {
		const session = c.get("session");
		if (!session) return c.json({ error: "Unauthorized" }, 401);
		const id = c.req.param("id");
		const isPitch = id === PITCH_TEMPLATE_ID;
		if (isPitch && !session.isAdmin) {
			return c.json({ error: "Only an admin can edit the outreach pitch" }, 403);
		}
		const input = validateTemplateInput(
			await c.req.json().catch(() => ({})),
			isPitch ? "pitch" : "reply",
		);
		if ("error" in input) return c.json({ error: input.error }, 400);
		const template = await authStub(c.env).saveTemplate(
			{
				id,
				kind: isPitch ? "pitch" : "reply",
				name: input.name,
				subject: input.subject,
				body: input.body,
			},
			session.email,
		);
		if (!template) return c.json({ error: "Template not found" }, 404);
		return c.json({ template });
	});

	app.post("/api/v1/templates/pitch/reset", async (c) => {
		const session = c.get("session");
		if (!session) return c.json({ error: "Unauthorized" }, 401);
		if (!session.isAdmin) return c.json({ error: "Only an admin can reset the pitch" }, 403);
		return c.json({ template: await authStub(c.env).resetPitchTemplate() });
	});

	app.delete("/api/v1/templates/:id", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		const id = c.req.param("id");
		if (id === PITCH_TEMPLATE_ID) return c.json({ error: "The pitch can be reset but not deleted" }, 400);
		const removed = await authStub(c.env).deleteTemplate(id);
		return c.json({ removed }, removed ? 200 : 404);
	});
}
