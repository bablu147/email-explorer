// End-to-end tests for the Phase 0 hardening: the sender is pinned to the mailbox, unknown request
// fields are rejected (while every field the dashboard posts, and the payloads of its previous
// build, are accepted), the do-not-contact list is enforced by the server, recipients must be valid
// addresses, draft_id can only name a draft and only a draft can be moved to Drafts, header values
// cannot inject headers, deleting a folder keeps its mail, inbound mail is filed by the envelope
// recipient, mailbox create/delete is admin-only, access grants ignore letter case, and the
// security headers.
// Against the real worker running locally.
//   npm run test:e2e
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import {
	client,
	type Harness,
	PASSWORD,
	rawEmail,
	sentFiles,
	startWorker,
	waitForNewMessages,
} from "./harness.ts";

const BOX = "team@phase0.test";
const DESK = "desk@phase0.test";
const enc = encodeURIComponent;

let h: Harness;
let api: ReturnType<typeof client>;
let admin = "";
let member = "";
let memberId = "";

const boxUrl = (path = "", box = BOX) => `/api/v1/mailboxes/${enc(box)}${path}`;
const list = async (folder: string, box = BOX) => {
	const res = await api.get(boxUrl(`/emails?folder=${enc(folder)}&limit=100`, box), admin);
	assert.equal(res.status, 200, JSON.stringify(res.body));
	return res.body as Array<Record<string, any>>;
};
const subjectsOf = (rows: Array<Record<string, any>>) => rows.map((r) => r.subject);
const getEmail = (id: string, box = BOX) => api.get(boxUrl(`/emails/${id}`, box), admin);
/** Sends through the mailbox. Unlike the helper in mail.test.ts it adds no `from`: the server must not need one. */
const send = (body: Record<string, unknown>, token = admin, box = BOX) => api.post(boxUrl("/emails", box), body, token);
const receive = (opts: Parameters<typeof rawEmail>[0]) => api.deliver(rawEmail(opts), opts.from, opts.to);
const inboxRow = async (subject: string, box = BOX) => {
	const row = (await list("inbox", box)).find((e) => e.subject === subject);
	assert.ok(row, `"${subject}" is in the inbox of ${box}`);
	return row;
};
const suppress = async (email: string) => {
	const res = await api.post("/api/v1/suppressions", { email }, admin);
	assert.ok(res.status === 201 || res.status === 200, JSON.stringify(res.body));
};
const mailboxIds = async () => ((await api.get("/api/v1/mailboxes", admin)).body as Array<{ id: string }>).map((m) => m.id);
const inTwoHours = () => new Date(Date.now() + 7_200_000).toISOString();

/** The header block of a delivered message, one entry per line. */
const headerLines = (mime: string) => mime.split(/\r?\n\r?\n/)[0].split(/\r?\n/);
const headerOf = (mime: string, name: string) =>
	headerLines(mime)
		.find((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}:`))
		?.slice(name.length + 1)
		.trim();

/** A refused request must send nothing: give a stray delivery time to show up, then count. */
const nothingDelivered = async (before: Set<string>, what = "no email left the building") => {
	await new Promise((r) => setTimeout(r, 300));
	assert.equal(sentFiles().filter((f) => !before.has(f)).length, 0, what);
};

/** A request with full control over its headers (Host, Origin), which fetch does not give. */
const rawRequest = (method: string, path: string, headers: Record<string, string> = {}, body?: string) =>
	new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
		const { hostname, port } = new URL(h.base);
		const req = http.request({ host: hostname, port, path, method, headers }, (res) => {
			let data = "";
			res.setEncoding("utf8");
			res.on("data", (chunk) => {
				data += chunk;
			});
			res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
		});
		req.on("error", reject);
		req.end(body);
	});

before(async () => {
	// Its own port: a worker from the previous test file that is still shutting down cannot answer for this one.
	h = await startWorker(8812);
	api = client(h.base);
	assert.equal((await api.post("/api/v1/auth/register", { email: "admin@phase0.test", password: PASSWORD })).status < 300, true);
	admin = (await api.login("admin@phase0.test")).body.id;
	assert.ok(admin, "admin login returns a session token");
	await api.post("/api/v1/auth/admin/register", { email: "member@phase0.test", password: PASSWORD }, admin);
	const m = (await api.login("member@phase0.test")).body;
	member = m.id;
	memberId = m.userId;
	assert.ok(member, "member login returns a session token");
	for (const box of [BOX, DESK]) {
		const res = await api.post("/api/v1/mailboxes", { email: box, name: box }, admin);
		assert.equal(res.status, 201, JSON.stringify(res.body));
	}
	// "write": the member sends, moves and deletes throughout this file, which a "read" grant no longer allows.
	const grant = await api.post("/api/v1/auth/admin/grant-access", { userId: memberId, mailboxId: BOX, role: "write" }, admin);
	assert.equal(grant.status, 200, JSON.stringify(grant.body));
});

after(async () => {
	await h?.stop();
});

describe("the sender is always the mailbox", () => {
	test("a `from` that is not the mailbox is refused and nothing is sent, saved or scheduled", async () => {
		const before = new Set(sentFiles());
		for (const token of [member, admin]) {
			for (const extra of [{}, { is_draft: true }, { send_at: inTwoHours() }]) {
				const res = await send({ from: "ceo@phase0.test", to: "dest@client.test", subject: "Forged sender", text: "x", ...extra }, token);
				assert.equal(res.status, 403, JSON.stringify(res.body));
				assert.equal(res.body.error, "The sender must be this mailbox's own address");
			}
		}
		await nothingDelivered(before);
		for (const folder of ["sent", "drafts", "scheduled"]) {
			assert.ok(!subjectsOf(await list(folder)).includes("Forged sender"), `nothing stored in ${folder}`);
		}
	});

	test("with no `from`, the message goes out as the mailbox", async () => {
		const before = new Set(sentFiles());
		const res = await send({ to: "dest@client.test", subject: "No from given", text: "x" }, member);
		assert.equal(res.status, 201, JSON.stringify(res.body));
		const [mime] = await waitForNewMessages(before, 1);
		assert.equal(headerOf(mime, "From"), BOX);
		const row = (await getEmail(res.body.id)).body;
		assert.equal(row.folder_id, "sent");
		assert.equal(row.sender, BOX);
	});

	test("the mailbox's own address in another letter case is accepted, and it still sends as the mailbox", async () => {
		const before = new Set(sentFiles());
		const res = await send({ from: "Team@Phase0.Test", to: "dest@client.test", subject: "Own address, capitals", text: "x" });
		assert.equal(res.status, 201, JSON.stringify(res.body));
		const [mime] = await waitForNewMessages(before, 1);
		assert.equal(headerOf(mime, "From"), BOX);
		assert.equal((await getEmail(res.body.id)).body.sender, BOX);
	});

	test("reply: a foreign `from` is refused; without one the reply is from the mailbox", async () => {
		await receive({ from: "Cust <cust@client.test>", to: BOX, subject: "Pinning: reply" });
		const original = await inboxRow("Pinning: reply");
		const url = boxUrl(`/emails/${original.id}/reply`);
		const before = new Set(sentFiles());
		const forged = await api.post(url, { from: "ceo@phase0.test", to: "cust@client.test", subject: "Re: Pinning: reply", text: "forged" }, member);
		assert.equal(forged.status, 403, JSON.stringify(forged.body));
		await nothingDelivered(before);
		const ok = await api.post(url, { to: "cust@client.test", subject: "Re: Pinning: reply", text: "real" }, member);
		assert.equal(ok.status, 201, JSON.stringify(ok.body));
		const [mime] = await waitForNewMessages(before, 1);
		assert.equal(headerOf(mime, "From"), BOX);
		assert.equal((await getEmail(ok.body.id)).body.sender, BOX);
		assert.equal((await list("sent")).filter((e) => e.subject === "Re: Pinning: reply").length, 1, "only the real reply is in Sent");
	});

	test("forward: a foreign `from` is refused; without one the forward is from the mailbox", async () => {
		await receive({ from: "Cust <cust@client.test>", to: BOX, subject: "Pinning: forward" });
		const original = await inboxRow("Pinning: forward");
		const url = boxUrl(`/emails/${original.id}/forward`);
		const before = new Set(sentFiles());
		const forged = await api.post(url, { from: "ceo@phase0.test", to: "colleague@client.test", subject: "Fwd: Pinning: forward", text: "forged" }, member);
		assert.equal(forged.status, 403, JSON.stringify(forged.body));
		await nothingDelivered(before);
		const ok = await api.post(url, { to: "colleague@client.test", subject: "Fwd: Pinning: forward", text: "real" }, member);
		assert.equal(ok.status, 201, JSON.stringify(ok.body));
		const [mime] = await waitForNewMessages(before, 1);
		assert.equal(headerOf(mime, "From"), BOX);
		assert.equal((await getEmail(ok.body.id)).body.sender, BOX);
		assert.equal((await list("sent")).filter((e) => e.subject === "Fwd: Pinning: forward").length, 1, "only the real forward is in Sent");
	});

	test("a scheduled message fired with send-now goes out as the mailbox", async () => {
		const before = new Set(sentFiles());
		const res = await send({ to: "later@client.test", subject: "Pinned when scheduled", text: "x", send_at: inTwoHours() }, member);
		assert.equal(res.status, 201, JSON.stringify(res.body));
		assert.equal(res.body.status, "scheduled");
		const fired = await api.post(boxUrl(`/emails/${res.body.id}/send-now`), {}, member);
		assert.equal(fired.status, 200, JSON.stringify(fired.body));
		const [mime] = await waitForNewMessages(before, 1);
		assert.equal(headerOf(mime, "From"), BOX);
		const row = (await getEmail(res.body.id)).body;
		assert.equal(row.folder_id, "sent");
		assert.equal(row.sender, BOX);
	});
});

describe("unknown request fields are rejected", () => {
	test("`scheduled_at` (what the old composer posted) is a 400, not an immediate send", async () => {
		const before = new Set(sentFiles());
		const res = await send({ to: "dest@client.test", subject: "Old composer schedule", text: "x", scheduled_at: inTwoHours() });
		assert.equal(res.status, 400, JSON.stringify(res.body));
		assert.ok(JSON.stringify(res.body).includes("scheduled_at"), "the answer names the unknown field");
		await nothingDelivered(before);
		for (const folder of ["sent", "drafts", "scheduled"]) {
			assert.ok(!subjectsOf(await list(folder)).includes("Old composer schedule"), `nothing stored in ${folder}`);
		}
	});

	test("`send_at` schedules: the message waits in Scheduled and nothing is sent", async () => {
		const before = new Set(sentFiles());
		const res = await send({ to: "dest@client.test", subject: "New composer schedule", text: "x", send_at: inTwoHours() });
		assert.equal(res.status, 201, JSON.stringify(res.body));
		assert.equal(res.body.status, "scheduled");
		assert.ok((await list("scheduled")).some((e) => e.id === res.body.id), "listed in Scheduled");
		assert.ok(!(await list("sent")).some((e) => e.id === res.body.id), "not in Sent");
		await nothingDelivered(before);
	});

	test("reply and forward reject unknown fields too", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Strict: reply and forward" });
		const original = await inboxRow("Strict: reply and forward");
		const before = new Set(sentFiles());
		for (const action of ["reply", "forward"]) {
			const res = await api.post(
				boxUrl(`/emails/${original.id}/${action}`),
				{ to: "cust@client.test", subject: "Strict", text: "x", scheduled_at: inTwoHours() },
				admin,
			);
			assert.equal(res.status, 400, `${action}: ${JSON.stringify(res.body)}`);
			assert.ok(JSON.stringify(res.body).includes("scheduled_at"), `${action}: the answer names the unknown field`);
		}
		await nothingDelivered(before);
	});

	test("the schedule route rejects a misspelt key instead of unscheduling", async () => {
		const res = await send({ to: "dest@client.test", subject: "Stays scheduled", text: "x", send_at: inTwoHours() });
		const id = res.body.id;
		const bad = await api.post(boxUrl(`/emails/${id}/schedule`), { scheduled_at: inTwoHours() }, admin);
		assert.equal(bad.status, 400, JSON.stringify(bad.body));
		assert.ok((await list("scheduled")).some((e) => e.id === id), "still scheduled");
		const cancel = await api.post(boxUrl(`/emails/${id}/schedule`), { send_at: null }, admin);
		assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
		assert.ok(!(await list("scheduled")).some((e) => e.id === id), "send_at: null still unschedules");
	});

	test("the snooze route rejects a misspelt key instead of unsnoozing", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Stays snoozed" });
		const row = await inboxRow("Stays snoozed");
		const url = boxUrl(`/emails/${row.id}/snooze`);
		assert.equal((await api.post(url, { until: inTwoHours() }, admin)).status, 200);
		assert.ok((await list("snoozed")).some((e) => e.id === row.id), "snoozed");
		const bad = await api.post(url, { snooze_until: inTwoHours() }, admin);
		assert.equal(bad.status, 400, JSON.stringify(bad.body));
		assert.deepEqual(bad.body, { error: "Unknown field: snooze_until" });
		const extra = await api.post(url, { until: null, snoozed_until: null }, admin);
		assert.equal(extra.status, 400, JSON.stringify(extra.body));
		assert.ok((await list("snoozed")).some((e) => e.id === row.id), "still snoozed");
		const cancel = await api.post(url, { until: null }, admin);
		assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
		assert.ok(!(await list("snoozed")).some((e) => e.id === row.id), "until: null still unsnoozes");
		assert.ok((await list("inbox")).some((e) => e.id === row.id), "and the message is back in the inbox");
	});

	test("snooze and schedule need a JSON object: null, an array or a number is a 400 and changes nothing", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Snoozed through bad bodies" });
		const snoozed = await inboxRow("Snoozed through bad bodies");
		const snoozeUrl = boxUrl(`/emails/${snoozed.id}/snooze`);
		assert.equal((await api.post(snoozeUrl, { until: inTwoHours() }, admin)).status, 200);
		const scheduled = await send({ to: "dest@client.test", subject: "Scheduled through bad bodies", text: "x", send_at: inTwoHours() });
		assert.equal(scheduled.status, 201, JSON.stringify(scheduled.body));
		const scheduleUrl = boxUrl(`/emails/${scheduled.body.id}/schedule`);

		for (const url of [snoozeUrl, scheduleUrl]) {
			for (const body of [null, [], [{ until: null, send_at: null }], 5, "until", true]) {
				const res = await api.post(url, body, admin);
				assert.equal(res.status, 400, `${JSON.stringify(body)} to ${url}: ${res.status} ${JSON.stringify(res.body)}`);
				assert.deepEqual(res.body, { error: "The request body must be a JSON object" });
			}
			const notJson = await api.call("POST", url, { token: admin, raw: "until=", contentType: "application/json" });
			assert.equal(notJson.status, 400, `a body that is not JSON to ${url}`);
		}
		// Only an explicit null cancels. `{}` is what a client sends for an undefined value.
		for (const [url, field] of [[snoozeUrl, "until"], [scheduleUrl, "send_at"]] as const) {
			for (const body of [{}, { [field]: "" }]) {
				const res = await api.post(url, body, admin);
				assert.equal(res.status, 400, `${JSON.stringify(body)} to ${url}: ${res.status} ${JSON.stringify(res.body)}`);
			}
		}

		assert.ok((await list("snoozed")).some((e) => e.id === snoozed.id), "still snoozed");
		assert.ok((await list("scheduled")).some((e) => e.id === scheduled.body.id), "still scheduled");
	});

	test("mailbox create and update reject unknown fields", async () => {
		const created = await api.post("/api/v1/mailboxes", { email: "strict@phase0.test", name: "Strict", owner: "x" }, admin);
		assert.equal(created.status, 400, JSON.stringify(created.body));
		assert.ok(!(await mailboxIds()).includes("strict@phase0.test"));
		const updated = await api.put(boxUrl(), { settings: {}, id: "other@phase0.test" }, admin);
		assert.equal(updated.status, 400, JSON.stringify(updated.body));
	});
});

describe("the dashboard and the server agree on the request fields", () => {
	// dashboard-src/src/services/api.ts posts only the keys on its lists, and the server refuses any
	// key it does not know. A key on a list that a route does not take would therefore turn every
	// such request from the dashboard into a 400, so each list is posted here in full.
	const apiSource = readFileSync(resolve(import.meta.dirname, "../../dashboard-src/src/services/api.ts"), "utf8");
	const keyList = (name: string): string[] => {
		const body = apiSource.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))?.[1];
		assert.ok(body !== undefined, `api.ts declares ${name}`);
		const code = body.replace(/\/\/.*$/gm, "");
		return [
			...[...code.matchAll(/\.\.\.(\w+)/g)].flatMap((m) => keyList(m[1])),
			...[...code.matchAll(/"(\w+)"/g)].map((m) => m[1]),
		];
	};

	test("every field the dashboard may post is accepted by the send, reply and forward routes", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Contract: original" });
		const original = await inboxRow("Contract: original");
		const newDraft = async () => {
			const res = await send({ to: "cust@client.test", subject: "Contract: draft", text: "wip", is_draft: true }, member);
			assert.equal(res.status, 201, JSON.stringify(res.body));
			return res.body.id as string;
		};
		const attachmentValues: Record<string, string> = {
			content: Buffer.from("hello").toString("base64"),
			filename: "note.txt",
			type: "text/plain",
			disposition: "attachment",
			contentId: "<note@contract.test>",
		};
		const attachmentKeys = keyList("ATTACHMENT_KEYS");
		for (const key of attachmentKeys) assert.ok(key in attachmentValues, `this test has a value for the attachment field "${key}"`);
		const values: Record<string, () => unknown> = {
			to: () => "cust@client.test",
			cc: () => "copy@client.test",
			bcc: () => "hidden@client.test",
			subject: () => "Contract: every field",
			html: () => "<p>Hello</p>",
			text: () => "Hello",
			attachments: () => [Object.fromEntries(attachmentKeys.map((key) => [key, attachmentValues[key]]))],
			in_reply_to: () => original.id,
			references: () => [original.id],
			thread_id: () => original.thread_id || original.id,
			draft_id: newDraft,
			is_draft: () => false,
			send_at: inTwoHours,
		};
		const payload = async (keys: string[], overrides: Record<string, unknown> = {}) => {
			const body: Record<string, unknown> = {};
			for (const key of keys) {
				assert.ok(key in values, `this test has a value for the field "${key}"`);
				body[key] = key in overrides ? overrides[key] : await values[key]();
			}
			return body;
		};
		const replyKeys = keyList("REPLY_KEYS");
		const sendKeys = keyList("SEND_KEYS");
		assert.ok(replyKeys.includes("draft_id") && sendKeys.includes("send_at"), "the lists were read from api.ts");

		const before = new Set(sentFiles());
		// api.sendEmail: an immediate send, and a scheduled one.
		const sent = await send(await payload(sendKeys.filter((key) => key !== "send_at")), member);
		assert.equal(sent.status, 201, JSON.stringify(sent.body));
		assert.equal(sent.body.status, "sent");
		const scheduled = await send(await payload(sendKeys), member);
		assert.equal(scheduled.status, 201, JSON.stringify(scheduled.body));
		assert.equal(scheduled.body.status, "scheduled");
		// api.saveDraft: the same keys with is_draft: true.
		const saved = await send(await payload(sendKeys.filter((key) => key !== "send_at"), { is_draft: true }), member);
		assert.equal(saved.status, 201, JSON.stringify(saved.body));
		assert.equal(saved.body.status, "draft_saved");
		// api.replyToEmail and api.forwardEmail.
		for (const action of ["reply", "forward"]) {
			const res = await api.post(boxUrl(`/emails/${original.id}/${action}`), await payload(replyKeys), member);
			assert.equal(res.status, 201, `${action}: ${JSON.stringify(res.body)}`);
		}
		// To, Cc and Bcc of the send, the reply and the forward.
		assert.equal((await waitForNewMessages(before, 9)).length, 9);
	});
});

describe("a dashboard loaded before this release can still send", () => {
	// What the composer of the previous build posts (ComposeEmail.vue at the last commit): the mailbox
	// id and is_draft:false in the body, on the send route and on reply/forward alike. `draft_id` is
	// there once the composer has autosaved, and Cc/Bcc only when filled in.
	const legacyPayload = (subject: string, extra: Record<string, unknown> = {}) => ({
		mailboxId: BOX,
		to: "dest@client.test",
		from: BOX,
		subject,
		html: "<p>Hello</p>",
		text: "Hello",
		is_draft: false,
		...extra,
	});

	test("its new-message payload is accepted and delivered, and the autosaved draft is removed", async () => {
		const autosave = await send(
			{ to: "dest@client.test", from: BOX, subject: "Old composer: new message", html: "<p>Hello</p>", text: "Hello", is_draft: true },
			member,
		);
		assert.equal(autosave.status, 201, JSON.stringify(autosave.body));
		const before = new Set(sentFiles());
		const res = await send(legacyPayload("Old composer: new message", { draft_id: autosave.body.id, cc: "copy@client.test" }), member);
		assert.equal(res.status, 201, JSON.stringify(res.body));
		assert.equal(res.body.status, "sent");
		const files = await waitForNewMessages(before, 2);
		assert.equal(files.length, 2, "delivered to the To and the Cc recipient");
		assert.equal(headerOf(files[0], "From"), BOX);
		assert.equal(headerOf(files[0], "To"), "dest@client.test");
		assert.equal((await getEmail(res.body.id)).body.folder_id, "sent");
		assert.ok(!(await list("drafts")).some((d) => d.id === autosave.body.id), "the draft is gone");

		const first = await send(legacyPayload("Old composer: never autosaved"), member);
		assert.equal(first.status, 201, JSON.stringify(first.body));
	});

	test("its reply and forward payloads are accepted and delivered", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Old composer: original" });
		const original = await inboxRow("Old composer: original");
		const before = new Set(sentFiles());
		for (const action of ["reply", "forward"]) {
			const res = await api.post(
				boxUrl(`/emails/${original.id}/${action}`),
				legacyPayload(`Old composer: ${action}`, { to: "cust@client.test" }),
				member,
			);
			assert.equal(res.status, 201, `${action}: ${JSON.stringify(res.body)}`);
			assert.equal((await getEmail(res.body.id)).body.sender, BOX);
		}
		assert.equal((await waitForNewMessages(before, 2)).length, 2);
	});

	test("its schedule payload (`scheduled_at`) is still refused, as is any other unknown key", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Old composer: schedule original" });
		const original = await inboxRow("Old composer: schedule original");
		const before = new Set(sentFiles());
		const scheduled = await send(legacyPayload("Old composer: schedule", { scheduled_at: inTwoHours() }), member);
		assert.equal(scheduled.status, 400, JSON.stringify(scheduled.body));
		assert.ok(JSON.stringify(scheduled.body).includes("scheduled_at"), "the answer names the unknown field");
		const unknown = await send(legacyPayload("Old composer: schedule", { priority: "high" }), member);
		assert.equal(unknown.status, 400, JSON.stringify(unknown.body));
		for (const action of ["reply", "forward"]) {
			// These routes always send, so is_draft is only accepted as false.
			for (const extra of [{ scheduled_at: inTwoHours() }, { is_draft: true }, { send_at: inTwoHours() }]) {
				const res = await api.post(
					boxUrl(`/emails/${original.id}/${action}`),
					legacyPayload("Old composer: schedule", { to: "cust@client.test", ...extra }),
					member,
				);
				assert.equal(res.status, 400, `${action} ${JSON.stringify(extra)}: ${JSON.stringify(res.body)}`);
			}
		}
		await nothingDelivered(before);
		for (const folder of ["sent", "drafts", "scheduled"]) {
			assert.ok(!subjectsOf(await list(folder)).includes("Old composer: schedule"), `nothing stored in ${folder}`);
		}
	});
});

describe("the do-not-contact list is enforced by the server", () => {
	const BLOCKED = "blocked@prospect.test";

	test("a new message to a listed address is refused with 422, whether it is in To, Cc or Bcc", async () => {
		await suppress(BLOCKED);
		const before = new Set(sentFiles());
		const bodies = [
			{ to: BLOCKED },
			{ to: "fine@client.test", cc: "Blocked@Prospect.Test" },
			{ to: "fine@client.test", bcc: `Blocked <${BLOCKED}>` },
		];
		for (const recipients of bodies) {
			const res = await send({ ...recipients, subject: "Outreach to a listed address", text: "x" }, member);
			assert.equal(res.status, 422, JSON.stringify(res.body));
			assert.deepEqual(res.body.suppressed, [{ email: BLOCKED, reason: "manual" }]);
			assert.match(res.body.error, /blocked@prospect\.test is on the do-not-contact list/);
		}
		await nothingDelivered(before, "not even the other recipients got a copy");
		assert.ok(!subjectsOf(await list("sent")).includes("Outreach to a listed address"));
	});

	test("scheduling to a listed address is refused too, and leaves nothing behind", async () => {
		const res = await send({ to: BLOCKED, subject: "Scheduled outreach to a listed address", text: "x", send_at: inTwoHours() });
		assert.equal(res.status, 422, JSON.stringify(res.body));
		for (const folder of ["scheduled", "drafts"]) {
			assert.ok(!subjectsOf(await list(folder)).includes("Scheduled outreach to a listed address"), `nothing stored in ${folder}`);
		}
	});

	test("a plain draft may still be saved, but the schedule route will not schedule it", async () => {
		const draft = await send({ to: BLOCKED, subject: "Draft to a listed address", text: "x", is_draft: true });
		assert.equal(draft.status, 201, JSON.stringify(draft.body));
		const res = await api.post(boxUrl(`/emails/${draft.body.id}/schedule`), { send_at: inTwoHours() }, admin);
		assert.equal(res.status, 422, JSON.stringify(res.body));
		assert.deepEqual(res.body.suppressed, [{ email: BLOCKED, reason: "manual" }]);
		assert.ok(!(await list("scheduled")).some((e) => e.id === draft.body.id), "not scheduled");
		assert.ok((await list("drafts")).some((e) => e.id === draft.body.id), "still a draft");
	});

	test("forwarding to a listed address is refused", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Forward me to a listed address" });
		const original = await inboxRow("Forward me to a listed address");
		const before = new Set(sentFiles());
		const res = await api.post(
			boxUrl(`/emails/${original.id}/forward`),
			{ to: BLOCKED, subject: "Fwd: Forward me to a listed address", text: "FYI" },
			member,
		);
		assert.equal(res.status, 422, JSON.stringify(res.body));
		assert.deepEqual(res.body.suppressed, [{ email: BLOCKED, reason: "manual" }]);
		await nothingDelivered(before);
		assert.ok(!subjectsOf(await list("sent")).includes("Fwd: Forward me to a listed address"));
	});

	test("answering a listed address that wrote in stays possible", async () => {
		await receive({ from: `Blocked <${BLOCKED}>`, to: BOX, subject: "I unsubscribed but have a question" });
		const original = await inboxRow("I unsubscribed but have a question");
		const before = new Set(sentFiles());
		const reply = await api.post(
			boxUrl(`/emails/${original.id}/reply`),
			{ to: BLOCKED, subject: "Re: I unsubscribed but have a question", text: "Here is the answer" },
			member,
		);
		assert.equal(reply.status, 201, JSON.stringify(reply.body));
		// The composer's other route for a reply: the send endpoint with in_reply_to naming the received message.
		const viaSend = await send({ to: BLOCKED, subject: "Re: one more thing", text: "x", in_reply_to: original.id }, member);
		assert.equal(viaSend.status, 201, JSON.stringify(viaSend.body));
		const files = await waitForNewMessages(before, 2);
		assert.equal(files.length, 2);
		for (const mime of files) assert.equal(headerOf(mime, "To"), BLOCKED);
	});

	test("a reply exempts only the sender it answers: a listed third party in To, Cc or Bcc stops it", async () => {
		await suppress(BLOCKED);
		await receive({ from: "asker@client.test", to: BOX, subject: "Question, listed colleague in copy" });
		const original = await inboxRow("Question, listed colleague in copy");
		const before = new Set(sentFiles());
		const bodies = [
			{ to: "asker@client.test", cc: BLOCKED },
			{ to: "asker@client.test", bcc: `Blocked <${BLOCKED}>` },
			{ to: `asker@client.test, ${BLOCKED}` },
			{ to: BLOCKED },
		];
		for (const recipients of bodies) {
			const res = await api.post(
				boxUrl(`/emails/${original.id}/reply`),
				{ ...recipients, subject: "Re: Question, listed colleague in copy", text: "x" },
				member,
			);
			assert.equal(res.status, 422, `${JSON.stringify(recipients)}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body.suppressed, [{ email: BLOCKED, reason: "manual" }]);
			assert.match(res.body.error, /^blocked@prospect\.test is on the do-not-contact list/);
		}
		await nothingDelivered(before, "not even the sender being answered got a copy");
		assert.ok(!subjectsOf(await list("sent")).includes("Re: Question, listed colleague in copy"));
	});

	test("in_reply_to naming a received message does not open the list to a third party: send, schedule and fire", async () => {
		await suppress(BLOCKED);
		await receive({ from: "asker@client.test", to: BOX, subject: "Another question" });
		const original = await inboxRow("Another question");
		const reply = { subject: "Re: Another question", text: "x", in_reply_to: original.id };
		const before = new Set(sentFiles());
		const bodies = [
			{ to: BLOCKED },
			{ to: BLOCKED, send_at: inTwoHours() },
			{ to: "asker@client.test", cc: BLOCKED },
			{ to: "asker@client.test", cc: BLOCKED, send_at: inTwoHours() },
		];
		for (const extra of bodies) {
			const res = await send({ ...reply, ...extra }, member);
			assert.equal(res.status, 422, `${JSON.stringify(extra)}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body.suppressed, [{ email: BLOCKED, reason: "manual" }]);
		}

		// A plain draft is saved unchecked. The schedule route checks it, and so does the send itself
		// (send-now sends a draft the same way the alarm sends a scheduled one).
		const draft = await send({ ...reply, to: "asker@client.test", cc: BLOCKED, is_draft: true }, member);
		assert.equal(draft.status, 201, JSON.stringify(draft.body));
		const viaSchedule = await api.post(boxUrl(`/emails/${draft.body.id}/schedule`), { send_at: inTwoHours() }, member);
		assert.equal(viaSchedule.status, 422, JSON.stringify(viaSchedule.body));
		assert.deepEqual(viaSchedule.body.suppressed, [{ email: BLOCKED, reason: "manual" }]);
		const fired = await api.post(boxUrl(`/emails/${draft.body.id}/send-now`), {}, member);
		assert.equal(fired.status, 422, JSON.stringify(fired.body));
		assert.deepEqual(fired.body.suppressed, [{ email: BLOCKED, reason: "manual" }]);

		await nothingDelivered(before);
		for (const folder of ["sent", "scheduled"]) {
			assert.ok(!subjectsOf(await list(folder)).includes("Re: Another question"), `nothing in ${folder}`);
		}
		assert.equal((await getEmail(draft.body.id)).body.folder_id, "drafts", "the draft is still a draft");
	});

	test("a scheduled answer to a listed sender still goes out when it fires, to that sender", async () => {
		const asker = "listed-asker@prospect.test";
		await suppress(asker);
		await receive({ from: asker, to: BOX, subject: "Listed, but asking" });
		const original = await inboxRow("Listed, but asking");
		const before = new Set(sentFiles());
		const scheduled = await send(
			{ to: asker, subject: "Re: Listed, but asking", text: "x", in_reply_to: original.id, send_at: inTwoHours() },
			member,
		);
		assert.equal(scheduled.status, 201, JSON.stringify(scheduled.body));
		assert.equal(scheduled.body.status, "scheduled");
		const fired = await api.post(boxUrl(`/emails/${scheduled.body.id}/send-now`), {}, member);
		assert.equal(fired.status, 200, JSON.stringify(fired.body));
		const files = await waitForNewMessages(before, 1);
		assert.equal(files.length, 1);
		assert.equal(headerOf(files[0], "To"), asker);
		assert.equal((await getEmail(scheduled.body.id)).body.folder_id, "sent");
	});

	test("a follow-up on the mailbox's own message is not a reply: it is refused", async () => {
		const prospect = "followup@prospect.test";
		const pitch = await send({ to: prospect, subject: "Our pitch", text: "x" });
		assert.equal(pitch.status, 201, JSON.stringify(pitch.body));
		await suppress(prospect);
		const before = new Set(sentFiles());
		const viaReply = await api.post(
			boxUrl(`/emails/${pitch.body.id}/reply`),
			{ to: prospect, subject: "Re: Our pitch", text: "Just following up" },
			member,
		);
		assert.equal(viaReply.status, 422, JSON.stringify(viaReply.body));
		assert.deepEqual(viaReply.body.suppressed, [{ email: prospect, reason: "manual" }]);
		// in_reply_to must name mail the mailbox received: its own message, or nothing at all, does not count.
		for (const in_reply_to of [pitch.body.id, "no-such-message"]) {
			const res = await send({ to: prospect, subject: "Re: Our pitch", text: "x", in_reply_to }, member);
			assert.equal(res.status, 422, `${in_reply_to}: ${JSON.stringify(res.body)}`);
		}
		await nothingDelivered(before);
		assert.ok(!subjectsOf(await list("sent")).includes("Re: Our pitch"));
	});

	test("a scheduled message is checked again when it fires", async () => {
		const prospect = "later-blocked@prospect.test";
		const scheduled = await send({ to: prospect, subject: "Scheduled before the unsubscribe", text: "x", send_at: inTwoHours() });
		assert.equal(scheduled.status, 201, JSON.stringify(scheduled.body));
		const id = scheduled.body.id;
		await suppress(prospect);
		const before = new Set(sentFiles());
		const fired = await api.post(boxUrl(`/emails/${id}/send-now`), {}, admin);
		assert.equal(fired.status, 422, JSON.stringify(fired.body));
		assert.deepEqual(fired.body.suppressed, [{ email: prospect, reason: "manual" }]);
		await nothingDelivered(before);
		const row = (await getEmail(id)).body;
		assert.equal(row.folder_id, "drafts", "back in Drafts, not in Sent");
		assert.match(row.send_error, /later-blocked@prospect\.test is on the do-not-contact list/);
		assert.equal(row.scheduled_at, null);
		assert.ok(!(await list("scheduled")).some((e) => e.id === id), "no longer scheduled");
		assert.ok((await list("drafts")).some((e) => e.id === id && e.send_error), "listed in Drafts with its send error");
	});
});

describe("draft_id can only name a draft", () => {
	test("pointing it at a received message is a 409 and the message is unchanged", async () => {
		await receive({ from: "victim@client.test", to: BOX, subject: "Original received subject", body: "Original received body" });
		const original = (await getEmail((await inboxRow("Original received subject")).id)).body;
		const before = new Set(sentFiles());
		for (const extra of [{ is_draft: true }, {}, { send_at: inTwoHours() }]) {
			const res = await send({ to: "x@client.test", subject: "Overwritten", text: "forged", draft_id: original.id, ...extra }, member);
			assert.equal(res.status, 409, JSON.stringify(res.body));
			assert.equal(res.body.error, "draft_id does not refer to a draft");
		}
		await nothingDelivered(before);
		const now = (await getEmail(original.id)).body;
		assert.equal(now.subject, "Original received subject");
		assert.equal(now.sender, "victim@client.test");
		assert.equal(now.folder_id, "inbox");
		assert.equal(now.body, original.body);
		assert.equal(now.recipient, original.recipient);
		for (const folder of ["drafts", "sent", "scheduled"]) {
			assert.ok(!subjectsOf(await list(folder)).includes("Overwritten"), `nothing stored in ${folder}`);
		}
	});

	test("pointing it at a sent message is a 409 too, and the sent message stays", async () => {
		const sent = await send({ to: "dest@client.test", subject: "Already sent", text: "x" });
		assert.equal(sent.status, 201, JSON.stringify(sent.body));
		const res = await send({ to: "dest@client.test", subject: "Rewritten history", text: "y", draft_id: sent.body.id, is_draft: true }, member);
		assert.equal(res.status, 409, JSON.stringify(res.body));
		const now = (await getEmail(sent.body.id)).body;
		assert.equal(now.subject, "Already sent");
		assert.equal(now.folder_id, "sent");
	});

	test("pointing it at a real draft updates that draft, and sending with it removes the draft", async () => {
		const draft = await send({ to: "later@client.test", subject: "Real draft", text: "v1", is_draft: true }, member);
		assert.equal(draft.status, 201, JSON.stringify(draft.body));
		const id = draft.body.id;
		const saved = await send({ to: "later@client.test", subject: "Real draft (edited)", text: "v2", is_draft: true, draft_id: id }, member);
		assert.equal(saved.status, 201, JSON.stringify(saved.body));
		assert.equal(saved.body.id, id);
		const drafts = await list("drafts");
		assert.equal(drafts.filter((d) => d.id === id).length, 1);
		assert.equal(drafts.find((d) => d.id === id)?.subject, "Real draft (edited)");

		const before = new Set(sentFiles());
		const sent = await send({ to: "later@client.test", subject: "Real draft (sent)", text: "v3", draft_id: id }, member);
		assert.equal(sent.status, 201, JSON.stringify(sent.body));
		assert.equal((await waitForNewMessages(before, 1)).length, 1);
		assert.ok(!(await list("drafts")).some((d) => d.id === id), "the draft is gone once sent");
		assert.ok(subjectsOf(await list("sent")).includes("Real draft (sent)"));
	});

	test("a plain draft save cannot touch a scheduled message; scheduling it again, or sending it now, still can", async () => {
		const scheduled = await send({ to: "later@client.test", subject: "Scheduled, then autosaved over", text: "v1", send_at: inTwoHours() }, member);
		assert.equal(scheduled.status, 201, JSON.stringify(scheduled.body));
		const id = scheduled.body.id;

		// What the autosave of a composer left open in another tab posts.
		const autosave = await send({ to: "later@client.test", subject: "Stale autosave", text: "v0", is_draft: true, draft_id: id }, member);
		assert.equal(autosave.status, 409, JSON.stringify(autosave.body));
		assert.deepEqual(autosave.body, { error: "This message is scheduled to be sent. Cancel the schedule to edit it." });
		const row = (await getEmail(id)).body;
		assert.equal(row.subject, "Scheduled, then autosaved over");
		assert.equal(row.delivery_status, "scheduled");
		assert.ok(row.scheduled_at, "it keeps its send time");
		assert.ok((await list("scheduled")).some((e) => e.id === id), "still listed in Scheduled");
		assert.ok(!subjectsOf(await list("drafts")).includes("Stale autosave"), "and nothing was saved under another id");

		const later = new Date(Date.now() + 3 * 3_600_000).toISOString();
		const again = await send({ to: "later@client.test", subject: "Scheduled again", text: "v2", send_at: later, draft_id: id }, member);
		assert.equal(again.status, 201, JSON.stringify(again.body));
		assert.equal(again.body.id, id);
		const rescheduled = (await getEmail(id)).body;
		assert.equal(rescheduled.subject, "Scheduled again");
		assert.equal(rescheduled.scheduled_at, later);

		// Once the schedule is cancelled it is a plain draft, and saves work again.
		assert.equal((await api.post(boxUrl(`/emails/${id}/schedule`), { send_at: null }, member)).status, 200);
		const saved = await send({ to: "later@client.test", subject: "A draft again", text: "v3", is_draft: true, draft_id: id }, member);
		assert.equal(saved.status, 201, JSON.stringify(saved.body));
		assert.equal((await getEmail(id)).body.subject, "A draft again");

		// Sending with the id of a scheduled message sends it now and removes the scheduled copy,
		// so it does not go out a second time when its schedule comes up.
		const queued = await send({ to: "later@client.test", subject: "Scheduled, then sent now", text: "x", send_at: inTwoHours() }, member);
		assert.equal(queued.status, 201, JSON.stringify(queued.body));
		const before = new Set(sentFiles());
		const sentNow = await send({ to: "later@client.test", subject: "Scheduled, then sent now", text: "x", draft_id: queued.body.id }, member);
		assert.equal(sentNow.status, 201, JSON.stringify(sentNow.body));
		assert.equal(sentNow.body.status, "sent");
		assert.equal((await waitForNewMessages(before, 1)).length, 1);
		assert.equal((await getEmail(queued.body.id)).status, 404, "the scheduled copy is gone");
		assert.ok(!(await list("scheduled")).some((e) => e.id === queued.body.id));
	});

	test("reply and forward take draft_id too, and remove that draft once the message is sent", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Draft cleanup: original" });
		const original = await inboxRow("Draft cleanup: original");
		for (const action of ["reply", "forward"]) {
			const draft = await send({ to: "cust@client.test", subject: `Draft cleanup: ${action} draft`, text: "wip", is_draft: true }, member);
			assert.equal(draft.status, 201, JSON.stringify(draft.body));
			assert.ok((await list("drafts")).some((d) => d.id === draft.body.id), `${action}: the draft exists`);
			const before = new Set(sentFiles());
			const res = await api.post(
				boxUrl(`/emails/${original.id}/${action}`),
				{ to: "cust@client.test", subject: `Draft cleanup: ${action} sent`, text: "done", draft_id: draft.body.id },
				member,
			);
			assert.equal(res.status, 201, `${action}: ${JSON.stringify(res.body)}`);
			assert.equal((await waitForNewMessages(before, 1)).length, 1);
			assert.equal((await getEmail(draft.body.id)).status, 404, `${action}: the draft is gone`);
			assert.ok(subjectsOf(await list("sent")).includes(`Draft cleanup: ${action} sent`));
		}
	});

	test("on reply and forward, a draft_id that names anything but a draft is ignored: that row is untouched", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Not a draft: received", body: "Received body" });
		const received = (await getEmail((await inboxRow("Not a draft: received")).id)).body;
		const beforeSent = new Set(sentFiles());
		const sent = await send({ to: "dest@client.test", subject: "Not a draft: sent", text: "Sent body" });
		assert.equal(sent.status, 201, JSON.stringify(sent.body));
		// Outgoing files are written a moment after the request returns. This one must be on disk
		// before the snapshot below, or it would be counted among the replies and forwards.
		assert.equal((await waitForNewMessages(beforeSent, 1)).length, 1);
		const before = new Set(sentFiles());
		let delivered = 0;
		for (const action of ["reply", "forward"]) {
			for (const draft_id of [received.id, sent.body.id, "no-such-draft"]) {
				const res = await api.post(
					boxUrl(`/emails/${received.id}/${action}`),
					{ to: "cust@client.test", subject: `Not a draft: ${action}`, text: "x", draft_id },
					member,
				);
				assert.equal(res.status, 201, `${action} with ${draft_id}: ${JSON.stringify(res.body)}`);
				delivered++;
			}
		}
		assert.equal((await waitForNewMessages(before, delivered)).length, delivered, "every reply and forward went out");
		const receivedNow = (await getEmail(received.id)).body;
		assert.equal(receivedNow.folder_id, "inbox");
		assert.equal(receivedNow.subject, "Not a draft: received");
		assert.equal(receivedNow.body, received.body);
		const sentNow = await getEmail(sent.body.id);
		assert.equal(sentNow.status, 200, "the sent message is still there");
		assert.equal(sentNow.body.folder_id, "sent");
		assert.equal(sentNow.body.subject, "Not a draft: sent");
	});
});

describe("only an unsent message can be moved to Drafts", () => {
	const move = (id: string, folderId: string) => api.post(boxUrl(`/emails/${id}/move`), { folderId }, member);

	test("a received or sent message is refused and stays where it was", async () => {
		await receive({ from: "victim@client.test", to: BOX, subject: "Received, not a draft" });
		const received = await inboxRow("Received, not a draft");
		const sent = await send({ to: "dest@client.test", subject: "Sent, not a draft", text: "x" });
		assert.equal(sent.status, 201, JSON.stringify(sent.body));
		for (const [id, folder] of [[received.id, "inbox"], [sent.body.id, "sent"]]) {
			const res = await move(id, "drafts");
			assert.equal(res.status, 409, `${folder}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body, { error: "Only an unsent draft can be moved to Drafts" });
			assert.equal((await getEmail(id)).body.folder_id, folder, `still in ${folder}`);
		}
		const drafts = await list("drafts");
		assert.ok(!drafts.some((e) => e.id === received.id || e.id === sent.body.id), "neither is listed in Drafts");

		// So draft_id still cannot overwrite the received message, and it cannot be scheduled.
		const overwrite = await send({ to: "x@client.test", subject: "Overwrite attempt", text: "forged", draft_id: received.id, is_draft: true }, member);
		assert.equal(overwrite.status, 409, JSON.stringify(overwrite.body));
		const schedule = await api.post(boxUrl(`/emails/${received.id}/schedule`), { send_at: inTwoHours() }, member);
		assert.equal(schedule.status, 400, JSON.stringify(schedule.body));
		const now = (await getEmail(received.id)).body;
		assert.equal(now.subject, "Received, not a draft");
		assert.equal(now.sender, "victim@client.test");
		assert.equal(now.scheduled_at, null);

		// Any other folder is still open to it.
		assert.equal((await move(received.id, "archive")).status, 200);
		assert.equal((await move(received.id, "drafts")).status, 409, "also refused from Archive");
		assert.equal((await getEmail(received.id)).body.folder_id, "archive");
	});

	test("moving a scheduled message to Drafts still cancels its schedule", async () => {
		const scheduled = await send({ to: "later@client.test", subject: "Cancel by moving to Drafts", text: "x", send_at: inTwoHours() }, member);
		assert.equal(scheduled.status, 201, JSON.stringify(scheduled.body));
		const id = scheduled.body.id;
		assert.ok((await list("scheduled")).some((e) => e.id === id), "scheduled");
		const moved = await move(id, "drafts");
		assert.equal(moved.status, 200, JSON.stringify(moved.body));
		const row = (await getEmail(id)).body;
		assert.equal(row.folder_id, "drafts");
		assert.equal(row.scheduled_at, null);
		assert.equal(row.delivery_status, "draft");
		assert.ok(!(await list("scheduled")).some((e) => e.id === id), "no longer scheduled");
		assert.ok((await list("drafts")).some((e) => e.id === id), "a plain draft again");
	});

	test("a draft, or a scheduled message, put in Trash can be moved back to Drafts", async () => {
		const draft = await send({ to: "later@client.test", subject: "Trashed draft", text: "x", is_draft: true }, member);
		const scheduled = await send({ to: "later@client.test", subject: "Trashed scheduled message", text: "x", send_at: inTwoHours() }, member);
		for (const res of [draft, scheduled]) {
			assert.equal(res.status, 201, JSON.stringify(res.body));
			const id = res.body.id;
			assert.equal((await move(id, "trash")).status, 200);
			assert.equal((await getEmail(id)).body.folder_id, "trash");
			const back = await move(id, "drafts");
			assert.equal(back.status, 200, JSON.stringify(back.body));
			assert.equal((await getEmail(id)).body.folder_id, "drafts");
			assert.ok((await list("drafts")).some((e) => e.id === id), "listed in Drafts again");
		}
	});
});

describe("recipients must be valid addresses", () => {
	const MALFORMED = ["victim@x.test>", "Victim <victim@x.test", "nobody"];

	test("an entry that is not a valid address is a 400 naming it, on send, schedule, reply and forward", async () => {
		await receive({ from: "cust@client.test", to: BOX, subject: "Malformed recipient: original" });
		const original = await inboxRow("Malformed recipient: original");
		const before = new Set(sentFiles());
		const message = { subject: "Malformed recipient", text: "x" };
		for (const entry of MALFORMED) {
			const named = (res: { status: number; body: any }, what: string) => {
				assert.equal(res.status, 400, `${what}: ${JSON.stringify(res.body)}`);
				assert.ok(String(res.body.error).includes(`"${entry}" is not a valid email address`), `${what} names the entry: ${res.body.error}`);
			};
			named(await send({ ...message, to: entry }, member), "to");
			named(await send({ ...message, to: "fine@client.test", cc: entry }, member), "cc");
			named(await send({ ...message, to: "fine@client.test", bcc: entry }, member), "bcc");
			named(await send({ ...message, to: ["fine@client.test", entry] }, member), "to as an array");
			named(await send({ ...message, to: entry, send_at: inTwoHours() }, member), "scheduled");
			for (const action of ["reply", "forward"]) {
				named(await api.post(boxUrl(`/emails/${original.id}/${action}`), { ...message, to: "cust@client.test", cc: entry }, member), action);
			}
		}
		// One array item is one entry, so two addresses in it are not a valid address either.
		const two = await send({ ...message, to: ["a@client.test, b@client.test"] }, member);
		assert.equal(two.status, 400, JSON.stringify(two.body));

		await nothingDelivered(before, "the valid recipients of a refused message got nothing either");
		for (const folder of ["sent", "drafts", "scheduled"]) {
			assert.ok(!subjectsOf(await list(folder)).includes("Malformed recipient"), `nothing stored in ${folder}`);
		}
	});

	test("a draft keeps such an entry as typed, and is refused when it is scheduled or sent", async () => {
		const entry = MALFORMED[0];
		const draft = await send({ to: `fine@client.test, ${entry}`, subject: "Malformed recipient in a draft", text: "x", is_draft: true }, member);
		assert.equal(draft.status, 201, JSON.stringify(draft.body));
		const id = draft.body.id;
		assert.equal((await getEmail(id)).body.recipient, `fine@client.test, ${entry}`);
		const before = new Set(sentFiles());
		const scheduled = await api.post(boxUrl(`/emails/${id}/schedule`), { send_at: inTwoHours() }, member);
		assert.equal(scheduled.status, 400, JSON.stringify(scheduled.body));
		assert.ok(String(scheduled.body.error).includes(`"${entry}" is not a valid email address`), scheduled.body.error);
		const fired = await api.post(boxUrl(`/emails/${id}/send-now`), {}, member);
		assert.equal(fired.status, 400, JSON.stringify(fired.body));
		assert.ok(String(fired.body.error).includes(`"${entry}" is not a valid email address`), fired.body.error);
		await nothingDelivered(before);
		const row = (await getEmail(id)).body;
		assert.equal(row.folder_id, "drafts");
		assert.equal(row.scheduled_at, null);
		assert.match(row.send_error, /is not a valid email address/);
	});

	test("the address checked against the list is the address delivered to: lower-case, no trailing dot", async () => {
		const listed = "dotted@prospect.test";
		await suppress(listed);
		const before = new Set(sentFiles());
		for (const to of ["dotted@prospect.test.", "Dotted <DOTTED@Prospect.Test.>", ["dotted@prospect.test."]]) {
			const res = await send({ to, subject: "Trailing dot", text: "x" }, member);
			assert.equal(res.status, 422, `${JSON.stringify(to)}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body.suppressed, [{ email: listed, reason: "manual" }]);
		}
		await nothingDelivered(before);

		// "Name <address>" keeps working, also with a comma in the name.
		const ok = await send({ to: "One, Some <Some.One@Client.Test.>; Other.One@Client.Test", subject: "Display name form", text: "x" }, member);
		assert.equal(ok.status, 201, JSON.stringify(ok.body));
		const files = await waitForNewMessages(before, 2);
		assert.equal(files.length, 2);
		for (const mime of files) assert.equal(headerOf(mime, "To"), "some.one@client.test, other.one@client.test");
		assert.equal((await getEmail(ok.body.id)).body.recipient, "some.one@client.test, other.one@client.test");
	});
});

describe("header injection", () => {
	test("line breaks in a subject cannot add headers to the outgoing message", async () => {
		const before = new Set(sentFiles());
		const res = await send({
			to: "dest@client.test",
			subject: "Quarterly numbers\r\nBcc: injected@evil.test\r\nX-Injected: yes",
			text: "body",
		});
		assert.equal(res.status, 201, JSON.stringify(res.body));
		await waitForNewMessages(before, 1);
		await new Promise((r) => setTimeout(r, 300));
		const files = await waitForNewMessages(before, 1);
		assert.equal(files.length, 1, "one copy, for the real recipient only");
		const lines = headerLines(files[0]);
		assert.ok(!lines.some((line) => /^bcc:/i.test(line)), "no Bcc header");
		assert.ok(!lines.some((line) => /^x-injected:/i.test(line)), "no X-Injected header");
		assert.deepEqual(
			lines.filter((line) => /^subject:/i.test(line)),
			["Subject: Quarterly numbers Bcc: injected@evil.test X-Injected: yes"],
			"the whole value stays on the one Subject line",
		);
		assert.equal(headerOf(files[0], "To"), "dest@client.test");
	});
});

describe("deleting a folder", () => {
	test("its messages move to Archive instead of being deleted", async () => {
		const created = await api.post(boxUrl("/folders"), { name: "Phase Zero Leads" }, admin);
		assert.ok(created.status === 200 || created.status === 201, JSON.stringify(created.body));
		const folderId = created.body.id;
		await receive({ from: "lead@client.test", to: BOX, subject: "Keep me when the folder goes" });
		const row = await inboxRow("Keep me when the folder goes");
		const moved = await api.post(boxUrl(`/emails/${row.id}/move`), { folderId }, admin);
		assert.equal(moved.status, 200, JSON.stringify(moved.body));
		assert.ok((await list(folderId)).some((e) => e.id === row.id), "the message is in the custom folder");

		assert.equal((await api.del(boxUrl(`/folders/${folderId}`), admin)).status < 300, true);

		const folders = (await api.get(boxUrl("/folders"), admin)).body as Array<{ id: string }>;
		assert.ok(!folders.some((f) => f.id === folderId), "the folder is gone");
		const kept = await getEmail(row.id);
		assert.equal(kept.status, 200, "the message is still retrievable");
		assert.equal(kept.body.folder_id, "archive");
		assert.equal(kept.body.subject, "Keep me when the folder goes");
		assert.ok((await list("archive")).some((e) => e.id === row.id), "and is listed in Archive");
	});
});

describe("inbound mail is filed by who it was delivered to", () => {
	const HEADER_ONLY = ["someone-else@elsewhere.test", "first@elsewhere.test", "Desk@Phase0.TEST"];

	test("delivered to the mailbox while the To header names someone else", async () => {
		const raw = rawEmail({ from: "sender@remote.test", to: HEADER_ONLY[0], subject: "Envelope decides" });
		assert.equal(await api.deliver(raw, "sender@remote.test", DESK), 200);
		const row = await inboxRow("Envelope decides", DESK);
		assert.equal(row.recipient, HEADER_ONLY[0], "the row still shows who it was addressed to");
	});

	test("an envelope address in another letter case reaches the same mailbox", async () => {
		const raw = rawEmail({ from: "sender@remote.test", to: HEADER_ONLY[2], subject: "Capitals in the address" });
		assert.equal(await api.deliver(raw, "sender@remote.test", HEADER_ONLY[2]), 200);
		await inboxRow("Capitals in the address", DESK);
	});

	test("the team address only in Cc still lands in its inbox", async () => {
		const raw = rawEmail({
			from: "sender@remote.test",
			to: HEADER_ONLY[1],
			subject: "Team is only in Cc",
			extraHeaders: [`Cc: ${DESK}`],
		});
		assert.equal(await api.deliver(raw, "sender@remote.test", DESK), 200);
		await inboxRow("Team is only in Cc", DESK);
	});

	test("a message with no To header (delivered as Bcc) is accepted", async () => {
		const raw = [
			"From: sender@remote.test",
			"Subject: Delivered as Bcc",
			"Message-ID: <bcc-only@remote.test>",
			"MIME-Version: 1.0",
			"Content-Type: text/plain; charset=utf-8",
			"",
			"Hello there",
			"",
		].join("\r\n");
		assert.equal(await api.deliver(raw, "sender@remote.test", DESK), 200);
		const row = await inboxRow("Delivered as Bcc", DESK);
		assert.equal(row.recipient, DESK);
	});

	test("no mailbox was created for an address that was only written in a header", async () => {
		const ids = await mailboxIds();
		for (const address of HEADER_ONLY) {
			assert.ok(!ids.includes(address), `no mailbox ${address}`);
			assert.ok(address === HEADER_ONLY[2] || !ids.includes(address.toLowerCase()), `no mailbox ${address.toLowerCase()}`);
		}
		assert.equal(ids.filter((id) => id.toLowerCase() === DESK).length, 1, "and still exactly one desk mailbox");
	});

	test("mail for an address with no mailbox creates one under the lower-cased address", async () => {
		const address = "New.Arrival@Phase0.Test";
		assert.equal(await receive({ from: "sender@remote.test", to: address, subject: "First mail for a new address" }), 200);
		const ids = await mailboxIds();
		assert.ok(ids.includes("new.arrival@phase0.test"), "the lower-cased mailbox exists");
		assert.ok(!ids.includes(address), "none under the mixed-case address");
		await inboxRow("First mail for a new address", "new.arrival@phase0.test");
	});
});

describe("mailboxes are created and deleted by admins only", () => {
	test("a member cannot create a mailbox", async () => {
		const res = await api.post("/api/v1/mailboxes", { email: "mine@phase0.test", name: "Mine" }, member);
		assert.equal(res.status, 403, JSON.stringify(res.body));
		assert.deepEqual(res.body, { error: "Admin access required" });
		assert.ok(!(await mailboxIds()).includes("mine@phase0.test"));
	});

	test("a member cannot delete a mailbox, even one they have access to; an admin can", async () => {
		const box = "temp@phase0.test";
		assert.equal((await api.post("/api/v1/mailboxes", { email: box, name: box }, admin)).status, 201);
		// The strongest mailbox role there is: a weaker one is stopped earlier, by the role check, and would not reach this rule.
		await api.post("/api/v1/auth/admin/grant-access", { userId: memberId, mailboxId: box, role: "owner" }, admin);
		assert.equal((await api.get(boxUrl("/emails", box), member)).status, 200, "the member does have access");
		const res = await api.del(boxUrl("", box), member);
		assert.equal(res.status, 403, JSON.stringify(res.body));
		assert.deepEqual(res.body, { error: "Admin access required" });
		assert.equal((await api.del(boxUrl("", DESK), member)).status, 403, "nor one they have no access to");
		assert.ok((await mailboxIds()).includes(box), "the mailbox is still there");
		assert.equal((await api.del(boxUrl("", box), admin)).status, 204);
		assert.ok(!(await mailboxIds()).includes(box));
	});

	test("new mailbox ids are lower-case, so the same address in another case is a duplicate", async () => {
		const first = await api.post("/api/v1/mailboxes", { email: "Mixed@Case.Test", name: "Mixed" }, admin);
		assert.equal(first.status, 201, JSON.stringify(first.body));
		assert.equal(first.body.id, "mixed@case.test");
		const second = await api.post("/api/v1/mailboxes", { email: "MIXED@case.test", name: "Mixed" }, admin);
		assert.equal(second.status, 409, JSON.stringify(second.body));
		assert.equal((await mailboxIds()).filter((id) => id.toLowerCase() === "mixed@case.test").length, 1);
	});

	test("the debug create-mailbox route is gone", async () => {
		for (const token of [member, admin]) {
			const res = await api.post("/api/v1/debug/create-mailbox", {}, token);
			assert.equal(res.status, 404, `got ${res.status}`);
		}
		assert.ok(!(await mailboxIds()).includes("test@example.com"));
	});
});

describe("access grants ignore letter case", () => {
	test("a grant typed with capitals opens the lower-cased mailbox, and only that one", async () => {
		const box = "grants@phase0.test";
		const typed = "Grants@Phase0.Test";
		assert.equal((await api.post("/api/v1/mailboxes", { email: box, name: box }, admin)).status, 201);
		const mine = async () => ((await api.get("/api/v1/mailboxes", member)).body as Array<{ id: string }>).map((m) => m.id);
		assert.equal((await api.get(boxUrl("/emails", box), member)).status, 403, "closed before the grant");
		assert.ok(!(await mine()).includes(box), "and not in the member's mailbox list");

		const grant = await api.post("/api/v1/auth/admin/grant-access", { userId: memberId, mailboxId: typed, role: "read" }, admin);
		assert.equal(grant.status, 200, JSON.stringify(grant.body));
		assert.equal((await api.get(boxUrl("/emails", box), member)).status, 200, "the member can open the mailbox");
		assert.equal((await api.get(boxUrl("/folders", box), member)).status, 200);
		const listed = await mine();
		assert.ok(listed.includes(box), "it is in the member's mailbox list");
		assert.ok(listed.includes(BOX), "next to the mailbox granted in lower case");
		assert.ok(!listed.includes(DESK), "a mailbox with no grant is still not listed");
		assert.equal((await api.get(boxUrl("/emails", DESK), member)).status, 403, "and still closed");

		// Revoked in another spelling than it was granted in: every spelling of the id must go.
		const revoke = await api.post("/api/v1/auth/admin/revoke-access", { userId: memberId, mailboxId: box }, admin);
		assert.equal(revoke.status, 200, JSON.stringify(revoke.body));
		assert.equal((await api.get(boxUrl("/emails", box), member)).status, 403, "revoking closes it again");
		assert.ok(!(await mine()).includes(box), "and it is gone from the member's mailbox list");
	});
});

describe("security headers", () => {
	test("API responses carry the security headers and no CORS headers", async () => {
		const withLogin = await api.get("/api/v1/mailboxes", admin);
		const withoutLogin = await api.get("/api/v1/mailboxes");
		assert.equal(withLogin.status, 200);
		assert.equal(withoutLogin.status, 401);
		for (const res of [withLogin, withoutLogin]) {
			assert.equal(res.headers.get("strict-transport-security"), "max-age=31536000");
			assert.equal(res.headers.get("x-content-type-options"), "nosniff");
			assert.equal(res.headers.get("x-frame-options"), "DENY");
			assert.equal(res.headers.get("referrer-policy"), "no-referrer");
			assert.equal(res.headers.get("cache-control"), "no-store");
			assert.equal(res.headers.get("access-control-allow-origin"), null);
		}
	});

	test("a request from another origin gets no Access-Control-Allow-Origin, preflight or not", async () => {
		const origin = "https://evil.example";
		const preflight = await rawRequest("OPTIONS", "/api/v1/mailboxes", {
			Origin: origin,
			"Access-Control-Request-Method": "POST",
			"Access-Control-Request-Headers": "authorization,content-type",
		});
		assert.equal(preflight.headers["access-control-allow-origin"], undefined);
		assert.equal(preflight.headers["access-control-allow-methods"], undefined);
		assert.equal(preflight.headers["access-control-allow-headers"], undefined);
		const actual = await rawRequest("GET", "/api/v1/mailboxes", { Origin: origin, Authorization: `Bearer ${admin}` });
		assert.equal(actual.status, 200);
		assert.equal(actual.headers["access-control-allow-origin"], undefined);
	});

	test("the open-tracking pixel keeps its own headers: it must load inside other people's mail clients", async () => {
		const px = await api.get(`/api/v1/track/open/${enc(BOX)}/unknown-id`);
		assert.equal(px.status, 200);
		assert.equal(px.headers.get("access-control-allow-origin"), "*");
		assert.match(String(px.headers.get("cache-control")), /no-store/);
		assert.equal(px.headers.get("x-content-type-options"), "nosniff");
		assert.equal(px.headers.get("cross-origin-resource-policy"), null);
	});

	test("the app page is served with an enforced script-src 'self' and loads no inline script", async () => {
		// `wrangler dev` applies dashboard/_headers to static assets, as production does.
		const page = await api.get("/");
		assert.equal(page.status, 200);
		const csp = String(page.headers.get("content-security-policy"));
		assert.match(csp, /(^|;\s*)script-src 'self'(;|$)/);
		assert.match(csp, /frame-ancestors 'none'/);
		assert.match(String(page.headers.get("content-security-policy-report-only")), /default-src 'self'/);
		assert.equal(page.headers.get("strict-transport-security"), "max-age=31536000");
		assert.equal(page.headers.get("x-content-type-options"), "nosniff");
		assert.equal(page.headers.get("x-frame-options"), "DENY");
		assert.equal(page.headers.get("referrer-policy"), "no-referrer");
		assert.ok(page.headers.get("permissions-policy"));
		const scripts = [...String(page.body).matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
		assert.ok(scripts.length > 0);
		for (const attrs of scripts) assert.match(attrs, /\bsrc="\//, `<script${attrs}> is not inline`);
		assert.ok(scripts.some((attrs) => attrs.includes('src="/theme-boot.js"')), "the theme boot is an external file");
		assert.equal((await api.get("/theme-boot.js")).status, 200);
	});

	test("plain http on a host that is not local is turned away before the app runs", async () => {
		// The Host header decides the URL the worker sees. `wrangler dev` rewrites the origin of a
		// Location header back to the one the client used, so the https scheme of the redirect cannot
		// be asserted here: only that the request was redirected (reads) or refused (writes).
		const host = { Host: "mail.phase0.test" };
		const read = await rawRequest("GET", "/api/v1/settings", host);
		assert.equal(read.status, 301);
		assert.match(String(read.headers.location), /\/\/mail\.phase0\.test\/api\/v1\/settings$/);
		assert.equal(read.headers["strict-transport-security"], "max-age=31536000");
		const write = await rawRequest(
			"POST",
			"/api/v1/auth/login",
			{ ...host, "Content-Type": "application/json" },
			JSON.stringify({ email: "admin@phase0.test", password: PASSWORD }),
		);
		assert.equal(write.status, 400);
		assert.deepEqual(JSON.parse(write.body), { error: "HTTPS required" });
		assert.equal((await rawRequest("GET", "/api/v1/settings", { Host: "app.localhost" })).status, 200, "local hosts are exempt");
	});
});
