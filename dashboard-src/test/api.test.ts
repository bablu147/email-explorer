// Tests for what src/services/api.ts posts to the send endpoints. Run with `npm test` in
// dashboard-src; axios is replaced by ./stubs/axios, so nothing leaves the process.
//
// The server refuses any key it does not know (400). The api module therefore posts only the keys
// on its lists, and refuses a caller that passes anything else: the old composer posted
// `scheduled_at`, the key was ignored, and every "scheduled" message was sent at once.
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import api, { apiErrorMessage } from "@/services/api";
import { posted } from "./stubs/axios";

const BOX = "m@x.com";
const message = { to: "a@b.com", subject: "s", html: "<p>h</p>", text: "h" };

beforeEach(() => {
	posted.length = 0;
});

describe("a field the server does not accept", () => {
	test("is refused before any request, and the error names it", () => {
		let thrown: unknown;
		try {
			api.sendEmail(BOX, { ...message, scheduled_at: "2026-01-01T00:00:00.000Z" });
		} catch (e) {
			thrown = e;
		}
		assert.ok(thrown instanceof Error, "sendEmail with scheduled_at throws");
		assert.match(thrown.message, /scheduled_at/);
		assert.match(apiErrorMessage(thrown, "fallback"), /scheduled_at/, "and that message is what the user is shown");
		assert.equal(posted.length, 0);
	});

	test("the payload keys of the previous composer are refused on every send function", () => {
		assert.throws(() => api.replyToEmail(BOX, "id1", { ...message, from: BOX }), /"from"/);
		assert.throws(() => api.saveDraft(BOX, { ...message, mailboxId: BOX }), /"mailboxId"/);
		assert.throws(() => api.forwardEmail(BOX, "id1", { ...message, mailboxId: BOX }), /"mailboxId"/);
		assert.equal(posted.length, 0);
	});

	test("reply and forward always send: they take neither `send_at` nor `is_draft`", () => {
		assert.throws(() => api.replyToEmail(BOX, "id1", { ...message, send_at: "2026-01-01T00:00:00.000Z" }), /"send_at"/);
		assert.throws(() => api.forwardEmail(BOX, "id1", { ...message, is_draft: false }), /"is_draft"/);
		assert.equal(posted.length, 0);
	});
});

describe("what is posted", () => {
	test("a send: undefined values are left out, and client-only attachment fields are dropped quietly", async () => {
		await api.sendEmail(BOX, {
			...message,
			cc: undefined,
			bcc: "c@d.com",
			in_reply_to: undefined,
			thread_id: undefined,
			references: undefined,
			draft_id: "d1",
			is_draft: false,
			attachments: [{ filename: "f.png", content: "AAA", type: "image/png", size: 3, disposition: "inline", contentId: "<c1>", localUrl: "blob:x" }],
		});
		assert.deepEqual(posted, [
			{
				url: `/api/v1/mailboxes/${BOX}/emails`,
				body: {
					...message,
					bcc: "c@d.com",
					draft_id: "d1",
					is_draft: false,
					attachments: [{ content: "AAA", filename: "f.png", type: "image/png", disposition: "inline", contentId: "<c1>" }],
				},
			},
		]);
	});

	test("a scheduled reply: `send_at` and the threading fields go through", async () => {
		const scheduled = {
			...message,
			is_draft: false,
			send_at: "2026-10-05T10:00:00.000Z",
			in_reply_to: "orig",
			thread_id: "thr",
			references: ["r0", "orig"],
		};
		await api.sendEmail(BOX, { draft_id: undefined, ...scheduled });
		assert.deepEqual(posted[0].body, scheduled);
	});

	test("reply and forward go to their own routes and carry draft_id when there is one", async () => {
		await api.replyToEmail(BOX, "orig", { ...message, draft_id: "d2" });
		await api.forwardEmail(BOX, "orig", { ...message, draft_id: undefined });
		assert.deepEqual(posted, [
			{ url: `/api/v1/mailboxes/${BOX}/emails/orig/reply`, body: { ...message, draft_id: "d2" } },
			{ url: `/api/v1/mailboxes/${BOX}/emails/orig/forward`, body: message },
		]);
	});

	test("saveDraft always posts is_draft: true", async () => {
		await api.saveDraft(BOX, { draft_id: "d3", to: "", subject: "(No Subject)", html: "", text: "", cc: undefined, attachments: undefined, thread_id: "thr" });
		assert.deepEqual(posted[0].body, { draft_id: "d3", to: "", subject: "(No Subject)", html: "", text: "", thread_id: "thr", is_draft: true });
	});
});

describe("apiErrorMessage", () => {
	test("is the server's own sentence when there is one, else the fallback", () => {
		assert.equal(apiErrorMessage({ response: { data: { error: "Only an unsent draft can be moved to Drafts" } } }, "fallback"), "Only an unsent draft can be moved to Drafts");
		assert.equal(apiErrorMessage({ response: { data: { errors: [{ message: "Unrecognized key: scheduled_at" }] } } }, "fallback"), "Unrecognized key: scheduled_at");
		assert.equal(apiErrorMessage(new Error("Network Error"), "fallback"), "fallback");
	});
});
