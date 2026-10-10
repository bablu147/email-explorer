import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMimeMessage, formatSenderString } from "../src/mime-builder.ts";

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

/** Names of the header lines up to the first blank line, in order. */
const headerNames = (block: string) =>
	block
		.slice(0, block.indexOf("\r\n\r\n"))
		.split("\r\n")
		.map((line) => line.slice(0, line.indexOf(":")));

test("a subject with line breaks stays on one Subject line", () => {
	for (const br of ["\r\n", "\n", "\r", "\u2028", "\r\n\r\n"]) {
		const mime = buildMimeMessage({
			...base,
			text: "t",
			subject: `Hello${br}Bcc: x@evil.test${br}X-Injected: 1`,
		});
		assert.deepEqual(headerNames(mime), [
			"From",
			"To",
			"Subject",
			"MIME-Version",
			"Date",
			"Message-ID",
			"Content-Type",
			"Content-Transfer-Encoding",
		]);
		assert.ok(mime.includes("\r\nSubject: Hello Bcc: x@evil.test X-Injected: 1\r\n"));
		assert.ok(!/^(Bcc|X-)/im.test(mime), "no line of the message may start a Bcc or X- header");
	}
});

test("addresses and threading ids cannot start a new header line", () => {
	const evil = "\r\nBcc: x@evil.test";
	const mime = buildMimeMessage({
		from: `a@x.io${evil}`,
		to: [`b@y.io${evil}`, "c@y.io"],
		cc: [`d@y.io${evil}`],
		subject: "Hi",
		text: "t",
		inReplyTo: `abc@x${evil}`,
		references: [`r1@x${evil}`, "r2@x"],
	});
	assert.deepEqual(headerNames(mime), [
		"From",
		"To",
		"Cc",
		"Subject",
		"MIME-Version",
		"Date",
		"Message-ID",
		"In-Reply-To",
		"References",
		"Content-Type",
		"Content-Transfer-Encoding",
	]);
	assert.ok(!/^Bcc:/im.test(mime));
	assert.ok(mime.includes("\r\nTo: b@y.io Bcc: x@evil.test, c@y.io\r\n"));
	assert.ok(mime.includes("\r\nReferences: <r1@x Bcc: x@evil.test> <r2@x>\r\n"));
});

test("a hostile attachment filename, type or Content-ID cannot break out of its header", () => {
	const mime = buildMimeMessage({
		...base,
		html: "<p>h</p>",
		attachments: [
			{
				filename: 'report".pdf\\\r\nX-Evil: 1\r\n\r\nbody',
				content: "AAAA",
				type: "text/plain\r\nX-Evil: 2",
				disposition: "inline",
				contentId: "logo\r\nX-Evil: 3",
			},
		],
	});
	const boundary = mime.match(/multipart\/mixed; boundary="([^"]+)"/)![1];
	// [0] message headers, [1] the body part, [2] the attachment part, [3] the closing "--"
	const parts = mime.split(`--${boundary}`);
	assert.equal(parts.length, 4);
	const attachment = parts[2].slice(2);
	assert.deepEqual(headerNames(attachment), [
		"Content-Type",
		"Content-Transfer-Encoding",
		"Content-Disposition",
		"Content-ID",
	]);
	assert.ok(!/^X-Evil/im.test(mime));
	// The quote and backslash are replaced, so the quoted string ends only at its own closing quote.
	assert.ok(attachment.includes(`Content-Type: text/plain X-Evil: 2; name="report'.pdf_ X-Evil: 1 body"\r\n`));
	assert.ok(attachment.includes(`Content-Disposition: inline; filename="report'.pdf_ X-Evil: 1 body"\r\n`));
	assert.ok(attachment.includes("Content-ID: <logo X-Evil: 3>\r\n\r\nAAAA\r\n"));
});

test("ordinary header values are written unchanged", () => {
	const mime = buildMimeMessage({
		from: "Ann Lee <ann@x.io>",
		to: ["b@y.io", "Bob <c@y.io>"],
		cc: "d@y.io",
		subject: "Re: Q3  plan (v2) \u2014 caf\u00e9, 50% off!",
		text: "t",
		inReplyTo: "abc@x",
		references: ["r1@x"],
		headers: { "List-Unsubscribe": "<https://u>, <mailto:u@x.io>" },
		attachments: [
			{ filename: "Q3 report (final).pdf", content: "AAAA", type: "application/pdf", disposition: "inline", contentId: "img-1@x" },
		],
	});
	for (const line of [
		"From: Ann Lee <ann@x.io>",
		"To: b@y.io, Bob <c@y.io>",
		"Cc: d@y.io",
		"Subject: Re: Q3  plan (v2) \u2014 caf\u00e9, 50% off!",
		"In-Reply-To: <abc@x>",
		"References: <r1@x>",
		"List-Unsubscribe: <https://u>, <mailto:u@x.io>",
		'Content-Type: application/pdf; name="Q3 report (final).pdf"',
		'Content-Disposition: inline; filename="Q3 report (final).pdf"',
		"Content-ID: <img-1@x>",
	]) {
		assert.ok(mime.includes(`${line}\r\n`), line);
	}
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

test("formatSenderString formats human display names and preserves plain addresses", () => {
	const withName = formatSenderString("lara@reflect.cloud", "Lara Kuhlmann");
	assert.equal(withName.fromHeader, '"Lara Kuhlmann" <lara@reflect.cloud>');
	assert.equal(withName.senderString, "Lara Kuhlmann <lara@reflect.cloud>");

	const plain = formatSenderString("lara@reflect.cloud", "lara@reflect.cloud");
	assert.equal(plain.fromHeader, "lara@reflect.cloud");
	assert.equal(plain.senderString, "lara@reflect.cloud");

	const empty = formatSenderString("lara@reflect.cloud", "");
	assert.equal(empty.fromHeader, "lara@reflect.cloud");
	assert.equal(empty.senderString, "lara@reflect.cloud");

	const mime = buildMimeMessage({
		...base,
		from: withName.fromHeader,
		text: "Hello",
	});
	assert.match(mime, /^From: "Lara Kuhlmann" <lara@reflect\.cloud>\r$/m);
});

