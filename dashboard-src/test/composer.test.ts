// Tests for the composer (src/components/ComposeEmail.vue). Run with `npm test` in dashboard-src;
// test/run.mjs explains how the component gets here.
//
// The component's real <script setup> runs in Node, with the api, toast and router modules replaced
// by the stubs in ./stubs. Nothing is rendered: a test calls setup() as Vue does when Mailbox.vue
// mounts the composer, then reads and drives the refs and functions it returns.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import Composer from "@/components/ComposeEmail.vue";
import { useMailboxStore } from "@/stores/mailboxes";
import { useUIStore } from "@/stores/ui";
import { calls, handlers } from "./stubs/api";
import { toasts } from "./stubs/toast";

const ME = "me@reflect.cloud";
const TOMORROW = "2026-10-06T09:00:00.000Z";

// The two browser APIs the composer uses outside a template. This DOMParser is as inert as the real
// one: it only ever returns text.
(globalThis as any).DOMParser = class {
	parseFromString(markup: string) {
		return { body: { textContent: markup.replace(/<[^>]+>/g, "") } };
	}
};
(globalThis as any).FileReader = class {
	result: string | null = null;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	readAsDataURL(blob: Blob) {
		blob.arrayBuffer().then((buf) => {
			this.result = `data:application/octet-stream;base64,${Buffer.from(buf).toString("base64")}`;
			this.onload?.();
		});
	}
};

/** Lets watchers, nextTick callbacks and already-settled promises run. */
const flush = async () => {
	for (let i = 0; i < 10; i++) {
		await nextTick();
		await Promise.resolve();
	}
};
/** Moves the (mocked) clock forward, e.g. past the 2 s autosave delay. */
const wait = async (ms: number) => {
	mock.timers.tick(ms);
	await flush();
};
const defer = <T = any>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};
const callsOf = (name: string) => calls.filter((c) => c.name === name);
const payloadOf = (name: string, index = 0) => callsOf(name)[index]?.args[1];

let consoleError: ReturnType<typeof mock.method>;
const loggedErrors = () => consoleError.mock.calls.map((call) => String(call.arguments[0]));

beforeEach(() => {
	calls.length = 0;
	for (const name of Object.keys(handlers)) delete handlers[name];
	handlers.listAppBindings = async () => ({ data: [] });
	// The autosave delay and the undo countdown run on this clock, so no test waits in real time.
	mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
	consoleError = mock.method(console, "error", () => {});
});

afterEach(() => {
	const errors = loggedErrors();
	mock.timers.reset();
	mock.restoreAll();
	// In production Vue logs an error thrown inside a watcher and carries on, so a broken composer
	// shows up here and nowhere else.
	assert.deepEqual(errors, [], "nothing was logged with console.error");
});

/** A fresh composer, opened the way the app opens it: the store is set first, then it is mounted. */
const mount = async (options: any) => {
	setActivePinia(createPinia());
	const ui = useUIStore();
	useMailboxStore().currentMailbox = {
		id: ME,
		email: ME,
		name: "Me",
		settings: { signature: { enabled: true, text: "Sig", html: "<b>SIGNATURE</b>" } },
	} as any;
	ui.openComposeModal(options);
	const c: any = (Composer as any).setup({}, { expose() {}, emit() {}, attrs: {}, slots: {} });
	await flush();
	return { c, ui };
};

/** A message in the Inbox, as the list and the reader hand it to the composer. */
const received = (over: Record<string, unknown> = {}) => ({
	id: "orig-1",
	folder_id: "inbox",
	sender: "Alice <alice@x.com>",
	recipient: ME,
	cc: "bob@y.com",
	subject: "Hello",
	date: "2026-10-01T10:00:00.000Z",
	body: "<p>hi</p>",
	thread_id: "thread-1",
	email_references: JSON.stringify(["root-0"]),
	...over,
});

const draftRow = (over: Record<string, unknown> = {}) => ({
	id: "draft-1",
	folder_id: "drafts",
	sender: ME,
	recipient: "a@b.com",
	subject: "S",
	body: "x",
	thread_id: "draft-1",
	...over,
});

describe("the composer opens filled in", () => {
	// What this guards: the watcher that fills the composer runs immediately, during setup. It once
	// sat above the declarations it uses (initComposer, draftLoadSeq, commitSendImmediately, ...), so
	// it threw "Cannot access 'initComposer' before initialization". Vue logged that and went on, and
	// every Reply, Forward and draft opened empty in production.
	test("Reply: addressed to the sender, with the original quoted, and no error on the way", async () => {
		const original = received();
		const { c, ui } = await mount({ mode: "reply", originalEmail: original });
		assert.deepEqual(loggedErrors(), []);
		assert.equal(ui.isComposeModalOpen, true);
		assert.equal(c.modalTitle.value, "Reply to Message");
		assert.equal(c.to.value, "Alice <alice@x.com>");
		assert.equal(c.cc.value, "");
		assert.equal(c.subject.value, "Re: Hello");
		assert.match(c.body.value, /<blockquote[^>]*>On 2026-10-01T10:00:00\.000Z, .* wrote:/);
		assert.ok(c.body.value.includes(original.body), "the original is quoted");
		assert.ok(c.body.value.includes("<b>SIGNATURE</b>"), "the signature is added");
		assert.ok(c.body.value.indexOf("SIGNATURE") < c.body.value.indexOf("<blockquote"), "above the quote");
		assert.equal(c.currentDraftId.value, null);
		assert.equal(c.isDirty.value, false, "opening is not an edit");
	});

	test("Reply all, Forward and a new message are filled in too", async () => {
		const original = received();

		const all = (await mount({ mode: "reply-all", originalEmail: original })).c;
		assert.equal(all.to.value, "Alice <alice@x.com>");
		assert.equal(all.cc.value, "bob@y.com", "everyone else on the original, never this mailbox");
		assert.equal(all.showCc.value, true);
		assert.equal(all.subject.value, "Re: Hello");
		assert.ok(all.body.value.includes(original.body));

		const forward = (await mount({ mode: "forward", originalEmail: original })).c;
		assert.equal(forward.to.value, "");
		assert.equal(forward.subject.value, "Fwd: Hello");
		assert.match(forward.body.value, /Forwarded message/);
		assert.ok(forward.body.value.includes(original.body));

		const fresh = (await mount({ mode: "new", initialTo: "lead@corp.com", initialSubject: "Hi", initialBody: "<p>Pitch</p>" })).c;
		assert.equal(fresh.to.value, "lead@corp.com");
		assert.equal(fresh.subject.value, "Hi");
		assert.match(fresh.body.value, /^<p>Pitch<\/p>.*SIGNATURE/);
	});
});

describe("text extraction from a received email", () => {
	test("markup is never parsed in the page: an <img onerror> in a quoted email does not run", async () => {
		// In a browser, markup assigned to innerHTML of an element of the page is live even while the
		// element is detached: <img src=x onerror=...> runs, next to the session token. This document
		// behaves the same way. A DOMParser document runs nothing, so that is what the composer must use.
		const globals = globalThis as any;
		globals.document = {
			createElement: () => {
				const element: Record<string, unknown> = { textContent: "" };
				Object.defineProperty(element, "innerHTML", {
					set(markup: string) {
						for (const [, handler] of String(markup).matchAll(/\sonerror="([^"]*)"/g)) new Function(handler)();
						element.textContent = String(markup).replace(/<[^>]+>/g, "");
					},
				});
				return element;
			},
		};
		try {
			const hostile = '<img src=x onerror="globalThis.__x=1">';
			const { c } = await mount({ mode: "reply", originalEmail: received({ body: `<p>Click</p>${hostile}` }) });
			assert.ok(c.body.value.includes(hostile), "the quote in the editor is the original markup");

			assert.equal(c.htmlToPlainText(hostile), "");
			assert.equal(c.htmlToPlainText(`<p>Hello</p>${hostile}<div>there<br>friend</div>`), "Hello\n\nthere\nfriend");
			assert.equal(globals.__x, undefined, "htmlToPlainText ran nothing");

			// Every path that derives the text part from the body: draft save, schedule, send.
			handlers.saveDraft = async () => ({ data: { id: "d-1" } });
			await c.manualSaveDraft();
			assert.match(payloadOf("saveDraft").text, /Click/);
			handlers.sendEmail = () => Promise.reject({ response: { status: 400, data: { error: "refused" } } });
			await c.handleScheduleSend(TOMORROW);
			assert.equal(callsOf("sendEmail").length, 1);
			await c.triggerSendFlow(false);
			assert.ok(c.pendingSend.value, "queued to send");
			assert.match(c.pendingSend.value.payload.text, /Click/);
			assert.equal(globals.__x, undefined, "saving, scheduling and sending ran nothing");
		} finally {
			delete globals.document;
			delete globals.__x;
		}
	});
});

describe("who a reply goes to", () => {
	test("mail in Inbox or Spam that names this mailbox as its sender is answered to that sender, not to its To header", async () => {
		const spoof = received({ sender: ME, recipient: "victim@evil.example", cc: null });
		assert.equal((await mount({ mode: "reply", originalEmail: spoof })).c.to.value, ME);
		assert.equal((await mount({ mode: "reply", originalEmail: { ...spoof, folder_id: "spam" } })).c.to.value, ME);
	});

	test("a message this mailbox sent is answered to its recipient: by folder, or by sender where the folder says nothing", async () => {
		const ours = received({ sender: ME, recipient: "lead@corp.com", cc: null });
		for (const folder_id of ["sent", "archive", undefined]) {
			const { c } = await mount({ mode: "reply", originalEmail: { ...ours, folder_id } });
			assert.equal(c.to.value, "lead@corp.com", String(folder_id));
		}
	});
});

describe("do-not-contact check before sending", () => {
	const listed = (...entries: Array<[string, string]>) => async () => ({
		data: { suppressed: entries.map(([email, reason]) => ({ email, reason })) },
	});

	test("reply all: a listed third party in Cc stops the send, and there is no Send anyway", async () => {
		const { c, ui } = await mount({ mode: "reply-all", originalEmail: received() });
		handlers.checkSuppressions = listed(["bob@y.com", "unsubscribe"], ["alice@x.com", "unsubscribe"]);
		await c.triggerSendFlow(false);
		assert.deepEqual(c.suppressionWarning.value, [{ email: "bob@y.com", reason: "unsubscribe" }], "only the blocking address is listed");
		assert.equal(c.suppressionBlocksSend.value, true);
		assert.equal(c.pendingSend.value, null);
		assert.equal(ui.isComposeModalOpen, true);
		assert.equal(c.isCheckingSuppression.value, false);
	});

	test("reply: the sender being answered unsubscribed, and the reply goes out without a dialog", async () => {
		const { c, ui } = await mount({ mode: "reply", originalEmail: received() });
		handlers.checkSuppressions = listed(["alice@x.com", "unsubscribe"]);
		await c.triggerSendFlow(false);
		assert.equal(c.suppressionWarning.value, null);
		assert.ok(c.pendingSend.value);
		assert.equal(ui.isComposeModalOpen, false);
	});

	test("reply: the sender being answered bounced before, so there is a warning with Send anyway", async () => {
		const { c, ui } = await mount({ mode: "reply", originalEmail: received() });
		handlers.checkSuppressions = listed(["alice@x.com", "bounce"]);
		await c.triggerSendFlow(false);
		assert.deepEqual(c.suppressionWarning.value, [{ email: "alice@x.com", reason: "bounce" }]);
		assert.equal(c.suppressionBlocksSend.value, false);
		assert.equal(ui.isComposeModalOpen, true);
		c.sendAnywayDespiteSuppression();
		await flush();
		assert.ok(c.pendingSend.value);
		assert.equal(callsOf("checkSuppressions").length, 1, "Send anyway does not check again");
	});

	test("a follow-up on our own message, a new message and a forward: any listed address stops the send", async () => {
		const sent = received({ folder_id: "sent", sender: ME, recipient: "lead@corp.com", cc: null });
		for (const options of [
			{ mode: "reply", originalEmail: sent },
			{ mode: "new", initialTo: "lead@corp.com" },
			{ mode: "forward", originalEmail: received() },
		]) {
			const { c } = await mount(options);
			handlers.checkSuppressions = listed(["lead@corp.com", "bounce"]);
			c.to.value = "lead@corp.com";
			await c.triggerSendFlow(false);
			assert.equal(c.suppressionBlocksSend.value, true, options.mode);
			assert.equal(c.suppressionWarning.value?.length, 1, options.mode);
			assert.equal(c.pendingSend.value, null, options.mode);
		}
	});

	test("stopped by the dialog: what was typed is still autosaved", async () => {
		const { c } = await mount({ mode: "new", initialTo: "lead@corp.com", initialSubject: "Hi" });
		c.body.value = "<p>typed</p>";
		await flush();
		handlers.checkSuppressions = listed(["lead@corp.com", "manual"]);
		handlers.saveDraft = async () => ({ data: { id: "d-1" } });
		await c.triggerSendFlow(false);
		assert.equal(c.suppressionBlocksSend.value, true);
		assert.equal(callsOf("saveDraft").length, 0);
		await wait(2300);
		assert.equal(callsOf("saveDraft").length, 1);
	});
});

describe("a send that outlives its composer", () => {
	test("closed while the check is still running: nothing is sent and the composer opened since stays open", async () => {
		const { c, ui } = await mount({ mode: "reply", originalEmail: received() });
		const check = defer();
		handlers.checkSuppressions = () => check.promise;
		const flow = c.triggerSendFlow(false);
		await flush();
		assert.equal(c.isCheckingSuppression.value, true, "Send is off while checking");
		c.forceCloseModal();
		ui.openComposeModal({ mode: "new", initialTo: "new@person.com" });
		await flush();
		check.resolve({ data: { suppressed: [] } });
		await flow;
		await flush();
		assert.equal(ui.isComposeModalOpen, true, "the new composer stays open");
		assert.equal(c.pendingSend.value, null, "nothing queued from the closed composer");
		assert.equal(c.isUndoPending.value, false);
		assert.equal(c.to.value, "new@person.com");
	});

	test("a second Send while the check runs is ignored", async () => {
		const { c } = await mount({ mode: "reply", originalEmail: received() });
		const check = defer();
		handlers.checkSuppressions = () => check.promise;
		const first = c.triggerSendFlow(false);
		await c.triggerSendFlow(false);
		assert.equal(callsOf("checkSuppressions").length, 1);
		check.resolve({ data: { suppressed: [] } });
		await first;
		assert.ok(c.pendingSend.value);
	});

	test("Save draft and close while the check runs: the text is saved and the send does not go on", async () => {
		const { c, ui } = await mount({ mode: "reply", originalEmail: received() });
		c.body.value = "<p>my answer</p>";
		await flush();
		const check = defer();
		handlers.checkSuppressions = () => check.promise;
		handlers.saveDraft = async () => ({ data: { id: "d-saved" } });
		const flow = c.triggerSendFlow(false);
		await flush();
		c.requestCloseModal();
		assert.equal(c.showDirtyModal.value, true, "closing during the check is possible");
		await c.saveDraftAndClose();
		assert.equal(callsOf("saveDraft").length, 1);
		assert.match(payloadOf("saveDraft").html, /my answer/);
		assert.equal(ui.isComposeModalOpen, false);
		check.resolve({ data: { suppressed: [] } });
		await flow;
		assert.equal(c.pendingSend.value, null);
		assert.equal(c.isUndoPending.value, false);
	});

	test("a send the server refuses comes back into the composer with the server's reason and the text", async () => {
		const { c, ui } = await mount({ mode: "reply", originalEmail: received() });
		c.body.value = "<p>my answer</p>";
		await flush();
		const refusal = '"bob" is not a valid email address. Correct it to send the message.';
		handlers.replyToEmail = () => Promise.reject({ response: { status: 400, data: { error: refusal } } });
		await c.triggerSendFlow(false);
		c.commitSendImmediately();
		await flush();
		assert.equal(ui.isComposeModalOpen, true, "reopened");
		assert.equal(c.error.value, refusal);
		assert.equal(c.body.value, "<p>my answer</p>");
		assert.equal(c.to.value, "Alice <alice@x.com>");
		assert.equal(c.isDirty.value, true, "closing asks before discarding it");
	});
});

describe("reply and forward", () => {
	test("the autosaved draft is named in the request and never deleted from here", async () => {
		for (const mode of ["reply", "forward"]) {
			calls.length = 0;
			const { c } = await mount({ mode, originalEmail: received() });
			c.to.value = "alice@x.com";
			c.currentDraftId.value = "draft-7";
			await c.triggerSendFlow(false);
			c.commitSendImmediately();
			await flush();
			const [call] = callsOf(mode === "forward" ? "forwardEmail" : "replyToEmail");
			assert.ok(call, mode);
			assert.equal(call.args[1], "orig-1");
			assert.equal(call.args[2].draft_id, "draft-7");
			assert.deepEqual(
				Object.keys(call.args[2]).filter((key) => ["mailboxId", "from", "is_draft", "send_at"].includes(key)),
				[],
				"no key the reply and forward routes refuse",
			);
			assert.equal(callsOf("deleteEmail").length, 0);
			assert.equal(callsOf("sendEmail").length, 0);
		}
	});
});

describe("scheduled send", () => {
	const SEND_KEYS = ["to", "cc", "bcc", "subject", "html", "text", "attachments", "in_reply_to", "references", "thread_id", "draft_id", "is_draft", "send_at"];

	test("a scheduled reply carries the threading the reply route would derive, under `send_at`", async () => {
		const { c, ui } = await mount({ mode: "reply-all", originalEmail: received() });
		await c.handleScheduleSend(TOMORROW);
		const payload = payloadOf("sendEmail");
		assert.equal(payload.send_at, TOMORROW);
		assert.equal(payload.is_draft, false);
		assert.equal(payload.in_reply_to, "orig-1");
		assert.equal(payload.thread_id, "thread-1");
		assert.deepEqual(payload.references, ["root-0", "orig-1"]);
		assert.equal(payload.cc, "bob@y.com");
		for (const key of Object.keys(payload)) assert.ok(SEND_KEYS.includes(key), `unexpected key ${key}`);
		assert.equal(ui.isComposeModalOpen, false);
	});

	test("a scheduled reply to a message with no thread starts one from that message", async () => {
		const { c } = await mount({ mode: "reply", originalEmail: received({ thread_id: null, email_references: null }) });
		await c.handleScheduleSend(TOMORROW);
		const payload = payloadOf("sendEmail");
		assert.equal(payload.in_reply_to, "orig-1");
		assert.equal(payload.thread_id, "orig-1");
		assert.deepEqual(payload.references, ["orig-1"]);
	});

	test("a scheduled new message carries no threading", async () => {
		const { c } = await mount({ mode: "new", initialTo: "lead@corp.com", initialSubject: "Hi" });
		await c.handleScheduleSend(TOMORROW);
		const payload = payloadOf("sendEmail");
		for (const key of ["in_reply_to", "thread_id", "references"]) assert.ok(!(key in payload), key);
	});

	test("no draft save runs while the schedule request is in flight, or after it", async () => {
		const { c, ui } = await mount({ mode: "new", initialTo: "lead@corp.com", initialSubject: "Hi" });
		c.currentDraftId.value = "draft-9";
		c.body.value = "<p>typed</p>";
		await flush(); // the field watcher arms the 2 s autosave
		assert.equal(c.isDirty.value, true);
		const request = defer();
		handlers.sendEmail = () => request.promise;
		const flow = c.handleScheduleSend(TOMORROW);
		await flush();
		c.subject.value = "Hi again"; // typing while the request is in flight arms the timer again
		await flush();
		await wait(2300);
		assert.equal(callsOf("saveDraft").length, 0, "no draft save while scheduling");
		c.requestCloseModal();
		assert.equal(ui.isComposeModalOpen, true, "closing is ignored while the request is in flight");
		assert.equal(c.showDirtyModal.value, false);
		request.resolve({ data: { id: "draft-9", status: "scheduled" } });
		await flow;
		assert.equal(payloadOf("sendEmail").draft_id, "draft-9");
		assert.equal(ui.isComposeModalOpen, false);
		await wait(2300);
		assert.equal(callsOf("saveDraft").length, 0, "and none after the composer closed");
	});

	test("scheduling waits for a draft save that is already running, then names the draft it created", async () => {
		const { c } = await mount({ mode: "new", initialTo: "lead@corp.com", initialSubject: "Hi" });
		const save = defer();
		handlers.saveDraft = () => save.promise;
		const manual = c.manualSaveDraft();
		await flush();
		const flow = c.handleScheduleSend(TOMORROW);
		await flush();
		assert.equal(callsOf("sendEmail").length, 0, "not posted before the save is back");
		save.resolve({ data: { id: "draft-new" } });
		await manual;
		await flow;
		assert.equal(payloadOf("sendEmail").draft_id, "draft-new");
	});

	test("a refused schedule keeps the message, shows the server's reason, and leaves the composer usable", async () => {
		const { c, ui } = await mount({ mode: "new", initialTo: "lead@corp.com", initialSubject: "Hi" });
		const refusal = "lead@corp.com is on the do-not-contact list. Remove this address to send the message.";
		handlers.sendEmail = () => Promise.reject({ response: { status: 422, data: { error: refusal } } });
		await c.handleScheduleSend(TOMORROW);
		assert.equal(ui.isComposeModalOpen, true);
		assert.equal(c.error.value, refusal);
		assert.equal(c.to.value, "lead@corp.com");
		assert.equal(c.isLoading.value, false);
		delete handlers.sendEmail;
		handlers.saveDraft = async () => ({ data: { id: "d1" } });
		await c.manualSaveDraft();
		assert.equal(callsOf("saveDraft").length, 1);
		await c.triggerSendFlow(false);
		assert.ok(c.pendingSend.value);
		assert.equal(c.pendingSend.value.snapshot.currentDraftId, "d1");
	});

	test("the Send shortcut while a schedule request is in flight does nothing", async () => {
		const { c } = await mount({ mode: "new", initialTo: "lead@corp.com", initialSubject: "Hi" });
		const request = defer();
		handlers.sendEmail = () => request.promise;
		const flow = c.handleScheduleSend(TOMORROW);
		await flush();
		await c.triggerSendFlow(false);
		assert.equal(callsOf("checkSuppressions").length, 0);
		assert.equal(c.pendingSend.value, null);
		request.resolve({ data: {} });
		await flow;
		assert.equal(callsOf("sendEmail").length, 1);
	});
});

describe("autosave and Send", () => {
	test("Send waits for a running draft save and replaces the draft it created; nothing is saved after Send", async () => {
		const { c } = await mount({ mode: "new", initialTo: "lead@corp.com", initialSubject: "Hi" });
		const save = defer();
		handlers.saveDraft = () => save.promise;
		c.body.value = "<p>typed</p>";
		await flush();
		const manual = c.manualSaveDraft();
		await flush();
		const flow = c.triggerSendFlow(false);
		await flush();
		assert.equal(c.pendingSend.value, null);
		save.resolve({ data: { id: "draft-new" } });
		await manual;
		await flow;
		assert.equal(c.pendingSend.value.snapshot.currentDraftId, "draft-new");
		c.commitSendImmediately();
		await flush();
		const payload = payloadOf("sendEmail");
		assert.equal(payload.draft_id, "draft-new");
		assert.equal(payload.is_draft, false);
		await wait(2300);
		assert.equal(callsOf("saveDraft").length, 1, "the timer armed by typing did not save after Send");
	});

	test("a draft that was scheduled or sent elsewhere (409) is not overwritten: the text is saved as a new draft", async () => {
		const { c } = await mount({ mode: "new", initialTo: "lead@corp.com", initialSubject: "Hi" });
		c.currentDraftId.value = "draft-old";
		handlers.saveDraft = (_mailbox: string, payload: any) =>
			payload.draft_id
				? Promise.reject({ response: { status: 409, data: { error: "This message is scheduled to be sent. Cancel the schedule to edit it." } } })
				: Promise.resolve({ data: { id: "draft-new" } });
		await c.manualSaveDraft();
		assert.equal(callsOf("saveDraft").length, 2);
		assert.equal(payloadOf("saveDraft", 0).draft_id, "draft-old");
		assert.ok(!("draft_id" in payloadOf("saveDraft", 1)), "the second save names no draft");
		assert.equal(c.currentDraftId.value, "draft-new");
	});
});

describe("a draft reopened from Drafts", () => {
	test("opens as that draft: Cc and Bcc restored, no second signature, sent with its id and its thread", async () => {
		const draft = draftRow({
			recipient: "lead@corp.com",
			cc: "boss@corp.com",
			bcc: "audit@reflect.cloud",
			subject: "Following up",
			body: "<p>draft body</p><b>SIGNATURE</b>",
			date: "2026-10-01T10:00:00.000Z",
			thread_id: "thread-outreach",
			in_reply_to: null,
			email_references: null,
		});
		handlers.getEmail = async () => ({ data: { ...draft, attachments: [] } });
		const { c } = await mount({ mode: "draft", originalEmail: draft });
		assert.equal(c.modalTitle.value, "Edit Draft");
		assert.equal(c.to.value, "lead@corp.com");
		assert.equal(c.cc.value, "boss@corp.com");
		assert.equal(c.bcc.value, "audit@reflect.cloud");
		assert.equal(c.showCc.value && c.showBcc.value, true);
		assert.equal(c.body.value, draft.body, "the body as stored");
		assert.equal(c.currentDraftId.value, "draft-1");
		assert.equal(c.isDirty.value, false);
		assert.equal(callsOf("getEmail").length, 1, "its attachments are looked up");
		await c.triggerSendFlow(false);
		c.commitSendImmediately();
		await flush();
		const payload = payloadOf("sendEmail");
		assert.equal(payload.draft_id, "draft-1");
		assert.equal(payload.is_draft, false);
		assert.equal(payload.cc, "boss@corp.com");
		assert.equal(payload.bcc, "audit@reflect.cloud");
		assert.equal(payload.thread_id, "thread-outreach");
		assert.ok(!("in_reply_to" in payload) && !("references" in payload));
		assert.equal(callsOf("replyToEmail").length + callsOf("forwardEmail").length + callsOf("deleteEmail").length, 0);
	});

	test("a plain draft sends no threading; a draft that is a reply keeps its in_reply_to on save", async () => {
		const plain = draftRow({ id: "draft-2", thread_id: "draft-2", subject: "(No Subject)" });
		handlers.getEmail = async () => ({ data: { ...plain, attachments: [] } });
		const first = (await mount({ mode: "draft", originalEmail: plain })).c;
		assert.equal(first.subject.value, "");
		await first.triggerSendFlow(false);
		first.commitSendImmediately();
		await flush();
		for (const key of ["in_reply_to", "thread_id", "references"]) assert.ok(!(key in payloadOf("sendEmail")), key);

		const reply = draftRow({ id: "draft-3", in_reply_to: "orig-1", thread_id: "thread-1", email_references: JSON.stringify(["root-0", "orig-1"]) });
		handlers.getEmail = async () => ({ data: { ...reply, attachments: [] } });
		handlers.saveDraft = async () => ({ data: { id: "draft-3" } });
		const second = (await mount({ mode: "draft", originalEmail: reply })).c;
		await second.manualSaveDraft();
		const saved = payloadOf("saveDraft");
		assert.equal(saved.draft_id, "draft-3");
		assert.equal(saved.in_reply_to, "orig-1");
		assert.equal(saved.thread_id, "thread-1");
		assert.deepEqual(saved.references, ["root-0", "orig-1"]);
	});

	test("Send and saves wait while its attachments are still loading", async () => {
		const draft = draftRow({ id: "draft-4" });
		const meta = defer();
		handlers.getEmail = () => meta.promise;
		handlers.saveDraft = async () => ({ data: { id: "draft-4" } });
		const { c } = await mount({ mode: "draft", originalEmail: draft });
		assert.equal(c.isLoadingDraftAttachments.value, true);
		await c.triggerSendFlow(false); // the keyboard shortcut; the button is off
		assert.match(c.error.value, /still loading/);
		assert.equal(c.pendingSend.value, null);
		const manual = c.manualSaveDraft();
		await flush();
		assert.equal(callsOf("saveDraft").length, 0, "the save waits for the attachments");
		meta.resolve({ data: { ...draft, attachments: [] } });
		await manual;
		assert.equal(callsOf("saveDraft").length, 1);
		assert.equal(c.isLoadingDraftAttachments.value, false);
	});

	test("its files are loaded before Send is possible and go out with the message", async () => {
		const draft = draftRow({ id: "draft-5" });
		handlers.getEmail = async () => ({
			data: { ...draft, attachments: [{ id: "att-1", filename: "deck.pdf", mimetype: "application/pdf", size: 3, disposition: "attachment" }] },
		});
		handlers.getAttachment = async () => ({ data: new Blob(["abc"]) });
		const { c } = await mount({ mode: "draft", originalEmail: draft });
		await c.draftAttachmentsLoad;
		assert.equal(c.isLoadingDraftAttachments.value, false);
		assert.equal(c.attachments.value.length, 1);
		await c.triggerSendFlow(false);
		c.commitSendImmediately();
		await flush();
		const payload = payloadOf("sendEmail");
		assert.equal(payload.draft_id, "draft-5");
		assert.equal(payload.attachments.length, 1);
		assert.equal(payload.attachments[0].filename, "deck.pdf");
		assert.equal(payload.attachments[0].content, Buffer.from("abc").toString("base64"));
	});

	test("a reply saved as a draft keeps its threading, so it is still a reply when sent from Drafts", async () => {
		handlers.saveDraft = async () => ({ data: { id: "draft-r" } });
		const { c } = await mount({ mode: "reply", originalEmail: received() });
		c.body.value = "<p>half-written answer</p>";
		await flush(); // the field watcher starts the autosave timer
		await wait(2500);
		const saved = payloadOf("saveDraft");
		assert.equal(saved.in_reply_to, "orig-1");
		assert.equal(saved.thread_id, "thread-1");
		assert.deepEqual(saved.references, ["root-0", "orig-1"]);

		calls.length = 0;
		const fresh = (await mount({ mode: "new" })).c;
		fresh.to.value = "x@y.com";
		await flush();
		await wait(2500);
		for (const key of ["in_reply_to", "thread_id", "references"]) assert.ok(!(key in payloadOf("saveDraft")), `${key} on a new message's draft`);
	});

	test("is filled from the stored draft, not from a list row that is older than the last autosave", async () => {
		// The list still shows the draft as it was before the last edit: a recipient since removed, old text.
		const staleRow = draftRow({ id: "draft-6", recipient: "a@b.com, removed@b.com", subject: "Old subject", body: "<p>old</p>" });
		const stored = { ...staleRow, recipient: "a@b.com", cc: "new-cc@b.com", subject: "New subject", body: "<p>newer text</p>", attachments: [] };
		handlers.getEmail = async () => ({ data: stored });
		handlers.saveDraft = async () => ({ data: { id: "draft-6" } });
		const { c } = await mount({ mode: "draft", originalEmail: staleRow });
		await c.draftAttachmentsLoad;
		assert.equal(c.to.value, "a@b.com");
		assert.equal(c.cc.value, "new-cc@b.com");
		assert.equal(c.showCc.value, true);
		assert.equal(c.subject.value, "New subject");
		assert.equal(c.body.value, "<p>newer text</p>");
		assert.equal(c.isDirty.value, false, "loading it is not an edit");
		await wait(2500);
		assert.equal(callsOf("saveDraft").length, 0, "and does not trigger a save");

		await c.triggerSendFlow(false);
		c.commitSendImmediately();
		await flush();
		const payload = payloadOf("sendEmail");
		assert.equal(payload.draft_id, "draft-6");
		assert.equal(payload.to, "a@b.com", "the removed recipient stays removed");
		assert.match(payload.html, /newer text/);
	});

	test("a row that is no longer a plain draft is not opened for editing", async () => {
		for (const [stored, message] of [
			[{ folder_id: "sent", delivery_status: "inbox" }, /already been sent or moved/],
			[{ folder_id: "drafts", delivery_status: "scheduled" }, /scheduled/],
			[{ folder_id: "drafts", delivery_status: "sending" }, /already been sent or moved/],
		] as const) {
			calls.length = 0;
			toasts.length = 0;
			const row = draftRow({ id: "draft-7" });
			handlers.getEmail = async () => ({ data: { ...row, ...stored, attachments: [] } });
			const { c, ui } = await mount({ mode: "draft", originalEmail: row });
			await c.draftAttachmentsLoad;
			assert.equal(ui.isComposeModalOpen, false, `closed for ${JSON.stringify(stored)}`);
			assert.equal(c.currentDraftId.value, null);
			assert.ok(toasts.some((t) => t.type === "info" && message.test(t.message)), `says why for ${JSON.stringify(stored)}`);
			await wait(2500);
			assert.equal(callsOf("saveDraft").length + callsOf("sendEmail").length, 0, "nothing is saved or sent under its id");
		}
	});

	test("a draft that cannot be loaded, or whose files cannot, is not left open to be saved without them", async () => {
		const row = draftRow({ id: "draft-8" });
		toasts.length = 0;
		handlers.getEmail = async () => {
			throw new Error("offline");
		};
		const first = await mount({ mode: "draft", originalEmail: row });
		await first.c.draftAttachmentsLoad;
		assert.equal(first.ui.isComposeModalOpen, false);

		handlers.getEmail = async () => ({ data: { ...row, attachments: [{ id: "att-1", filename: "deck.pdf", size: 3, disposition: "attachment" }] } });
		handlers.getAttachment = async () => {
			throw new Error("offline");
		};
		const second = await mount({ mode: "draft", originalEmail: row });
		await second.c.draftAttachmentsLoad;
		assert.equal(second.ui.isComposeModalOpen, false);
		await wait(2500);
		assert.equal(callsOf("saveDraft").length, 0, "the stored draft keeps its files");
		assert.equal(toasts.filter((t) => t.type === "error").length, 2, "and the user is told both times");

		assert.deepEqual(loggedErrors().map((line) => line.replace(/ .*/, "")), ["Failed", "Failed"]);
		consoleError.mock.resetCalls();
	});

	test("its row leaves the list while the message is on its way out, and comes back if the send fails", async () => {
		const draft = draftRow({ id: "draft-9" });
		handlers.getEmail = async () => ({ data: { ...draft, attachments: [] } });
		const { c } = await mount({ mode: "draft", originalEmail: draft });
		await c.draftAttachmentsLoad;
		const emails = (await import("@/stores/emails")).useEmailStore();
		emails.emails = [draft as any];
		handlers.sendEmail = async () => {
			throw { response: { status: 500, data: { error: "boom" } } };
		};
		await c.triggerSendFlow(false);
		assert.deepEqual(emails.emails.map((e: any) => e.id), [], "gone during the undo window: it cannot be opened and sent twice");
		c.commitSendImmediately();
		await flush();
		assert.deepEqual(emails.emails.map((e: any) => e.id), ["draft-9"], "back after the failure");
	});
});

describe("text moved in from the quick-reply box", () => {
	test("counts as unsaved, so closing asks first", async () => {
		const { c, ui } = await mount({ mode: "reply", originalEmail: received(), initialBody: "typed", initialBodyUnsaved: true });
		assert.match(c.body.value, /typed/);
		assert.equal(c.isDirty.value, true);
		c.requestCloseModal();
		assert.equal(c.showDirtyModal.value, true);
		assert.equal(ui.isComposeModalOpen, true);

		const plain = (await mount({ mode: "reply", originalEmail: received() })).c;
		assert.equal(plain.isDirty.value, false);
	});

	test("arrives as HTML and is placed as it is, above the quote", async () => {
		// The thread view escapes the typed text; wrapping or re-reading it here would undo that.
		const html = "<p>cc John &lt;john@x.com&gt; on this<br>second line</p>";
		const { c } = await mount({ mode: "reply", originalEmail: received(), initialBody: html, initialBodyUnsaved: true });
		assert.ok(c.body.value.startsWith(`${html}<br>`), c.body.value.slice(0, 120));
		assert.match(c.body.value, /<blockquote/);
	});
});
