// End-to-end tests for the core mail flows, against the real worker running locally.
//   npm run test:e2e
import assert from "node:assert/strict";
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

const BOX = "sales@e2e.test";
const OTHER_BOX = "ops@e2e.test";
const enc = encodeURIComponent;

let h: Harness;
let api: ReturnType<typeof client>;
let admin = "";
let member = "";
let memberId = "";

const emailsUrl = (box: string, query = "") => `/api/v1/mailboxes/${enc(box)}/emails${query}`;
const list = async (folder: string, query = "", token = admin, box = BOX) => {
	const res = await api.get(emailsUrl(box, `?folder=${folder}${query}`), token);
	assert.equal(res.status, 200, JSON.stringify(res.body));
	return res.body as Array<Record<string, any>>;
};
const send = (body: Record<string, unknown>, token = admin, box = BOX) =>
	api.post(emailsUrl(box), { from: box, ...body }, token);
const receive = (opts: Parameters<typeof rawEmail>[0]) => api.deliver(rawEmail(opts), opts.from, opts.to);
const unreadCount = async (folder: string) => {
	const res = await api.get(`/api/v1/mailboxes/${enc(BOX)}/folders`, admin);
	return (res.body as Array<{ id: string; unreadCount: number }>).find((f) => f.id === folder)?.unreadCount;
};
const subjectsOf = (rows: Array<Record<string, any>>) => rows.map((r) => r.subject);

before(async () => {
	h = await startWorker();
	api = client(h.base);
	assert.equal((await api.post("/api/v1/auth/register", { email: "admin@e2e.test", password: PASSWORD })).status < 300, true);
	admin = (await api.login("admin@e2e.test")).body.id;
	assert.ok(admin, "admin login returns a session token");
	await api.post("/api/v1/auth/admin/register", { email: "member@e2e.test", password: PASSWORD }, admin);
	const m = (await api.login("member@e2e.test")).body;
	member = m.id;
	memberId = m.userId;
	for (const box of [BOX, OTHER_BOX]) {
		const res = await api.post("/api/v1/mailboxes", { email: box, name: box }, admin);
		assert.equal(res.status, 201, JSON.stringify(res.body));
	}
});

after(async () => {
	await h?.stop();
});

describe("authentication and access", () => {
	test("API requires a login", async () => {
		assert.equal((await api.get("/api/v1/mailboxes")).status, 401);
		assert.equal((await api.get(emailsUrl(BOX))).status, 401);
	});

	test("wrong password is rejected", async () => {
		const res = await api.login("admin@e2e.test", "not-the-password");
		assert.ok(res.status === 401 || res.status === 400, `got ${res.status}`);
		assert.ok(!res.body?.id);
	});

	test("a member sees only mailboxes they were granted", async () => {
		assert.equal((await api.get(emailsUrl(BOX), member)).status, 403);
		const grant = await api.post("/api/v1/auth/admin/grant-access", { userId: memberId, mailboxId: BOX, role: "read" }, admin);
		assert.equal(grant.status, 200, JSON.stringify(grant.body));
		assert.equal((await api.get(emailsUrl(BOX), member)).status, 200);
		assert.equal((await api.get(emailsUrl(OTHER_BOX), member)).status, 403, "other mailbox stays closed");
		const mine = await api.get("/api/v1/mailboxes", member);
		assert.deepEqual(
			(mine.body as Array<{ id: string }>).map((m) => m.id),
			[BOX],
		);
	});

	test("revoking access closes the mailbox again", async () => {
		await api.post("/api/v1/auth/admin/revoke-access", { userId: memberId, mailboxId: BOX }, admin);
		assert.equal((await api.get(emailsUrl(BOX), member)).status, 403);
		await api.post("/api/v1/auth/admin/grant-access", { userId: memberId, mailboxId: BOX, role: "read" }, admin);
	});

	test("admin endpoints are closed to members", async () => {
		const res = await api.post("/api/v1/auth/admin/register", { email: "x@e2e.test", password: PASSWORD }, member);
		assert.ok(res.status === 403 || res.status === 401, `got ${res.status}`);
	});

	test("logout invalidates the session", async () => {
		await api.post("/api/v1/auth/admin/register", { email: "temp@e2e.test", password: PASSWORD }, admin);
		const token = (await api.login("temp@e2e.test")).body.id;
		assert.equal((await api.get("/api/v1/auth/me", token)).status, 200);
		await api.post("/api/v1/auth/logout", {}, token);
		assert.equal((await api.get("/api/v1/auth/me", token)).status, 401);
	});
});

describe("receiving mail", () => {
	test("inbound mail lands unread in the inbox", async () => {
		const before = (await unreadCount("inbox")) ?? 0;
		assert.equal(await receive({ from: "Jane <jane@dev.io>", to: BOX, subject: "Hello from Jane" }), 200);
		const inbox = await list("inbox");
		const row = inbox.find((e) => e.subject === "Hello from Jane");
		assert.ok(row, "message is listed");
		assert.equal(Boolean(row.read), false);
		assert.equal(await unreadCount("inbox"), before + 1);
	});

	test("marking read updates the unread count; starring is independent", async () => {
		const row = (await list("inbox")).find((e) => e.subject === "Hello from Jane")!;
		const before = (await unreadCount("inbox")) ?? 0;
		const read = await api.put(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}`, { read: true }, admin);
		assert.equal(read.status, 200);
		assert.equal(await unreadCount("inbox"), before - 1);
		const starred = await api.put(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}`, { starred: true }, admin);
		assert.equal(Boolean(starred.body.starred), true);
		assert.equal(Boolean(starred.body.read), true, "starring does not unread it");
	});

	test("updating an unknown email is a 404", async () => {
		const res = await api.put(`/api/v1/mailboxes/${enc(BOX)}/emails/does-not-exist`, { read: true }, admin);
		assert.equal(res.status, 404);
	});

	test("mail flagged as spam goes to Spam, not the inbox", async () => {
		await receive({ from: "promo@spam.io", to: BOX, subject: "WIN BIG", extraHeaders: ["X-Spam-Status: Yes, score=9"] });
		assert.ok(subjectsOf(await list("spam")).includes("WIN BIG"));
		assert.ok(!subjectsOf(await list("inbox")).includes("WIN BIG"));
	});

	test("failed DKIM/SPF also routes to Spam", async () => {
		await receive({
			from: "forged@bank.io",
			to: BOX,
			subject: "Verify your account",
			extraHeaders: ["Authentication-Results: mx.test; dkim=fail; spf=pass"],
		});
		assert.ok(subjectsOf(await list("spam")).includes("Verify your account"));
	});

	test("an attachment on inbound mail is stored and downloads byte-for-byte", async () => {
		const bytes = Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 7) % 256)); // includes bytes >= 0x80
		const raw = [
			"From: Files <files@dev.io>",
			`To: ${BOX}`,
			"Subject: With attachment",
			"Message-ID: <att1@dev.io>",
			"MIME-Version: 1.0",
			'Content-Type: multipart/mixed; boundary="B"',
			"",
			"--B",
			"Content-Type: text/plain",
			"",
			"see attached",
			"--B",
			'Content-Type: application/octet-stream; name="data.bin"',
			'Content-Disposition: attachment; filename="data.bin"',
			"Content-Transfer-Encoding: base64",
			"",
			bytes.toString("base64"),
			"--B--",
			"",
		].join("\r\n");
		assert.equal(await api.deliver(raw, "files@dev.io", BOX), 200);
		const row = (await list("inbox")).find((e) => e.subject === "With attachment")!;
		const full = (await api.get(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}`, admin)).body;
		assert.equal(full.attachments?.length, 1);
		const dl = await api.get(
			`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}/attachments/${full.attachments[0].id}`,
			admin,
		);
		assert.equal(dl.status, 200);
		assert.ok(Buffer.compare(dl.body as Buffer, bytes) === 0, "downloaded bytes equal the original");
	});
});

describe("sending mail", () => {
	test("a message is delivered per recipient and stored in Sent", async () => {
		const before = new Set(sentFiles());
		const res = await send({
			to: "dest@client.io",
			cc: "copy@client.io",
			bcc: "hidden@client.io",
			subject: "Quarterly update",
			html: "<p>Numbers attached</p>",
			text: "Numbers attached",
		});
		assert.equal(res.status, 201, JSON.stringify(res.body));
		const files = await waitForNewMessages(before, 3);
		assert.equal(files.length, 3, "one message per envelope recipient (to, cc, bcc)");
		for (const mime of files) {
			assert.ok(!/^bcc:/im.test(mime), "Bcc never appears in a header");
			assert.ok(!mime.includes("hidden@client.io"), "the bcc address is not exposed to other recipients");
			assert.match(mime, /^To: dest@client\.io/m);
		}
		const sent = (await list("sent")).find((e) => e.subject === "Quarterly update");
		assert.ok(sent, "appears in Sent");
	});

	test("rejects a message with no recipients, or no body", async () => {
		assert.equal((await send({ to: "", subject: "x", text: "x" })).status, 400);
		assert.equal((await send({ to: "a@b.io", subject: "x" })).status, 400, "needs html or text");
		assert.equal((await send({ to: "a@b.io", from: "not-an-email", subject: "x", text: "x" })).status, 400);
	});

	test("outbound attachments are stored byte-for-byte", async () => {
		const bytes = Buffer.from(Array.from({ length: 512 }, (_, i) => (i * 13 + 5) % 256));
		const res = await send({
			to: "dest@client.io",
			subject: "Report PDF",
			text: "attached",
			attachments: [{ filename: "r.bin", content: bytes.toString("base64"), type: "application/octet-stream", disposition: "attachment" }],
		});
		assert.equal(res.status, 201, JSON.stringify(res.body));
		const full = (await api.get(`/api/v1/mailboxes/${enc(BOX)}/emails/${res.body.id}`, admin)).body;
		const dl = await api.get(
			`/api/v1/mailboxes/${enc(BOX)}/emails/${res.body.id}/attachments/${full.attachments[0].id}`,
			admin,
		);
		assert.ok(Buffer.compare(dl.body as Buffer, bytes) === 0);
	});

	test("a failed send does not leave a phantom Sent message", async () => {
		const sentBefore = (await list("sent")).length;
		const res = await send({ to: "", subject: "nope", text: "x" });
		assert.equal(res.status, 400);
		assert.equal((await list("sent")).length, sentBefore);
	});
});

describe("drafts", () => {
	let draftId = "";

	test("saving a draft stores it in Drafts and sends nothing", async () => {
		const before = new Set(sentFiles());
		const res = await send({ to: "later@client.io", subject: "Draft one", text: "wip", is_draft: true });
		assert.equal(res.status, 201);
		assert.equal(res.body.status, "draft_saved");
		draftId = res.body.id;
		assert.ok(subjectsOf(await list("drafts")).includes("Draft one"));
		assert.ok(!subjectsOf(await list("sent")).includes("Draft one"));
		await new Promise((r) => setTimeout(r, 400));
		assert.equal(sentFiles().filter((f) => !before.has(f)).length, 0, "no email left the building");
	});

	test("re-saving with the same id updates in place", async () => {
		const res = await send({ to: "later@client.io", subject: "Draft one (edited)", text: "wip 2", is_draft: true, draft_id: draftId });
		assert.equal(res.body.id, draftId);
		const drafts = await list("drafts");
		assert.equal(drafts.filter((d) => d.id === draftId).length, 1);
		assert.equal(drafts.find((d) => d.id === draftId)!.subject, "Draft one (edited)");
	});

	test("deleting a draft removes it", async () => {
		assert.equal((await api.del(`/api/v1/mailboxes/${enc(BOX)}/emails/${draftId}`, admin)).status, 204);
		assert.ok(!(await list("drafts")).some((d) => d.id === draftId));
	});
});

describe("reply, forward and threading", () => {
	let originalId = "";

	test("a reply is threaded with the original", async () => {
		await receive({ from: "Cust <cust@client.io>", to: BOX, subject: "Question about pricing", messageId: "orig-1@client.io" });
		const original = (await list("inbox")).find((e) => e.subject === "Question about pricing")!;
		originalId = original.id;
		const before = new Set(sentFiles());
		const res = await api.post(
			`/api/v1/mailboxes/${enc(BOX)}/emails/${originalId}/reply`,
			{ from: BOX, to: "cust@client.io", subject: "Re: Question about pricing", text: "Here you go" },
			admin,
		);
		assert.equal(res.status, 201, JSON.stringify(res.body));
		const [mime] = await waitForNewMessages(before, 1);
		assert.match(mime, /^In-Reply-To: </m);
		const thread = (await api.get(`/api/v1/mailboxes/${enc(BOX)}/threads/${original.thread_id || original.id}`, admin)).body as Array<Record<string, any>>;
		assert.ok(thread.length >= 2, "thread has the original and the reply");
		assert.ok(thread.some((m) => m.subject === "Re: Question about pricing"));
	});

	test("replies and in-reply-to sends are not outreach: no unsubscribe link or footer", async () => {
		const before = new Set(sentFiles());
		await api.post(
			`/api/v1/mailboxes/${enc(BOX)}/emails/${originalId}/reply`,
			{ from: BOX, to: "cust@client.io", subject: "Re: Question about pricing", html: "<p>reply</p>", text: "reply" },
			admin,
		);
		await send({ to: "cust@client.io", subject: "Re: again", html: "<p>again</p>", text: "again", in_reply_to: "orig-1@client.io" });
		const sentMessages = await waitForNewMessages(before, 2);
		assert.equal(sentMessages.length, 2);
		for (const mime of sentMessages) {
			assert.ok(!/list-unsubscribe/i.test(mime), "no List-Unsubscribe header on a conversation");
			assert.ok(!/unsubscribe/i.test(mime), "no unsubscribe footer on a conversation");
		}
	});

	test("replying to a missing message is a 404", async () => {
		const res = await api.post(
			`/api/v1/mailboxes/${enc(BOX)}/emails/nope/reply`,
			{ from: BOX, to: "a@b.io", subject: "Re", text: "x" },
			admin,
		);
		assert.equal(res.status, 404);
	});

	test("forwarding sends and stores a forwarded copy", async () => {
		const res = await api.post(
			`/api/v1/mailboxes/${enc(BOX)}/emails/${originalId}/forward`,
			{ from: BOX, to: "colleague@e2e.test", subject: "Fwd: Question about pricing", text: "FYI" },
			admin,
		);
		assert.equal(res.status, 201, JSON.stringify(res.body));
		assert.ok(subjectsOf(await list("sent")).includes("Fwd: Question about pricing"));
	});
});

describe("folders, trash and delete", () => {
	test("moving to trash removes it from the inbox", async () => {
		await receive({ from: "x@dev.io", to: BOX, subject: "To be trashed" });
		const row = (await list("inbox")).find((e) => e.subject === "To be trashed")!;
		const mv = await api.post(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}/move`, { folderId: "trash" }, admin);
		assert.equal(mv.status, 200, JSON.stringify(mv.body));
		assert.ok(!subjectsOf(await list("inbox")).includes("To be trashed"));
		assert.ok(subjectsOf(await list("trash")).includes("To be trashed"));
	});

	test("moving to a folder that does not exist fails cleanly", async () => {
		const row = (await list("inbox"))[0];
		const mv = await api.post(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}/move`, { folderId: "no-such-folder" }, admin);
		assert.ok(mv.status === 400 || mv.status === 404, `got ${mv.status}`);
		assert.ok((await list("inbox")).some((e) => e.id === row.id), "message is still where it was");
	});

	test("permanent delete removes the message and its attachments", async () => {
		const row = (await list("inbox")).find((e) => e.subject === "With attachment")!;
		const full = (await api.get(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}`, admin)).body;
		const attUrl = `/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}/attachments/${full.attachments[0].id}`;
		assert.equal((await api.get(attUrl, admin)).status, 200);
		assert.equal((await api.del(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}`, admin)).status, 204);
		assert.equal((await api.get(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}`, admin)).status, 404);
		assert.equal((await api.get(attUrl, admin)).status, 404, "attachment is gone from storage");
	});

	test("deleting is idempotent: a second delete (double click, bulk retry) still succeeds", async () => {
		await receive({ from: "x@dev.io", to: BOX, subject: "Delete twice" });
		const row = (await list("inbox")).find((e) => e.subject === "Delete twice")!;
		assert.equal((await api.del(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}`, admin)).status, 204);
		assert.equal((await api.del(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}`, admin)).status, 204);
		assert.equal((await api.get(`/api/v1/mailboxes/${enc(BOX)}/emails/${row.id}`, admin)).status, 404);
	});

	test("custom folders can be created, renamed and deleted", async () => {
		const created = await api.post(`/api/v1/mailboxes/${enc(BOX)}/folders`, { name: "Leads" }, admin);
		assert.ok(created.status === 200 || created.status === 201, JSON.stringify(created.body));
		const id = created.body.id;
		const renamed = await api.put(`/api/v1/mailboxes/${enc(BOX)}/folders/${id}`, { name: "Hot Leads" }, admin);
		assert.equal(renamed.status, 200);
		assert.equal((await api.del(`/api/v1/mailboxes/${enc(BOX)}/folders/${id}`, admin)).status < 300, true);
	});
});

describe("pagination and search", () => {
	test("keyset paging walks every message exactly once, newest first", async () => {
		for (let i = 1; i <= 7; i++) {
			await receive({ from: "bulk@dev.io", to: BOX, subject: `Bulk ${String(i).padStart(2, "0")}` });
		}
		const seen: string[] = [];
		const ids = new Set<string>();
		let cursor = "";
		for (let page = 0; page < 20; page++) {
			const rows = await list("inbox", `&limit=3${cursor}`);
			if (rows.length === 0) break;
			for (const r of rows) {
				assert.ok(!ids.has(r.id), `duplicate ${r.id} across pages`);
				ids.add(r.id);
				if (String(r.subject).startsWith("Bulk ")) seen.push(r.subject);
			}
			const last = rows[rows.length - 1];
			cursor = `&before_date=${enc(last.date)}&before_id=${enc(last.id)}`;
			if (rows.length < 3) break;
		}
		assert.deepEqual(seen, ["Bulk 07", "Bulk 06", "Bulk 05", "Bulk 04", "Bulk 03", "Bulk 02", "Bulk 01"]);
	});

	test("search finds by subject and respects the folder", async () => {
		const res = await api.get(`/api/v1/mailboxes/${enc(BOX)}/search?query=${enc("Bulk 03")}`, admin);
		assert.equal(res.status, 200, JSON.stringify(res.body));
		assert.ok(subjectsOf(res.body).includes("Bulk 03"));
		const none = await api.get(`/api/v1/mailboxes/${enc(BOX)}/search?query=${enc("zzz-no-match-zzz")}`, admin);
		assert.equal((none.body as unknown[]).length, 0);
	});
});

describe("tracking", () => {
	// Pulls the rewritten, signed tracking links out of the MIME that was actually sent.
	const trackedLinks = (mime: string) =>
		[...mime.matchAll(/href="(https:\/\/mail\.reflect\.cloud\/api\/v1\/track\/click\/[^"]+)"/g)].map((m) => m[1].replace("https://mail.reflect.cloud", ""));

	test("open pixel and signed tracked link increment the counters", async () => {
		const before = new Set(sentFiles());
		const res = await send({ to: "track@client.io", subject: "Tracked", html: '<p><a href="https://example.com/page?a=1&amp;b=2">link</a></p>', text: "t" });
		const id = res.body.id;
		const [mime] = await waitForNewMessages(before, 1);
		const [link] = trackedLinks(mime);
		assert.ok(link, "link was rewritten to a tracked link");
		assert.match(link, /[?&]s=[A-Za-z0-9_-]+/, "tracked link is signed");
		const px = await api.get(`/api/v1/track/open/${enc(BOX)}/${id}`);
		assert.equal(px.status, 200);
		assert.equal(px.headers.get("content-type"), "image/gif");
		const click = await api.call("GET", link);
		assert.equal(click.status, 302);
		assert.equal(click.headers.get("location"), "https://example.com/page?a=1&b=2", "html entities in the href are decoded");
		const full = (await api.get(`/api/v1/mailboxes/${enc(BOX)}/emails/${id}`, admin)).body;
		assert.ok(full.opened_count >= 1);
		assert.ok(full.clicked_count >= 1);
	});

	test("click tracking is not an open redirect", async () => {
		const before = new Set(sentFiles());
		const res = await send({ to: "track2@client.io", subject: "Tracked 2", html: '<p><a href="https://example.com/ok">link</a></p>', text: "t" });
		const id = res.body.id;
		const [mime] = await waitForNewMessages(before, 1);
		const [link] = trackedLinks(mime);
		const sig = new URL(`https://x${link}`).searchParams.get("s");

		// A valid signature for one URL cannot be reused for another.
		const swapped = await api.call("GET", `/api/v1/track/click/${enc(BOX)}/${id}?url=${enc("https://evil.example.com/phish")}&s=${sig}`);
		assert.equal(swapped.status, 302);
		assert.ok(!String(swapped.headers.get("location")).includes("evil.example.com"));
		// ...nor for another message.
		const other = await api.call("GET", `/api/v1/track/click/${enc(BOX)}/other-id?url=${enc("https://example.com/ok")}&s=${sig}`);
		assert.ok(!String(other.headers.get("location") || "").includes("example.com/ok"));
		// Garbage signature.
		const bad = await api.call("GET", `/api/v1/track/click/${enc(BOX)}/${id}?url=${enc("https://evil.example.com/phish")}&s=AAAA`);
		assert.ok(!String(bad.headers.get("location")).includes("evil.example.com"));

		// Unsigned (legacy) links show the destination instead of redirecting.
		const legacy = await api.call("GET", `/api/v1/track/click/${enc(BOX)}/${id}?url=${enc("https://evil.example.com/phish")}`);
		assert.equal(legacy.status, 200);
		assert.equal(legacy.headers.get("location"), null);
		assert.match(String(legacy.body), /You are leaving this site/);
	});

	test("click tracking never redirects to non-http schemes", async () => {
		const res = await api.call("GET", `/api/v1/track/click/${enc(BOX)}/x?url=${enc("javascript:alert(1)")}`);
		assert.equal(res.status, 302);
		assert.ok(!String(res.headers.get("location")).startsWith("javascript:"));
	});

	test("tracking endpoints are public and never error for unknown ids", async () => {
		assert.equal((await api.get(`/api/v1/track/open/${enc(BOX)}/unknown-id`)).status, 200);
		assert.equal((await api.get(`/api/v1/track/open/ghost%40nowhere.io/unknown-id`)).status, 200);
	});
});

describe("outreach compliance", () => {
	test("new messages carry a working unsubscribe link; unsubscribing needs a POST", async () => {
		const before = new Set(sentFiles());
		await send({ to: "prospect@startup.io", subject: "Intro", html: "<p>Hi</p>", text: "Hi" });
		const [mime] = await waitForNewMessages(before, 1);
		const url = mime.match(/List-Unsubscribe: <https:\/\/mail\.reflect\.cloud(\/api\/v1\/unsubscribe\/[^>]+)>/)?.[1];
		assert.ok(url, "List-Unsubscribe header present");
		assert.match(mime, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
		const page = await api.get(url);
		assert.equal(page.status, 200);
		const check = async () =>
			(await api.post("/api/v1/suppressions/check", { emails: ["prospect@startup.io"] }, admin)).body.suppressed.length;
		assert.equal(await check(), 0, "a GET (mail scanner prefetch) must not unsubscribe");
		assert.equal((await api.get(`${url.slice(0, -3)}AAA`)).status, 400, "tampered token rejected");
		assert.equal((await api.call("POST", url, { raw: "List-Unsubscribe=One-Click", contentType: "application/x-www-form-urlencoded" })).status, 200);
		assert.equal(await check(), 1);
	});

	test("a hard bounce flags the sent message and suppresses the address; forged bounces are ignored", async () => {
		await send({ to: "gone@nowhere.io", subject: "Bounce me", text: "x" });
		const dsn = (rcpt: string) =>
			[
				"From: MAILER-DAEMON@mx.nowhere.io",
				`To: ${BOX}`,
				"Subject: Undelivered Mail Returned to Sender",
				`Message-ID: <dsn-${rcpt}@mx.nowhere.io>`,
				"MIME-Version: 1.0",
				"Content-Type: multipart/report; report-type=delivery-status; boundary=BND",
				"",
				"--BND",
				"Content-Type: text/plain",
				"",
				"Failed.",
				"",
				"--BND",
				"Content-Type: message/delivery-status",
				"",
				"Reporting-MTA: dns; mx.nowhere.io",
				"",
				`Final-Recipient: rfc822; ${rcpt}`,
				"Action: failed",
				"Status: 5.1.1",
				"",
				"--BND--",
				"",
			].join("\r\n");
		await api.deliver(dsn("gone@nowhere.io"), "MAILER-DAEMON@mx.nowhere.io", BOX);
		await api.deliver(dsn("never-contacted@elsewhere.io"), "MAILER-DAEMON@mx.nowhere.io", BOX);
		const hits = (await api.post("/api/v1/suppressions/check", { emails: ["gone@nowhere.io", "never-contacted@elsewhere.io"] }, admin)).body.suppressed;
		assert.deepEqual(hits.map((s: { email: string }) => s.email), ["gone@nowhere.io"]);
		const sent = (await list("sent")).find((e) => e.subject === "Bounce me")!;
		assert.equal(sent.delivery_status, "bounced");
	});
});

describe("security regressions", () => {
	test("push endpoints require a login and only accept real push services", async () => {
		assert.equal((await api.get("/api/v1/push/vapid-public-key")).status, 401);
		assert.equal((await api.post("/api/v1/push/subscribe", { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "a", auth: "b" } })).status, 401);
		const evil = await api.post("/api/v1/push/subscribe", { endpoint: "https://evil.example.com/x", keys: { p256dh: "a", auth: "b" } }, admin);
		assert.equal(evil.status, 400);
	});

	test("templates, follow-ups and the suppression list are login-gated; admin actions are admin-only", async () => {
		for (const p of ["/api/v1/templates", "/api/v1/followups/config", "/api/v1/suppressions"]) {
			assert.equal((await api.get(p)).status, 401, p);
		}
		assert.equal((await api.put("/api/v1/followups/config", { enabled: true }, member)).status, 403);
		assert.equal((await api.put("/api/v1/templates/pitch", { name: "n", body: "b", subject: "s" }, member)).status, 403);
		assert.equal((await api.del("/api/v1/suppressions/a@b.io", member)).status, 403);
	});

	test("the pipeline respects mailbox access", async () => {
		assert.equal((await api.get(`/api/v1/mailboxes/${enc(OTHER_BOX)}/pipeline`, member)).status, 403);
		assert.equal((await api.get(`/api/v1/mailboxes/${enc(BOX)}/pipeline`, member)).status, 200);
	});
});

describe("snooze and scheduled send", () => {
	test("snoozing hides an inbox email until woken or unsnoozed", async () => {
		await api.deliver(rawEmail({ from: "snoozer@sender.io", to: BOX, subject: "Snooze me please" }), "snoozer@sender.io", BOX);
		const inbox1 = await list("inbox");
		const msg = inbox1.find((e) => e.subject === "Snooze me please")!;
		assert.ok(msg, "delivered into inbox");

		// Validation errors
		const bad = await api.post(`/api/v1/mailboxes/${enc(BOX)}/emails/${msg.id}/snooze`, { until: "not-a-date" }, admin);
		assert.equal(bad.status, 400);

		// Snooze for 2 hours
		const twoHoursLater = new Date(Date.now() + 7_200_000).toISOString();
		const snoozedRes = await api.post(`/api/v1/mailboxes/${enc(BOX)}/emails/${msg.id}/snooze`, { until: twoHoursLater }, admin);
		assert.equal(snoozedRes.status, 200);

		// Disappears from inbox
		const inbox2 = await list("inbox");
		assert.ok(!inbox2.some((e) => e.id === msg.id), "hidden from inbox");

		// Appears in snoozed folder
		const snoozedList = await list("snoozed");
		assert.ok(snoozedList.some((e) => e.id === msg.id), "present in snoozed view");

		// Unsnooze
		const unsnoozeRes = await api.post(`/api/v1/mailboxes/${enc(BOX)}/emails/${msg.id}/snooze`, { until: null }, admin);
		assert.equal(unsnoozeRes.status, 200);

		const inbox3 = await list("inbox");
		assert.ok(inbox3.some((e) => e.id === msg.id), "back in inbox after unsnoozing");
	});

	test("scheduled sends stay in scheduled queue until sent or cancelled", async () => {
		const before = new Set(sentFiles());
		const twoHoursLater = new Date(Date.now() + 7_200_000).toISOString();

		// Create scheduled email via send endpoint
		const res = await send({
			to: "scheduled.rcpt@client.io",
			subject: "Scheduled Delivery Test",
			text: "Hello in the future",
			send_at: twoHoursLater,
		});
		assert.equal(res.status, 201);
		assert.equal(res.body.status, "scheduled");
		const id = res.body.id;

		// Not in regular drafts
		const drafts = await list("drafts");
		assert.ok(!drafts.some((e) => e.id === id), "excluded from regular drafts");

		// Present in scheduled view
		const scheduled = await list("scheduled");
		assert.ok(scheduled.some((e) => e.id === id), "present in scheduled view");

		// Nothing actually sent yet
		assert.equal(sentFiles().filter((f) => !before.has(f)).length, 0);

		// Send now
		const sendNowRes = await api.post(`/api/v1/mailboxes/${enc(BOX)}/emails/${id}/send-now`, {}, admin);
		assert.equal(sendNowRes.status, 200);

		// Now sent
		const [mime] = await waitForNewMessages(before, 1);
		assert.ok(mime.includes("Scheduled Delivery Test"));
		const sent = await list("sent");
		assert.ok(sent.some((e) => e.id === id), "moved to sent folder");
	});
});
