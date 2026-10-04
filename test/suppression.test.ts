import assert from "node:assert/strict";
import { test } from "node:test";
import {
	answeredSender,
	appendUnsubscribeFooter,
	describeSuppressed,
	isHttpUrl,
	normalizeEmail,
	renderLeavingPage,
	signClickLink,
	verifyClickLink,
	parseBounce,
	signUnsubscribeToken,
	verifyUnsubscribeToken,
} from "../src/suppression.ts";

const SECRET = "test-secret";

test("normalizeEmail handles display names, case and junk", () => {
	assert.equal(normalizeEmail("Jane <Jane@Example.COM>"), "jane@example.com");
	assert.equal(normalizeEmail("  a@b.co "), "a@b.co");
	assert.equal(normalizeEmail("not-an-email"), null);
	assert.equal(normalizeEmail(""), null);
});

test("normalizeEmail drops a trailing dot on the domain: it is the same mailbox", () => {
	assert.equal(normalizeEmail("victim@x.com."), "victim@x.com");
	assert.equal(normalizeEmail("Victim <Victim@X.com.>"), "victim@x.com");
	assert.equal(normalizeEmail("victim@x.com.."), "victim@x.com");
	assert.equal(normalizeEmail("victim@x."), null, "nothing valid is left without the dot");
});

test("normalizeEmail rejects control and invisible characters", () => {
	// The header writer strips these, so the address checked would not be the one delivered to.
	assert.equal(normalizeEmail("a@b.co\u0000"), null);
	assert.equal(normalizeEmail("a\u200b@b.co"), null);
	assert.equal(normalizeEmail("a@b\u00ad.co"), null);
	assert.equal(normalizeEmail("a@b.co"), "a@b.co");
});

test("normalizeEmail rejects malformed forms instead of passing them through", () => {
	for (const bad of [
		"victim@x.com>",
		"Victim <victim@x.com",
		"<victim@x.com",
		"<<victim@x.com>>",
		"a@x.com, b@y.com",
		"a@x.com b@y.com",
		'"victim"@x.com',
		"victim@@x.com",
		"victim@x",
		"@x.com",
		"victim@",
	]) {
		assert.equal(normalizeEmail(bad), null, bad);
	}
});

test("unsubscribe token round-trips", async () => {
	const token = await signUnsubscribeToken(SECRET, "Dev@Studio.io", "sales@reflect.cloud");
	const out = await verifyUnsubscribeToken(SECRET, token);
	assert.deepEqual(out, { email: "dev@studio.io", mailboxId: "sales@reflect.cloud" });
});

test("unsubscribe token rejects tampering and a wrong secret", async () => {
	const token = await signUnsubscribeToken(SECRET, "a@b.co", "m@x.co");
	const [payload, sig] = token.split(".");
	assert.equal(await verifyUnsubscribeToken("other-secret", token), null);
	assert.equal(await verifyUnsubscribeToken(SECRET, `${payload}.${sig.slice(0, -2)}AA`), null);
	const forged = await signUnsubscribeToken(SECRET, "victim@x.co", "m@x.co");
	assert.equal(await verifyUnsubscribeToken(SECRET, `${forged.split(".")[0]}.${sig}`), null);
	assert.equal(await verifyUnsubscribeToken(SECRET, "garbage"), null);
	assert.equal(await verifyUnsubscribeToken(SECRET, ""), null);
});

const DSN_HARD = `Reporting-MTA: dns; mx.example.com

Final-Recipient: rfc822; Nobody@Gone.com
Action: failed
Status: 5.1.1
Diagnostic-Code: smtp; 550 5.1.1 user unknown`;

test("hard DSN is detected from a daemon sender", () => {
	const r = parseBounce({
		fromAddress: "MAILER-DAEMON@mx.example.com",
		headers: { "content-type": "multipart/report; report-type=delivery-status" },
		bodyText: DSN_HARD,
	});
	assert.deepEqual(r, { recipients: ["nobody@gone.com"] });
});

test("soft / delayed DSN is ignored", () => {
	const r = parseBounce({
		fromAddress: "mailer-daemon@mx.example.com",
		headers: {},
		bodyText: "Final-Recipient: rfc822; slow@x.com\nAction: delayed\nStatus: 4.4.1",
	});
	assert.equal(r, null);
});

test("ordinary mail is not a bounce, even if it mentions the words", () => {
	const r = parseBounce({
		fromAddress: "someone@example.com",
		subject: "user unknown",
		headers: { "x-failed-recipients": "a@b.co" },
		bodyText: "550 5.1.1 user unknown",
	});
	assert.equal(r, null);
});

test("unstructured Gmail-style bounce uses X-Failed-Recipients", () => {
	const r = parseBounce({
		fromAddress: "mailer-daemon@googlemail.com",
		subject: "Delivery Status Notification (Failure)",
		headers: { "x-failed-recipients": "gone@x.com" },
		bodyText: "Your message wasn't delivered to gone@x.com because the address couldn't be found.",
	});
	assert.deepEqual(r, { recipients: ["gone@x.com"] });
});

test("multiple failed recipients in one DSN", () => {
	const r = parseBounce({
		fromAddress: "postmaster@x.com",
		headers: {},
		bodyText: `${DSN_HARD}\n\nFinal-Recipient: rfc822; second@gone.com\nAction: failed\nStatus: 5.2.2`,
	});
	assert.deepEqual(r?.recipients.sort(), ["nobody@gone.com", "second@gone.com"]);
});

test("footer is appended inside the body and as a text line", () => {
	const url = "https://mail.reflect.cloud/api/v1/unsubscribe/abc.def";
	const out = appendUnsubscribeFooter("<html><body><p>Hi</p></body></html>", "Hi", url);
	assert.ok(out.html?.includes(`href="${url}"`));
	assert.ok(out.html?.indexOf("unsubscribe") < out.html!.indexOf("</body>"));
	assert.ok(out.text?.includes(url));
	assert.equal(appendUnsubscribeFooter(undefined, undefined, url).html, undefined);
});

test("click link signatures bind the url, mailbox and message", async () => {
	const sig = await signClickLink(SECRET, "a@x.io", "m1", "https://example.com/p");
	assert.equal(await verifyClickLink(SECRET, "a@x.io", "m1", "https://example.com/p", sig), true);
	assert.equal(await verifyClickLink(SECRET, "a@x.io", "m1", "https://evil.com/p", sig), false);
	assert.equal(await verifyClickLink(SECRET, "a@x.io", "m2", "https://example.com/p", sig), false);
	assert.equal(await verifyClickLink(SECRET, "b@x.io", "m1", "https://example.com/p", sig), false);
	assert.equal(await verifyClickLink("other-secret", "a@x.io", "m1", "https://example.com/p", sig), false);
	assert.equal(await verifyClickLink(SECRET, "a@x.io", "m1", "https://example.com/p", ""), false);
});

test("isHttpUrl accepts only absolute http(s) urls", () => {
	assert.equal(isHttpUrl("https://example.com/a?b=1"), true);
	assert.equal(isHttpUrl("http://example.com"), true);
	for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.com", "/relative", "", undefined, null]) {
		assert.equal(isHttpUrl(bad as string), false, String(bad));
	}
});

test("the leaving page escapes the destination", () => {
	const html = renderLeavingPage('https://e.com/"><script>alert(1)</script>');
	assert.ok(!html.includes("<script>alert(1)"));
});

test("describeSuppressed names the blocked addresses in one sentence", () => {
	assert.equal(
		describeSuppressed(["a@b.io"]),
		"a@b.io is on the do-not-contact list. Remove this address to send the message.",
	);
	assert.equal(
		describeSuppressed(["a@b.io", "c@d.io"]),
		"a@b.io, c@d.io are on the do-not-contact list. Remove these addresses to send the message.",
	);
	const seven = ["1@x.io", "2@x.io", "3@x.io", "4@x.io", "5@x.io", "6@x.io", "7@x.io"];
	assert.equal(
		describeSuppressed(seven),
		"1@x.io, 2@x.io, 3@x.io, 4@x.io, 5@x.io and 2 more are on the do-not-contact list. Remove these addresses to send the message.",
	);
});

test("only the sender of received mail is exempt from the do-not-contact list", () => {
	const box = "sales@reflect.cloud";
	// The exemption is one address, normalised so it compares equal to a parsed recipient.
	assert.equal(answeredSender({ folder_id: "inbox", sender: "dev@studio.io" }, box), "dev@studio.io");
	assert.equal(answeredSender({ folder_id: "archive", sender: "Dev <Dev@Studio.io>" }, box), "dev@studio.io");
	assert.equal(answeredSender({ folder_id: "spam", sender: " dev@studio.io. " }, box), "dev@studio.io");
	// A message this mailbox sent, wherever it is filed now, and its own drafts.
	assert.equal(answeredSender({ folder_id: "sent", sender: box }, box), null);
	assert.equal(answeredSender({ folder_id: "sent", sender: "forged@other.io" }, box), null);
	assert.equal(answeredSender({ folder_id: "drafts", sender: "dev@studio.io" }, box), null);
	assert.equal(answeredSender({ folder_id: "archive", sender: " Sales@Reflect.Cloud " }, box), null);
	// A sender that is not an address exempts nobody.
	assert.equal(answeredSender({ folder_id: "inbox", sender: "" }, box), null);
	assert.equal(answeredSender({ folder_id: "inbox", sender: "not an address" }, box), null);
	assert.equal(answeredSender({ folder_id: "inbox" }, box), null);
	// No such message: in_reply_to named nothing in this mailbox.
	assert.equal(answeredSender(null, box), null);
	assert.equal(answeredSender(undefined, box), null);
});
