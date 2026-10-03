import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChains, isDue, orgKey, type SentRow } from "../src/outreach.ts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-10T12:00:00Z");
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const sent = (id: string, to: string, daysAgo: number, extra: Partial<SentRow> = {}): SentRow => ({
	id,
	recipient: to,
	subject: "Hello",
	date: iso(daysAgo),
	in_reply_to: null,
	opened_count: 0,
	clicked_count: 0,
	delivery_status: "delivered",
	thread_id: id,
	...extra,
});
const opts = { now: NOW, delayMs: 3 * DAY, maxFollowUps: 2 };

test("silent recipient is due after the delay, not before", () => {
	const [old] = buildChains([sent("a", "dev@studio.io", 4)], []);
	assert.equal(isDue(old, opts), true);
	const [fresh] = buildChains([sent("a", "dev@studio.io", 1)], []);
	assert.equal(isDue(fresh, opts), false);
});

test("a reply (even archived, any folder) stops follow-ups", () => {
	const [c] = buildChains([sent("a", "dev@studio.io", 5)], [{ sender: "Dev <dev@studio.io>", date: iso(2) }]);
	assert.equal(c.replied, true);
	assert.equal(c.stage, "replied");
	assert.equal(isDue(c, opts), false);
});

test("a reply from a colleague at the same company counts; free providers do not cross over", () => {
	const [corp] = buildChains([sent("a", "ceo@studio.io", 5)], [{ sender: "ua@studio.io", date: iso(1) }]);
	assert.equal(corp.replied, true);
	const [free] = buildChains([sent("a", "a@gmail.com", 5)], [{ sender: "b@gmail.com", date: iso(1) }]);
	assert.equal(free.replied, false);
	assert.equal(orgKey("a@gmail.com"), "a@gmail.com");
	assert.equal(orgKey("a@studio.io"), "studio.io");
});

test("mail received before we wrote does not count as a reply", () => {
	const [c] = buildChains([sent("a", "dev@studio.io", 5)], [{ sender: "dev@studio.io", date: iso(9) }]);
	assert.equal(c.replied, false);
});

test("bounced recipients are never nudged", () => {
	const [c] = buildChains([sent("a", "gone@x.io", 5, { delivery_status: "bounced" })], []);
	assert.equal(c.stage, "bounced");
	assert.equal(isDue(c, opts), false);
});

test("follow-up cap counts messages already sent to the recipient", () => {
	const rows = [sent("a", "d@x.io", 10), sent("b", "d@x.io", 7), sent("c", "d@x.io", 4)];
	const [c] = buildChains(rows, []);
	assert.equal(c.sent_count, 3);
	assert.equal(isDue(c, opts), false); // 2 follow-ups already sent (max 2)
	assert.equal(isDue(c, { ...opts, maxFollowUps: 3 }), true);
});

test("an unsent follow-up draft blocks another one", () => {
	const [c] = buildChains([sent("a", "d@x.io", 6)], [], new Map([["d@x.io", "draft-1"]]));
	assert.equal(c.pending_draft_id, "draft-1");
	assert.equal(isDue(c, opts), false);
});

test("replies, forwards and multi-recipient mail are not outreach", () => {
	const chains = buildChains(
		[
			sent("a", "cust@x.io", 6, { in_reply_to: "orig@x.io" }),
			sent("b", "one@x.io, two@x.io", 6),
			sent("c", "dev@y.io", 6, { delivery_status: "draft" }),
		],
		[],
	);
	assert.equal(chains.length, 0);
});

test("a recipient we also replied to is a conversation, not a chain", () => {
	const chains = buildChains([sent("a", "d@x.io", 8), sent("b", "d@x.io", 5, { in_reply_to: "z" })], []);
	assert.equal(chains.length, 0);
});

test("stages follow engagement and chains sort by latest contact", () => {
	const chains = buildChains(
		[
			sent("a", "o@x.io", 2, { opened_count: 1 }),
			sent("b", "c@y.io", 6, { opened_count: 2, clicked_count: 1 }),
			sent("c", "n@z.io", 4),
		],
		[],
	);
	assert.deepEqual(chains.map((c) => [c.recipient, c.stage]), [
		["o@x.io", "opened"],
		["n@z.io", "contacted"],
		["c@y.io", "clicked"],
	]);
});
