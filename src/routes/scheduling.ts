import type { Hono } from "hono";
import { checkSendAt, checkSnoozeUntil } from "../scheduling";
import type { Env, Session } from "../types";

type App = Hono<{ Bindings: Env; Variables: { session?: Session } }>;

export function registerSchedulingRoutes(app: App) {
	app.post("/api/v1/mailboxes/:mailboxId/emails/:id/snooze", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		const { mailboxId, id } = c.req.param();
		const body = await c.req.json().catch(() => ({}));
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));

		if (body.until === null || body.until === undefined || body.until === "") {
			await stub.snoozeEmail(id, null, mailboxId);
			return c.json({ status: "unsnoozed" });
		}

		const check = checkSnoozeUntil(body.until);
		if (!check.ok) return c.json({ error: check.error }, 400);

		const success = await stub.snoozeEmail(id, check.iso!, mailboxId);
		if (!success) {
			return c.json({ error: "Email cannot be snoozed (must be in inbox)" }, 400);
		}
		return c.json({ status: "snoozed", snoozed_until: check.iso });
	});

	app.post("/api/v1/mailboxes/:mailboxId/emails/:id/schedule", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		const { mailboxId, id } = c.req.param();
		const body = await c.req.json().catch(() => ({}));
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));

		if (body.send_at === null || body.send_at === undefined || body.send_at === "") {
			await stub.scheduleDraft(id, null, mailboxId);
			return c.json({ status: "unscheduled" });
		}

		const check = checkSendAt(body.send_at);
		if (!check.ok) return c.json({ error: check.error }, 400);

		const success = await stub.scheduleDraft(id, check.iso!, mailboxId);
		if (!success) {
			return c.json({ error: "Draft cannot be scheduled (must be a draft)" }, 400);
		}
		return c.json({ status: "scheduled", scheduled_at: check.iso });
	});

	app.post("/api/v1/mailboxes/:mailboxId/emails/:id/send-now", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		const { mailboxId, id } = c.req.param();
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
		const res = await stub.sendScheduledNow(id, mailboxId);
		if (!res.ok) {
			return c.json({ error: res.error || "Failed to send scheduled email" }, 400);
		}
		return c.json({ status: "sent" });
	});

	app.get("/api/v1/mailboxes/:mailboxId/queue-summary", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		const { mailboxId } = c.req.param();
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
		return c.json(await stub.getQueueSummary());
	});

	app.post("/api/v1/mailboxes/:mailboxId/queue/run-due", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		const { mailboxId } = c.req.param();
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
		return c.json(await stub.runDue());
	});
}

export async function runDueAcrossMailboxes(env: Env): Promise<void> {
	let cursor: string | undefined;
	const mailboxIds: string[] = [];
	do {
		const page = await env.BUCKET.list({ prefix: "mailboxes/", cursor });
		for (const obj of page.objects) {
			mailboxIds.push(obj.key.replace("mailboxes/", "").replace(/\.json$/, ""));
		}
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);

	for (const id of mailboxIds) {
		try {
			const stub = env.MAILBOX.get(env.MAILBOX.idFromName(id));
			await stub.runDue();
		} catch (err) {
			console.error(`runDue failed for mailbox ${id}:`, err);
		}
	}
}
