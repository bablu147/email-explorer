import assert from "node:assert/strict";
import { test } from "node:test";
import {
	checkSendAt,
	checkSnoozeUntil,
	earliest,
	htmlToText,
	MAX_LEAD_MS,
	MIN_SEND_LEAD_MS,
	MIN_SNOOZE_LEAD_MS,
	parseEmailList,
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

test("parseEmailList extracts bare addresses cleanly", () => {
	assert.deepEqual(parseEmailList(null), []);
	assert.deepEqual(parseEmailList(""), []);
	assert.deepEqual(
		parseEmailList("Alice <alice@test.io>, bob@test.io; Carol <carol@test.io>"),
		["alice@test.io", "bob@test.io", "carol@test.io"],
	);
	assert.deepEqual(
		parseEmailList(["Dave <dave@test.io>", "eve@test.io"]),
		["dave@test.io", "eve@test.io"],
	);
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
