import type { Context, Hono } from "hono";
import { checkDoNotContact } from "../delivery";
import { checkSendAt, checkSnoozeUntil, describeInvalidRecipients, parseRecipients } from "../scheduling";
import { answeredSender } from "../suppression";
import type { Env, Session } from "../types";

type App = Hono<{ Bindings: Env; Variables: { session?: Session } }>;

/**
 * Reads the one field the snooze and schedule routes take. An explicit null means "unsnooze" or
 * "unschedule", so a request must not be able to look like that by accident: a body that is not a
 * JSON object (null, an array, a number), a body with any other key (a misspelt `scheduled_at`
 * used to cancel the schedule silently), and a body without the field (`{}` is what a client
 * sends for an undefined value) are refused with the returned error.
 */
async function readSingleField(c: Context, field: string): Promise<{ value?: unknown; error?: string }> {
	const body: unknown = await c.req.json().catch(() => undefined);
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		return { error: "The request body must be a JSON object" };
	}
	const unknownKeys = Object.keys(body).filter((k) => k !== field);
	if (unknownKeys.length > 0) {
		return { error: `Unknown field: ${unknownKeys.join(", ")}` };
	}
	if (!(field in body)) return { error: `${field} is required (null to cancel)` };
	return { value: (body as Record<string, unknown>)[field] };
}

export function registerSchedulingRoutes(app: App) {
	app.post("/api/v1/mailboxes/:mailboxId/emails/:id/snooze", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		const { mailboxId, id } = c.req.param();
		const body = await readSingleField(c, "until");
		if (body.error) return c.json({ error: body.error }, 400);
		const until = body.value;
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));

		if (until === null) {
			await stub.snoozeEmail(id, null, mailboxId);
			return c.json({ status: "unsnoozed" });
		}

		const check = checkSnoozeUntil(until);
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
		const body = await readSingleField(c, "send_at");
		if (body.error) return c.json({ error: body.error }, 400);
		const sendAt = body.value;
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));

		if (sendAt === null) {
			await stub.scheduleDraft(id, null, mailboxId);
			return c.json({ status: "unscheduled" });
		}

		const check = checkSendAt(sendAt);
		if (!check.ok) return c.json({ error: check.error }, 400);

		// Same rules as a normal send. A draft with a recipient entry that is not a valid address
		// cannot be scheduled, nor one with a recipient on the do-not-contact list, other than the
		// sender it answers (in_reply_to names a message this mailbox received). The scheduled send
		// checks both again when it fires.
		const draft = (await stub.getEmail(id)) as any;
		if (draft && draft.folder_id === "drafts") {
			const toParsed = parseRecipients(draft.recipient);
			const ccParsed = parseRecipients(draft.cc);
			const bccParsed = parseRecipients(draft.bcc);
			const invalidRecipients = [...toParsed.invalid, ...ccParsed.invalid, ...bccParsed.invalid];
			if (invalidRecipients.length > 0) {
				return c.json({ error: describeInvalidRecipients(invalidRecipients) }, 400);
			}
			const original = draft.in_reply_to ? ((await stub.getEmail(String(draft.in_reply_to))) as any) : null;
			const answered = answeredSender(original, mailboxId);
			const block = await checkDoNotContact(
				c.env,
				[...toParsed.valid, ...ccParsed.valid, ...bccParsed.valid].filter((r) => r !== answered),
			);
			if (block) {
				return c.json({ error: block.error, suppressed: block.suppressed }, block.status);
			}
		}

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
			// Blocked by the do-not-contact list (422) or the list could not be read (503): answer as
			// the send route does. The draft keeps the same message as its send error.
			if (res.blocked) {
				return c.json({ error: res.blocked.error, suppressed: res.blocked.suppressed }, res.blocked.status);
			}
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
