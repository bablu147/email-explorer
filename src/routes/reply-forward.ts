import { EmailMessage } from "cloudflare:email";
import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { buildMimeMessage } from "../mime-builder";
import type { Env, Session } from "../types";
import { base64ToBytes, injectEmailTracking } from "../worker";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

export function parseEmailList(input?: string | string[]): string[] {
	if (!input) return [];
	const rawList = Array.isArray(input) ? input : input.split(/[,;\n]+/);
	const results: string[] = [];
	for (const item of rawList) {
		const match = item.match(/<([^>]+)>/) || [null, item];
		const email = (match[1] || item).trim();
		if (email && email.includes("@")) {
			results.push(email);
		}
	}
	return results;
}

export const SendEmailRequestSchema = z
	.object({
		to: z.union([z.string(), z.array(z.string())]),
		cc: z.union([z.string(), z.array(z.string())]).optional(),
		bcc: z.union([z.string(), z.array(z.string())]).optional(),
		from: z.string().email(),
		subject: z.string(),
		html: z.string().optional(),
		text: z.string().optional(),
		attachments: z
			.array(
				z.object({
					content: z.string(), // base64 encoded
					filename: z.string(),
					type: z.string(),
					disposition: z.enum(["attachment", "inline"]),
					contentId: z.string().optional(),
				}),
			)
			.optional(),
		in_reply_to: z.string().optional(),
		references: z.array(z.string()).optional(),
		thread_id: z.string().optional(),
	})
	.refine((data) => data.html || data.text, {
		message: "Either 'html' or 'text' must be provided",
	});

export const SendEmailResponseSchema = z.object({
	id: z.string(),
	status: z.string(),
});

export const ErrorResponseSchema = z.object({
	error: z.string(),
});

export class PostReplyEmail extends OpenAPIRoute {
	schema = {
		summary: "Reply to an email",
		operationId: "replyToEmail",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
			body: contentJson(SendEmailRequestSchema),
		},
		responses: {
			"201": {
				description: "Reply sent successfully",
				...contentJson(SendEmailResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Original email not found",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { to, cc, bcc, from, subject, html, text, attachments } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		// Get the original email to extract threading info
		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);
		const originalEmail = (await stub.getEmail(id)) as any;

		if (!originalEmail) {
			return c.json({ error: "Original email not found" }, 404);
		}

		// Build threading information
		const in_reply_to = originalEmail.id;
		const references = originalEmail.email_references
			? [
					...JSON.parse(originalEmail.email_references as string),
					originalEmail.id,
				]
			: [originalEmail.id];
		const thread_id = originalEmail.thread_id || originalEmail.id;

		const toList = parseEmailList(to);
		const ccList = parseEmailList(cc);
		const bccList = parseEmailList(bcc);
		const allEnvelopeRecipients = Array.from(
			new Set([...toList, ...ccList, ...bccList]),
		);

		if (allEnvelopeRecipients.length === 0) {
			return c.json({ error: "No valid recipient found" }, 400);
		}

		const messageId = crypto.randomUUID();
		const clickSecret = await c.env.MAILBOX.get(
			c.env.MAILBOX.idFromName("AUTH"),
		).getUnsubscribeSecret();
		const outboundHtml = await injectEmailTracking(html, mailboxId, messageId, clickSecret);

		// Build MIME message
		const mimeMessage = buildMimeMessage({
			from,
			to: toList,
			cc: ccList.length > 0 ? ccList : undefined,
			bcc: bccList.length > 0 ? bccList : undefined,
			subject,
			text,
			html: outboundHtml,
			attachments: attachments?.map((att) => ({
				filename: att.filename,
				content: att.content,
				type: att.type,
				disposition: att.disposition,
				contentId: att.contentId,
			})),
			inReplyTo: in_reply_to,
			references: references,
		});

		try {
			for (const recipient of allEnvelopeRecipients) {
				const message = new EmailMessage(from, recipient, mimeMessage);
				await c.env.SEND_EMAIL.send(message);
			}
		} catch (e) {
			return c.json({ error: (e as Error).message }, 500);
		}

		const attachmentData = [];
		if (attachments) {
			for (const att of attachments) {
				const attachmentId = crypto.randomUUID();
				const key = `attachments/${messageId}/${attachmentId}/${att.filename}`;
				const decoded = base64ToBytes(att.content);
				await c.env.BUCKET.put(key, decoded);
				attachmentData.push({
					id: attachmentId,
					email_id: messageId,
					filename: att.filename,
					mimetype: att.type,
					size: decoded.length,
					content_id: att.contentId || null,
					disposition: att.disposition,
				});
			}
		}

		await stub.createEmail(
			"sent",
			{
				id: messageId,
				subject,
				sender: from,
				recipient: toList.join(", "),
				cc: ccList.length > 0 ? ccList.join(", ") : null,
				bcc: bccList.length > 0 ? bccList.join(", ") : null,
				date: new Date().toISOString(),
				body: html || text || "",
				in_reply_to: in_reply_to,
				email_references: JSON.stringify(references),
				thread_id: thread_id,
			},
			attachmentData,
		);

		return c.json({ id: messageId, status: "sent" }, 201);
	}
}

export class PostForwardEmail extends OpenAPIRoute {
	schema = {
		summary: "Forward an email",
		operationId: "forwardEmail",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
			body: contentJson(SendEmailRequestSchema),
		},
		responses: {
			"201": {
				description: "Email forwarded successfully",
				...contentJson(SendEmailResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Original email not found",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { to, cc, bcc, from, subject, html, text, attachments } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		// Get the original email
		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);
		const originalEmail = (await stub.getEmail(id)) as any;

		if (!originalEmail) {
			return c.json({ error: "Original email not found" }, 404);
		}

		const toList = parseEmailList(to);
		const ccList = parseEmailList(cc);
		const bccList = parseEmailList(bcc);
		const allEnvelopeRecipients = Array.from(
			new Set([...toList, ...ccList, ...bccList]),
		);

		if (allEnvelopeRecipients.length === 0) {
			return c.json({ error: "No valid recipient found" }, 400);
		}

		const messageId = crypto.randomUUID();
		const clickSecret = await c.env.MAILBOX.get(
			c.env.MAILBOX.idFromName("AUTH"),
		).getUnsubscribeSecret();
		const outboundHtml = await injectEmailTracking(html, mailboxId, messageId, clickSecret);

		// Forwarded emails don't have threading headers
		const mimeMessage = buildMimeMessage({
			from,
			to: toList,
			cc: ccList.length > 0 ? ccList : undefined,
			bcc: bccList.length > 0 ? bccList : undefined,
			subject,
			text,
			html: outboundHtml,
			attachments: attachments?.map((att) => ({
				filename: att.filename,
				content: att.content,
				type: att.type,
				disposition: att.disposition,
				contentId: att.contentId,
			})),
		});

		try {
			for (const recipient of allEnvelopeRecipients) {
				const message = new EmailMessage(from, recipient, mimeMessage);
				await c.env.SEND_EMAIL.send(message);
			}
		} catch (e) {
			return c.json({ error: (e as Error).message }, 500);
		}

		const attachmentData = [];
		if (attachments) {
			for (const att of attachments) {
				const attachmentId = crypto.randomUUID();
				const key = `attachments/${messageId}/${attachmentId}/${att.filename}`;
				const decoded = base64ToBytes(att.content);
				await c.env.BUCKET.put(key, decoded);
				attachmentData.push({
					id: attachmentId,
					email_id: messageId,
					filename: att.filename,
					mimetype: att.type,
					size: decoded.length,
					content_id: att.contentId || null,
					disposition: att.disposition,
				});
			}
		}

		await stub.createEmail(
			"sent",
			{
				id: messageId,
				subject,
				sender: from,
				recipient: toList.join(", "),
				cc: ccList.length > 0 ? ccList.join(", ") : null,
				bcc: bccList.length > 0 ? bccList.join(", ") : null,
				date: new Date().toISOString(),
				body: html || text || "",
				in_reply_to: null,
				email_references: null,
				thread_id: messageId,
			},
			attachmentData,
		);

		return c.json({ id: messageId, status: "sent" }, 201);
	}
}
