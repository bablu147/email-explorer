import { EmailMessage } from "cloudflare:email";
import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { checkDoNotContact, formatSenderString, getMailboxDisplayName } from "../delivery";
import { buildMimeMessage } from "../mime-builder";
import { describeInvalidRecipients, parseRecipients } from "../scheduling";
import { answeredSender } from "../suppression";
import type { Env, Session } from "../types";
import { base64ToBytes, injectEmailTracking } from "../worker";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

/**
 * Removes the composer's autosaved copy of a reply or forward that has just gone out. deleteDraft
 * only deletes a row that really is a draft, so a draft_id naming anything else (the draft was
 * already sent from another tab and is now the Sent record, say) is left alone. Never throws: the
 * message is sent, and a failed cleanup must not turn that into an error.
 */
async function removeSentDraft(c: AppContext, mailboxId: string, draftId: string): Promise<void> {
	try {
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
		const oldAttachments = await stub.deleteDraft(draftId);
		if (oldAttachments.length > 0) {
			await c.env.BUCKET.delete(
				oldAttachments.map((att: any) => `attachments/${draftId}/${att.id}/${att.filename}`),
			);
		}
	} catch (e) {
		console.error("Failed to cleanup draft after send:", e);
	}
}

export const SendEmailRequestSchema = z
	.object({
		to: z.union([z.string(), z.array(z.string())]),
		cc: z.union([z.string(), z.array(z.string())]).optional(),
		bcc: z.union([z.string(), z.array(z.string())]).optional(),
		// Optional: the sender is always the mailbox in the URL. If given, it must be that address.
		from: z.string().email().optional(),
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
		// The composer's autosaved copy of this message. It is removed once the message has gone out.
		draft_id: z.string().optional(),
		// Accepted and ignored, only so that a dashboard loaded before this release can still reply
		// and forward: its composer posts both keys here. `is_draft` must be false, because this
		// route always sends. Remove both once those tabs are gone.
		mailboxId: z.string().optional(),
		is_draft: z.literal(false).optional(),
	})
	// An unknown key is a 400 instead of being silently dropped. (Attachment items stay loose.)
	.strict()
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
			"403": {
				description: "`from` is not this mailbox's own address",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Original email not found",
				...contentJson(ErrorResponseSchema),
			},
			"422": {
				description: "A recipient other than the sender being answered is on the do-not-contact list",
				...contentJson(ErrorResponseSchema),
			},
			"503": {
				description: "The do-not-contact list could not be checked",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { to, cc, bcc, from, subject, html, text, attachments, draft_id } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		// The sender is the mailbox in the URL, never the request body.
		if (from && from.trim().toLowerCase() !== mailboxId.trim().toLowerCase()) {
			return c.json({ error: "The sender must be this mailbox's own address" }, 403);
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

		const toParsed = parseRecipients(to);
		const ccParsed = parseRecipients(cc);
		const bccParsed = parseRecipients(bcc);
		const toList = toParsed.valid;
		const ccList = ccParsed.valid;
		const bccList = bccParsed.valid;
		const allEnvelopeRecipients = Array.from(
			new Set([...toList, ...ccList, ...bccList]),
		);

		// Only what parseRecipients normalised is checked against the do-not-contact list and
		// delivered to, so an entry that is not a valid address stops the send.
		const invalidRecipients = [...toParsed.invalid, ...ccParsed.invalid, ...bccParsed.invalid];
		if (invalidRecipients.length > 0) {
			return c.json({ error: describeInvalidRecipients(invalidRecipients) }, 400);
		}

		if (allEnvelopeRecipients.length === 0) {
			return c.json({ error: "No valid recipient found" }, 400);
		}

		// Answering someone who wrote in must stay possible even if they unsubscribed from outreach,
		// so the sender of the received original is the one address not checked against the
		// do-not-contact list. Everyone else on the reply (a Cc, another address in To) is checked, and
		// a "reply" to a message this mailbox sent is a follow-up on its own outreach: checked in full.
		const answered = answeredSender(originalEmail, mailboxId);
		const block = await checkDoNotContact(
			c.env,
			allEnvelopeRecipients.filter((r) => r !== answered),
		);
		if (block) {
			return c.json({ error: block.error, suppressed: block.suppressed }, block.status);
		}

		const messageId = crypto.randomUUID();
		const clickSecret = await c.env.MAILBOX.get(
			c.env.MAILBOX.idFromName("AUTH"),
		).getUnsubscribeSecret();
		const outboundHtml = await injectEmailTracking(html, mailboxId, messageId, clickSecret);

		const displayName = await getMailboxDisplayName(c.env, mailboxId);
		const { fromHeader, senderString } = formatSenderString(mailboxId, displayName);

		// Build MIME message
		const mimeMessage = buildMimeMessage({
			from: fromHeader,
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
				const message = new EmailMessage(mailboxId, recipient, mimeMessage);
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
				sender: senderString,
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

		if (draft_id) {
			await removeSentDraft(c, mailboxId, draft_id);
		}

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
			"403": {
				description: "`from` is not this mailbox's own address",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Original email not found",
				...contentJson(ErrorResponseSchema),
			},
			"422": {
				description: "A recipient is on the do-not-contact list",
				...contentJson(ErrorResponseSchema),
			},
			"503": {
				description: "The do-not-contact list could not be checked",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { to, cc, bcc, from, subject, html, text, attachments, draft_id } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		// The sender is the mailbox in the URL, never the request body.
		if (from && from.trim().toLowerCase() !== mailboxId.trim().toLowerCase()) {
			return c.json({ error: "The sender must be this mailbox's own address" }, 403);
		}

		// Get the original email
		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);
		const originalEmail = (await stub.getEmail(id)) as any;

		if (!originalEmail) {
			return c.json({ error: "Original email not found" }, 404);
		}

		const toParsed = parseRecipients(to);
		const ccParsed = parseRecipients(cc);
		const bccParsed = parseRecipients(bcc);
		const toList = toParsed.valid;
		const ccList = ccParsed.valid;
		const bccList = bccParsed.valid;
		const allEnvelopeRecipients = Array.from(
			new Set([...toList, ...ccList, ...bccList]),
		);

		// As for a reply: an entry that is not a valid address stops the send.
		const invalidRecipients = [...toParsed.invalid, ...ccParsed.invalid, ...bccParsed.invalid];
		if (invalidRecipients.length > 0) {
			return c.json({ error: describeInvalidRecipients(invalidRecipients) }, 400);
		}

		if (allEnvelopeRecipients.length === 0) {
			return c.json({ error: "No valid recipient found" }, 400);
		}

		// A forward is never a reply, so the do-not-contact list applies to every recipient.
		const block = await checkDoNotContact(c.env, allEnvelopeRecipients);
		if (block) {
			return c.json({ error: block.error, suppressed: block.suppressed }, block.status);
		}

		const messageId = crypto.randomUUID();
		const clickSecret = await c.env.MAILBOX.get(
			c.env.MAILBOX.idFromName("AUTH"),
		).getUnsubscribeSecret();
		const outboundHtml = await injectEmailTracking(html, mailboxId, messageId, clickSecret);

		const displayName = await getMailboxDisplayName(c.env, mailboxId);
		const { fromHeader, senderString } = formatSenderString(mailboxId, displayName);

		// Forwarded emails don't have threading headers
		const mimeMessage = buildMimeMessage({
			from: fromHeader,
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
				const message = new EmailMessage(mailboxId, recipient, mimeMessage);
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
				sender: senderString,
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

		if (draft_id) {
			await removeSentDraft(c, mailboxId, draft_id);
		}

		return c.json({ id: messageId, status: "sent" }, 201);
	}
}
