import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TEMPLATES, PITCH_TEMPLATE_ID, validateTemplateInput } from "../src/templates.ts";

test("exactly one default pitch, with a subject", () => {
	const pitches = DEFAULT_TEMPLATES.filter((t) => t.kind === "pitch");
	assert.equal(pitches.length, 1);
	assert.equal(pitches[0].id, PITCH_TEMPLATE_ID);
	assert.ok(pitches[0].subject);
});

test("defaults only use known merge fields", () => {
	const known = new Set(["app_name", "developer_name", "platform", "category", "installs", "traction", "first_name"]);
	for (const t of DEFAULT_TEMPLATES) {
		for (const m of `${t.subject ?? ""} ${t.body}`.matchAll(/\{\{(\w+)\}\}/g)) {
			assert.ok(known.has(m[1]), `${t.id} uses unknown field ${m[1]}`);
		}
	}
});

test("reply template validation", () => {
	assert.deepEqual(validateTemplateInput({ name: " Hi ", body: "text" }, "reply"), {
		ok: true,
		name: "Hi",
		subject: null,
		body: "text",
	});
	assert.ok("error" in validateTemplateInput({ name: "", body: "x" }, "reply"));
	assert.ok("error" in validateTemplateInput({ name: "n", body: "   " }, "reply"));
	assert.ok("error" in validateTemplateInput({ name: "n", body: "x".repeat(20001) }, "reply"));
});

test("pitch needs a subject; replies ignore one", () => {
	assert.ok("error" in validateTemplateInput({ name: "n", body: "b" }, "pitch"));
	const pitch = validateTemplateInput({ name: "n", body: "b", subject: " S " }, "pitch");
	assert.ok(pitch.ok && pitch.subject === "S");
	const reply = validateTemplateInput({ name: "n", body: "b", subject: "ignored" }, "reply");
	assert.ok(reply.ok && reply.subject === null);
});
