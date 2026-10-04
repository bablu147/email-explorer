import assert from "node:assert/strict";
import { test } from "node:test";
import {
	checkSendAt,
	checkSnoozeUntil,
	describeInvalidRecipients,
	earliest,
	htmlToText,
	MAX_LEAD_MS,
	MIN_SEND_LEAD_MS,
	MIN_SNOOZE_LEAD_MS,
	parseRecipients,
} from "../src/scheduling.ts";

test("checkSendAt validates send lead time and formats", () => {
	const now = 1_700_000_000_000;
	assert.equal(checkSendAt("", now).ok, false);
	assert.equal(checkSendAt(null, now).ok, false);
	assert.equal(checkSendAt("not-a-date", now).ok, false);

	// Too close or in the past
	const past = new Date(now - 1000).toISOString();
	assert.equal(checkSendAt(past, now).ok, false);
	const tooClose = new Date(now + MIN_SEND_LEAD_MS - 5000).toISOString();
	assert.equal(checkSendAt(tooClose, now).ok, false);

	// Way too far
	const tooFar = new Date(now + MAX_LEAD_MS + 86_400_000).toISOString();
	assert.equal(checkSendAt(tooFar, now).ok, false);

	// Valid
	const valid = new Date(now + 3_600_000).toISOString();
	const res = checkSendAt(valid, now);
	assert.equal(res.ok, true);
	assert.equal(res.iso, valid);
});

test("checkSnoozeUntil validates snooze future bounds", () => {
	const now = 1_700_000_000_000;
	assert.equal(checkSnoozeUntil("", now).ok, false);
	assert.equal(checkSnoozeUntil(null, now).ok, false);

	const past = new Date(now - 1000).toISOString();
	assert.equal(checkSnoozeUntil(past, now).ok, false);

	const tooClose = new Date(now + MIN_SNOOZE_LEAD_MS - 2000).toISOString();
	assert.equal(checkSnoozeUntil(tooClose, now).ok, false);

	const valid = new Date(now + 7_200_000).toISOString();
	const res = checkSnoozeUntil(valid, now);
	assert.equal(res.ok, true);
	assert.equal(res.iso, valid);
});

test("earliest finds the nearest timestamp and ignores nulls", () => {
	const t1 = "2026-10-04T10:00:00.000Z";
	const t2 = "2026-10-04T08:00:00.000Z";
	const t3 = "2026-10-04T12:00:00.000Z";

	assert.equal(earliest(null, undefined), null);
	assert.equal(earliest(t1), t1);
	assert.equal(earliest(t1, t2, t3), t2);
	assert.equal(earliest(null, t3, undefined, t1), t1);
});

test("parseRecipients extracts normalised addresses", () => {
	const none = { valid: [], invalid: [] };
	assert.deepEqual(parseRecipients(null), none);
	assert.deepEqual(parseRecipients(""), none);
	assert.deepEqual(parseRecipients(" , ;\n"), none);
	assert.deepEqual(
		parseRecipients("Alice <alice@test.io>, bob@test.io; Carol <carol@test.io>\ndan@test.io"),
		{ valid: ["alice@test.io", "bob@test.io", "carol@test.io", "dan@test.io"], invalid: [] },
	);
	assert.deepEqual(
		parseRecipients(["Dave <dave@test.io>", "eve@test.io"]),
		{ valid: ["dave@test.io", "eve@test.io"], invalid: [] },
	);
	// What is delivered to is the address the do-not-contact list is checked for: lower-case, and
	// without a trailing dot on the domain.
	assert.deepEqual(
		parseRecipients("Bob@Test.IO, Carol <Carol@Test.io.>"),
		{ valid: ["bob@test.io", "carol@test.io"], invalid: [] },
	);
});

test("parseRecipients reports an entry that is not a usable address instead of passing it on", () => {
	assert.deepEqual(
		parseRecipients("ok@test.io, victim@x.com>, Victim <victim@x.com"),
		{ valid: ["ok@test.io"], invalid: ["victim@x.com>", "Victim <victim@x.com"] },
	);
	// One array item is one entry: it is not split again.
	assert.deepEqual(
		parseRecipients(["a@test.io, b@test.io", "c@test.io"]),
		{ valid: ["c@test.io"], invalid: ["a@test.io, b@test.io"] },
	);
	assert.deepEqual(parseRecipients("half@typed"), { valid: [], invalid: ["half@typed"] });
});

test("parseRecipients keeps a display name with a comma in it working", () => {
	assert.deepEqual(
		parseRecipients('Doe, Jane <jane@test.io>; "Roe, Rick" <rick@test.io>, dan@test.io'),
		{ valid: ["jane@test.io", "rick@test.io", "dan@test.io"], invalid: [] },
	);
	assert.deepEqual(parseRecipients(["Doe, Jane <jane@test.io>"]), { valid: ["jane@test.io"], invalid: [] });
});

test("parseRecipients reports an entry with no @ unless it is the start of such a display name", () => {
	assert.deepEqual(parseRecipients("nobody"), { valid: [], invalid: ["nobody"] });
	assert.deepEqual(parseRecipients("ok@test.io, nobody"), { valid: ["ok@test.io"], invalid: ["nobody"] });
	// A bare address has no display name, so what comes before it is an entry of its own.
	assert.deepEqual(parseRecipients("nobody, ok@test.io"), { valid: ["ok@test.io"], invalid: ["nobody"] });
	assert.deepEqual(
		parseRecipients("Doe, Jane <jane@test.io>, nobody"),
		{ valid: ["jane@test.io"], invalid: ["nobody"] },
	);
	// Array items are whole entries: nothing was split, so nothing is joined back.
	assert.deepEqual(parseRecipients(["Doe", "Jane <jane@test.io>"]), { valid: ["jane@test.io"], invalid: ["Doe"] });
	assert.deepEqual(parseRecipients(["", "  "]), { valid: [], invalid: [] });
});

test("describeInvalidRecipients names the entries in one sentence", () => {
	assert.equal(
		describeInvalidRecipients(["victim@x.com>"]),
		'"victim@x.com>" is not a valid email address. Correct it to send the message.',
	);
	assert.equal(
		describeInvalidRecipients(["a@", "b@"]),
		'"a@", "b@" are not valid email addresses. Correct them to send the message.',
	);
	const seven = ["1@", "2@", "3@", "4@", "5@", "6@", "7@"];
	assert.equal(
		describeInvalidRecipients(seven),
		'"1@", "2@", "3@", "4@", "5@" and 2 more are not valid email addresses. Correct them to send the message.',
	);
	assert.ok(describeInvalidRecipients([`${"x".repeat(500)}@`]).length < 200, "a very long entry is cut short");
});

test("htmlToText converts html bodies to readable plain text", () => {
	const html = `
		<html>
			<head><style>body { color: red; }</style></head>
			<body>
				<p>Hello &quot;World&quot;&amp; Co!</p>
				<p>List of items:</p>
				<ul>
					<li>First &lt;item&gt;</li>
					<li>Second &nbsp; item</li>
				</ul>
				<a href="https://example.com">Visit site</a>
			</body>
		</html>
	`;
	const text = htmlToText(html);
	assert.ok(!text.includes("color: red"));
	assert.ok(text.includes('Hello "World"& Co!'));
	assert.ok(text.includes("- First <item>"));
	assert.ok(text.includes("- Second   item"));
	assert.ok(text.includes("Visit site"));
});
