import type { Hono } from "hono";
import { isDue } from "../outreach";
import {
	DEFAULT_FOLLOWUP_TEMPLATE,
	renderTemplate,
	textToHtml,
} from "../templates";
import type { Env, Session } from "../types";

type App = Hono<{ Bindings: Env; Variables: { session?: Session } }>;

const DAY_MS = 86_400_000;
/** Never chase mail older than this, even if the settings would allow it. */
const MAX_CHAIN_AGE_DAYS = 45;
/** Safety valve: drafts prepared per mailbox in a single run. */
const MAX_DRAFTS_PER_MAILBOX_PER_RUN = 25;

const authStub = (env: Env) => env.MAILBOX.get(env.MAILBOX.idFromName("AUTH"));

async function listMailboxIds(env: Env): Promise<string[]> {
	const ids: string[] = [];
	let cursor: string | undefined;
	do {
		const page = await env.BUCKET.list({ prefix: "mailboxes/", cursor });
		for (const obj of page.objects) {
			ids.push(obj.key.replace("mailboxes/", "").replace(/\.json$/, ""));
		}
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);
	return ids;
}

export interface FollowUpRunSummary {
	ran: boolean;
	reason?: string;
	dryRun: boolean;
	drafts: number;
	details: Array<{ mailbox: string; recipient: string; subject: string }>;
}

/**
 * Prepares follow-up DRAFTS for outreach nobody has answered. It never sends anything: a person
 * reviews each draft in Drafts (the normal composer then adds the unsubscribe link and checks the
 * do-not-contact list). Safe to run repeatedly: a recipient with an unsent follow-up draft is skipped.
 */
export async function runFollowUps(
	env: Env,
	opts: { force?: boolean; dryRun?: boolean } = {},
): Promise<FollowUpRunSummary> {
	const dryRun = !!opts.dryRun;
	const auth = authStub(env);
	const config = await auth.getFollowUpConfig();
	if (!config.enabled && !opts.force) {
		return { ran: false, reason: "Follow-ups are turned off", dryRun, drafts: 0, details: [] };
	}

	const templates = await auth.listTemplates();
	const template =
		templates.find((t) => t.id === config.template_id && t.kind === "reply") ||
		DEFAULT_FOLLOWUP_TEMPLATE;

	const now = Date.now();
	const windowStart = Math.max(
		now - MAX_CHAIN_AGE_DAYS * DAY_MS,
		config.enabled_at ? Date.parse(config.enabled_at) : 0,
	);
	const sinceIso = new Date(windowStart).toISOString();

	const details: FollowUpRunSummary["details"] = [];
	for (const mailboxId of await listMailboxIds(env)) {
		try {
			const stub = env.MAILBOX.get(env.MAILBOX.idFromName(mailboxId));
			const chains = await stub.getOutreachChains(sinceIso);
			let due = chains.filter((c) =>
				isDue(c, {
					now,
					delayMs: config.delay_days * DAY_MS,
					maxFollowUps: config.max_followups,
				}),
			);
			if (due.length === 0) continue;

			// Anyone who unsubscribed or bounced is left alone entirely.
			const blocked = new Set(
				(await auth.checkSuppressions(due.map((c) => c.recipient))).map((s) => s.email),
			);
			due = due.filter((c) => !blocked.has(c.recipient)).slice(0, MAX_DRAFTS_PER_MAILBOX_PER_RUN);

			const created: string[] = [];
			for (const chain of due) {
				const binding = await auth.getAppBinding(chain.recipient);
				const developer = binding?.developer_name?.trim().split(/\s+/)[0] || "there";
				const body = renderTemplate(template.body, {
					first_name: developer,
					app_name: binding?.app_name || "your app",
					original_subject: chain.start_subject,
				});
				const subject = /^re:/i.test(chain.start_subject)
					? chain.start_subject
					: `Re: ${chain.start_subject || "our earlier note"}`;
				details.push({ mailbox: mailboxId, recipient: chain.recipient, subject });
				if (dryRun) continue;
				await stub.createFollowUpDraft({
					id: crypto.randomUUID(),
					mailboxId,
					recipient: chain.recipient,
					subject,
					html: textToHtml(body),
					threadId: chain.thread_id,
					originalEmailId: chain.start_id,
				});
				created.push(chain.recipient);
			}
			if (created.length > 0) await stub.notifyFollowUps(mailboxId, created.length, created[0]);
		} catch (err) {
			console.error(`Follow-up run failed for ${mailboxId}:`, err);
		}
	}

	if (!dryRun) await auth.recordFollowUpRun(details.length);
	return { ran: true, dryRun, drafts: details.length, details };
}

/**
 * GET  /api/v1/followups/config       any signed-in user
 * PUT  /api/v1/followups/config       admin  { enabled?, delay_days?, max_followups?, template_id?, catch_up_days? }
 * POST /api/v1/followups/run          admin  { dry_run? }  runs the job now (what the cron does)
 * GET  /api/v1/mailboxes/:id/pipeline outreach chains for that mailbox (mailbox access is enforced upstream)
 */
export function registerFollowUpRoutes(app: App) {
	app.get("/api/v1/followups/config", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		return c.json({ config: await authStub(c.env).getFollowUpConfig() });
	});

	app.put("/api/v1/followups/config", async (c) => {
		const session = c.get("session");
		if (!session) return c.json({ error: "Unauthorized" }, 401);
		if (!session.isAdmin) return c.json({ error: "Only an admin can change follow-ups" }, 403);
		const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
		const patch: Record<string, unknown> = {};
		if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
		if (typeof body.delay_days === "number") patch.delay_days = body.delay_days;
		if (typeof body.max_followups === "number") patch.max_followups = body.max_followups;
		if (typeof body.template_id === "string") patch.template_id = body.template_id;
		if (typeof body.catch_up_days === "number") patch.catch_up_days = body.catch_up_days;
		return c.json({ config: await authStub(c.env).setFollowUpConfig(patch) });
	});

	app.post("/api/v1/followups/run", async (c) => {
		const session = c.get("session");
		if (!session) return c.json({ error: "Unauthorized" }, 401);
		if (!session.isAdmin) return c.json({ error: "Only an admin can run follow-ups" }, 403);
		const body = (await c.req.json().catch(() => ({}))) as { dry_run?: boolean };
		return c.json(await runFollowUps(c.env, { force: !!body.dry_run, dryRun: !!body.dry_run }));
	});

	app.get("/api/v1/mailboxes/:mailboxId/pipeline", async (c) => {
		if (!c.get("session")) return c.json({ error: "Unauthorized" }, 401);
		const mailboxId = decodeURIComponent(c.req.param("mailboxId"));
		const days = Math.max(7, Math.min(180, Number(c.req.query("days")) || 90));
		const since = new Date(Date.now() - days * DAY_MS).toISOString();
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
		const chains = await stub.getOutreachChains(since);
		const suppressed = await authStub(c.env).checkSuppressions(chains.map((x) => x.recipient));
		const reasons = new Map(suppressed.map((s) => [s.email, s.reason]));
		return c.json({
			days,
			chains: chains.slice(0, 500).map((x) => ({ ...x, suppressed: reasons.get(x.recipient) || null })),
		});
	});
}
