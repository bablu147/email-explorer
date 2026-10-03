import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSearchQuery, buildSearchFilterSql } from "../src/search-query.ts";

test("parseSearchQuery parses plain text without filters", () => {
	const parsed = parseSearchQuery("product launch update");
	assert.equal(parsed.rawText, "product launch update");
	assert.deepEqual(parsed.textTerms, ["product", "launch", "update"]);
	assert.equal(parsed.from, undefined);
	assert.equal(parsed.to, undefined);
	assert.equal(parsed.isRead, undefined);
	assert.equal(parsed.isStarred, undefined);
	assert.equal(parsed.hasAttachment, undefined);
});

test("parseSearchQuery parses sender and recipient tokens", () => {
	const parsed = parseSearchQuery("from:alice@example.com to:bob@example.com urgent");
	assert.equal(parsed.from, "alice@example.com");
	assert.equal(parsed.to, "bob@example.com");
	assert.equal(parsed.rawText, "urgent");
	assert.deepEqual(parsed.textTerms, ["urgent"]);
});

test("parseSearchQuery handles quoted filter values and quoted text", () => {
	const parsed = parseSearchQuery('from:"John Doe" "quarterly review"');
	assert.equal(parsed.from, "John Doe");
	assert.equal(parsed.rawText, "quarterly review");
	assert.deepEqual(parsed.textTerms, ["quarterly review"]);
});

test("parseSearchQuery parses boolean status flags", () => {
	const unread = parseSearchQuery("is:unread has:attachment is:starred");
	assert.equal(unread.isRead, false);
	assert.equal(unread.hasAttachment, true);
	assert.equal(unread.isStarred, true);

	const read = parseSearchQuery("is:read is:unstarred has:attachments");
	assert.equal(read.isRead, true);
	assert.equal(read.isStarred, false);
	assert.equal(read.hasAttachment, true);
});

test("parseSearchQuery parses dates with boundary normalization", () => {
	const parsed = parseSearchQuery("after:2026-01-15 before:2026-03-30");
	assert.equal(parsed.after, "2026-01-15T00:00:00.000Z");
	assert.equal(parsed.before, "2026-03-30T23:59:59.999Z");

	// ISO dates with time are preserved
	const iso = parseSearchQuery("after:2026-05-01T12:00:00Z");
	assert.equal(iso.after, "2026-05-01T12:00:00Z");
});

test("parseSearchQuery parses folder token", () => {
	const parsed = parseSearchQuery("folder:sent meeting");
	assert.equal(parsed.folder, "sent");
	assert.equal(parsed.rawText, "meeting");
});

test("buildSearchFilterSql builds correct parameterized SQLite where clauses", () => {
	// Plain text only
	const q1 = parseSearchQuery("hello");
	const sql1 = buildSearchFilterSql(q1, "inbox");
	assert.equal(sql1.whereSql, "folder_id = ?1 AND snoozed_until IS NULL AND scheduled_at IS NULL AND (subject LIKE ?2 OR sender LIKE ?2 OR recipient LIKE ?2 OR body LIKE ?2)");
	assert.deepEqual(sql1.params, ["inbox", "%hello%"]);

	// Virtual folder: snoozed
	const qSnoozed = parseSearchQuery("folder:snoozed reminder");
	const sqlSnoozed = buildSearchFilterSql(qSnoozed);
	assert.ok(sqlSnoozed.whereSql.includes("snoozed_until IS NOT NULL AND folder_id = 'inbox'"));

	// Complex multi-token query
	const q2 = parseSearchQuery("from:support is:unread has:attachment after:2026-01-01 invoice");
	const sql2 = buildSearchFilterSql(q2);
	assert.ok(sql2.whereSql.includes("sender LIKE ?1"));
	assert.ok(sql2.whereSql.includes("EXISTS (SELECT 1 FROM attachments WHERE attachments.email_id = emails.id)"));
	assert.ok(sql2.whereSql.includes("read = ?2"));
	assert.ok(sql2.whereSql.includes("date >= ?3"));
	assert.ok(sql2.whereSql.includes("(subject LIKE ?4 OR sender LIKE ?4 OR recipient LIKE ?4 OR body LIKE ?4)"));
	assert.deepEqual(sql2.params, [
		"%support%",
		0,
		"2026-01-01T00:00:00.000Z",
		"%invoice%",
	]);
});
