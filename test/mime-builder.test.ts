import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMimeMessage } from "../src/mime-builder.ts";

const base = { from: "a@x.io", to: "b@y.io", subject: "Hi" };

test("never leaks Bcc into the headers", () => {
	const mime = buildMimeMessage({ ...base, bcc: ["secret@z.io"], text: "t" });
	assert.ok(!/^bcc:/im.test(mime));
	assert.ok(!mime.includes("secret@z.io"));
});

test("Cc and multiple To are joined", () => {
	const mime = buildMimeMessage({ ...base, to: ["b@y.io", "c@y.io"], cc: ["d@y.io"], text: "t" });
	assert.match(mime, /^To: b@y\.io, c@y\.io\r$/m);
	assert.match(mime, /^Cc: d@y\.io\r$/m);
});

test("text+html becomes multipart/alternative; single parts keep their type", () => {
	assert.match(buildMimeMessage({ ...base, text: "t", html: "<p>h</p>" }), /multipart\/alternative/);
	const htmlOnly = buildMimeMessage({ ...base, html: "<p>h</p>" });
	assert.match(htmlOnly, /Content-Type: text\/html/);
	assert.ok(!htmlOnly.includes("multipart"));
	assert.match(buildMimeMessage({ ...base, text: "t" }), /Content-Type: text\/plain/);
});

test("threading headers use angle brackets", () => {
	const mime = buildMimeMessage({ ...base, text: "t", inReplyTo: "abc@x", references: ["r1@x", "r2@x"] });
	assert.match(mime, /^In-Reply-To: <abc@x>\r$/m);
	assert.match(mime, /^References: <r1@x> <r2@x>\r$/m);
});

test("custom headers are added and cannot inject extra headers", () => {
	const mime = buildMimeMessage({
		...base,
		text: "t",
		headers: { "List-Unsubscribe": "<https://u>", "X-Evil\r\nBcc": "v\r\nBcc: attacker@evil.io" },
	});
	assert.match(mime, /^List-Unsubscribe: <https:\/\/u>\r$/m);
	assert.ok(!/^Bcc:/im.test(mime), "header injection must not create a Bcc line");
});

test("every message gets a unique Message-ID", () => {
	const ids = new Set(
		Array.from({ length: 20 }, () => buildMimeMessage({ ...base, text: "t" }).match(/^Message-ID: (.+)\r$/m)?.[1]),
	);
	assert.equal(ids.size, 20);
});

test("attachments become multipart/mixed with wrapped base64 and a closing boundary", () => {
	const content = "QUJD".repeat(60); // 240 chars -> must wrap at 76
	const mime = buildMimeMessage({
		...base,
		text: "t",
		attachments: [{ filename: "a.bin", content, type: "application/octet-stream", disposition: "attachment" }],
	});
	assert.match(mime, /multipart\/mixed; boundary="([^"]+)"/);
	const boundary = mime.match(/multipart\/mixed; boundary="([^"]+)"/)![1];
	assert.ok(mime.includes(`--${boundary}--`));
	assert.match(mime, /Content-Disposition: attachment; filename="a\.bin"/);
	for (const line of mime.split("\r\n")) {
		if (/^[A-Za-z0-9+/=]{20,}$/.test(line)) assert.ok(line.length <= 76);
	}
});

test("inline attachments carry a Content-ID", () => {
	const mime = buildMimeMessage({
		...base,
		html: '<img src="cid:logo">',
		attachments: [{ filename: "l.png", content: "AAAA", type: "image/png", disposition: "inline", contentId: "logo" }],
	});
	assert.match(mime, /Content-ID: <logo>/);
	assert.match(mime, /Content-Disposition: inline/);
});
