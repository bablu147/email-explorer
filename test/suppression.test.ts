import assert from "node:assert/strict";
import { test } from "node:test";
import {
	appendUnsubscribeFooter,
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
