import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { deliverMessage, type OutboundAttachment } from "../delivery";
import { checkSendAt, parseEmailList } from "../scheduling";
import type { Env, Session } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

export const EmailMetadataSchema = z.object({
	id: z.string(),
	subject: z.string(),
	sender: z.string(),
	recipient: z.string(),
	cc: z.string().nullable().optional(),
	bcc: z.string().nullable().optional(),
	date: z.string(),
	read: z.boolean(),
	starred: z.boolean(),
	in_reply_to: z.string().nullable().optional(),
	email_references: z.string().nullable().optional(),
	thread_id: z.string().nullable().optional(),
	opened_at: z.string().nullable().optional(),
	opened_count: z.number().optional(),
	clicked_at: z.string().nullable().optional(),
	clicked_count: z.number().optional(),
	delivery_status: z.string().nullable().optional(),
	snoozed_until: z.string().nullable().optional(),
	scheduled_at: z.string().nullable().optional(),
	send_error: z.string().nullable().optional(),
});

export const AttachmentSchema = z.object({
	id: z.string(),
	filename: z.string(),
	mimetype: z.string(),
	size: z.number(),
	content_id: z.string().optional(),
	disposition: z.string().optional(),
});

export const EmailSchema = EmailMetadataSchema.extend({
	body: z.string().nullable(),
	attachments: z.array(AttachmentSchema),
});

export const SendEmailRequestSchema = z
	.object({
		to: z.union([z.string(), z.array(z.string())]),
		cc: z.union([z.string(), z.array(z.string())]).optional(),
		bcc: z.union([z.string(), z.array(z.string())]).optional(),
		from: z.string().email(),
		subject: z.string(),
		html: z.string().optional(),
		text: z.string().optional(),
		is_draft: z.boolean().optional(),
		draft_id: z.string().optional(),
		send_at: z.string().optional(),
		attachments: z
			.array(
				z.object({
					content: z.string(), // base64 encoded
					filename: z.string(),
					type: z.string(),
					disposition: z.enum(["attachment", "inline"]).optional(),
					contentId: z.string().optional(),
				}),
			)
			.optional(),
		in_reply_to: z.string().optional(),
		references: z.array(z.string()).optional(),
		thread_id: z.string().optional(),
	})
	.refine((data) => data.is_draft || data.html || data.text, {
		message: "Either 'html' or 'text' must be provided",
	});

export const SendEmailResponseSchema = z.object({
	id: z.string(),
	status: z.string(),
});

export const UpdateEmailStatusRequestSchema = z.object({
	read: z.boolean().optional(),
	starred: z.boolean().optional(),
});

export const MoveEmailRequestSchema = z.object({
	folderId: z.string(),
});

export const SuccessResponseSchema = z.object({
	status: z.string(),
});

export const ErrorResponseSchema = z.object({
	error: z.string(),
});

/**
 * Decode base64 attachment content to raw bytes for R2.
 */
export function base64ToBytes(b64: string): Uint8Array {
	const bin = atob(b64 || "");
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

export class GetEmails extends OpenAPIRoute {
	schema = {
		summary: "List emails in a mailbox",
		operationId: "listEmails",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
			query: z.object({
				folder: z.string().optional(),
				page: z.number().int().optional(),
				limit: z.number().int().min(1).max(200).optional(),
				offset: z.number().int().min(0).optional(),
				before_date: z.string().max(64).optional(),
				before_id: z.string().max(512).optional(),
				sortColumn: z
					.enum([
						"id",
						"subject",
						"sender",
						"recipient",
						"date",
						"read",
						"starred",
					])
					.optional(),
				sortDirection: z.enum(["ASC", "DESC"]).optional(),
				filter: z.string().optional(),
			}),
		},
		responses: {
			"200": {
				description: "List of email metadata",
				...contentJson(z.array(EmailMetadataSchema)),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const { folder, page, limit, offset, before_date, before_id, sortColumn, sortDirection } = data.query;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);

		const emails = await stub.getEmails({
			folder,
			page,
			limit,
			offset,
			beforeDate: before_date,
			beforeId: before_id,
			sortColumn,
			sortDirection,
		});

		return c.json(emails);
	}
}

export class PostEmail extends OpenAPIRoute {
	schema = {
		summary: "Send an email",
		operationId: "sendEmail",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
			body: contentJson(SendEmailRequestSchema),
		},
		responses: {
			"201": {
				description: "Email sent successfully",
				...contentJson(SendEmailResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const {
			to,
			cc,
			bcc,
			from,
			subject,
			html,
			text,
			attachments,
			in_reply_to,
			references,
			thread_id,
			is_draft,
			draft_id,
			send_at,
		} = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const toList = parseEmailList(to);
		const ccList = parseEmailList(cc);
		const bccList = parseEmailList(bcc);
		const allEnvelopeRecipients = Array.from(
			new Set([...toList, ...ccList, ...bccList]),
		);

		let scheduledAt: string | null = null;
		if (send_at && !is_draft) {
			const check = checkSendAt(send_at);
			if (!check.ok) return c.json({ error: check.error }, 400);
			if (allEnvelopeRecipients.length === 0) {
				return c.json({ error: "No valid recipient email provided" }, 400);
			}
			scheduledAt = check.iso ?? null;
		}
		const savesAsDraft = !!is_draft || scheduledAt !== null;

		const messageId = savesAsDraft && draft_id ? draft_id : crypto.randomUUID();

		if (!savesAsDraft) {
			if (allEnvelopeRecipients.length === 0) {
				return c.json({ error: "No valid recipient email provided" }, 400);
			}

			try {
				await deliverMessage(c.env, {
					mailboxId,
					messageId,
					from,
					to: toList,
					cc: ccList,
					bcc: bccList,
					subject,
					html,
					text,
					attachments: attachments as OutboundAttachment[] | undefined,
					inReplyTo: in_reply_to,
					references,
				});
			} catch (e) {
				return c.json({ error: (e as Error).message }, 500);
			}
		}

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);

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
					disposition: att.disposition || "attachment",
				});
			}
		}

		if (savesAsDraft) {
			await stub.upsertDraft(
				messageId,
				{
					id: messageId,
					subject: subject || "(No Subject)",
					sender: from,
					recipient: toList.join(", ") || (Array.isArray(to) ? to.join(", ") : to || ""),
					cc: ccList.length > 0 ? ccList.join(", ") : null,
					bcc: bccList.length > 0 ? bccList.join(", ") : null,
					date: new Date().toISOString(),
					body: html || text || "",
					in_reply_to: in_reply_to || null,
					email_references: references ? JSON.stringify(references) : null,
					thread_id: thread_id || in_reply_to || messageId,
					delivery_status: "draft",
					spam_score: 0.0,
				},
				attachmentData,
			);

			if (scheduledAt) {
				await stub.scheduleDraft(messageId, scheduledAt, mailboxId);
				return c.json({ id: messageId, status: "scheduled", scheduled_at: scheduledAt }, 201);
			}

			return c.json({ id: messageId, status: "draft_saved" }, 201);
		}

		await stub.createEmail(
			"sent",
			{
				id: messageId,
				subject,
				sender: from,
				recipient: toList.join(", ") || (Array.isArray(to) ? to.join(", ") : to),
				cc: ccList.length > 0 ? ccList.join(", ") : null,
				bcc: bccList.length > 0 ? bccList.join(", ") : null,
				date: new Date().toISOString(),
				body: html || text || "",
				in_reply_to: in_reply_to || null,
				email_references: references ? JSON.stringify(references) : null,
				thread_id: thread_id || in_reply_to || messageId,
				delivery_status: "inbox",
				spam_score: 0.0,
			},
			attachmentData,
		);

		if (draft_id) {
			try {
				const oldAttachments = await stub.deleteEmail(draft_id);
				if (oldAttachments && oldAttachments.length > 0) {
					const keys = oldAttachments.map(
						(att: any) => `attachments/${draft_id}/${att.id}/${att.filename}`,
					);
					await c.env.BUCKET.delete(keys);
				}
			} catch (e) {
				console.error("Failed to cleanup draft after send:", e);
			}
		}

		return c.json({ id: messageId, status: "sent" }, 201);
	}
}

export class GetEmail extends OpenAPIRoute {
	schema = {
		summary: "Get a single email",
		operationId: "getEmail",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
		},
		responses: {
			"200": { description: "Email details", ...contentJson(EmailSchema) },
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const email = await stub.getEmail(id);

		if (!email) {
			return c.json({ error: "Email not found" }, 404);
		}

		return c.json(email);
	}
}

export class GetThreadEmails extends OpenAPIRoute {
	schema = {
		summary: "Get conversation thread emails",
		operationId: "getThreadEmails",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				threadId: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "Thread emails list",
				...contentJson(z.array(EmailSchema)),
			},
			"404": { description: "Mailbox not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, threadId } = data.params;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const threadEmails: any = await (stub as any).getThreadEmails(threadId);
		return c.json(threadEmails || []);
	}
}

export class PutEmail extends OpenAPIRoute {
	schema = {
		summary: "Update an email",
		operationId: "updateEmail",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
			body: contentJson(UpdateEmailStatusRequestSchema),
		},
		responses: {
			"200": {
				description: "Updated email metadata",
				...contentJson(EmailMetadataSchema),
			},
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { read, starred } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const email = await stub.updateEmail(id, { read, starred });

		if (!email) {
			return c.json({ error: "Email not found" }, 404);
		}

		return c.json(email);
	}
}

export class DeleteEmail extends OpenAPIRoute {
	schema = {
		summary: "Delete an email",
		operationId: "deleteEmail",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
		},
		responses: {
			"204": { description: "Deleted successfully" },
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const attachments = await stub.deleteEmail(id);

		if (attachments.length > 0) {
			const keys = attachments.map(
				(att) => `attachments/${id}/${att.id}/${att.filename}`,
			);
			await c.env.BUCKET.delete(keys);
		}

		return c.body(null, 204);
	}
}

export class PostMoveEmail extends OpenAPIRoute {
	schema = {
		summary: "Move an email to a folder",
		operationId: "moveEmail",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
			body: contentJson(MoveEmailRequestSchema),
		},
		responses: {
			"200": {
				description: "Moved successfully",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { folderId } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const success = await stub.moveEmail(id, folderId);

		if (!success) {
			return c.json({ error: "Folder not found" }, 400);
		}

		return c.json({ status: "moved" });
	}
}

export class GetAttachment extends OpenAPIRoute {
	schema = {
		summary: "Get an email attachment",
		operationId: "getAttachment",
		tags: ["Emails"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				emailId: z.string(),
				attachmentId: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "Attachment file",
				content: {
					"application/octet-stream": {
						schema: z.string().openapi({ format: "binary" }),
					},
				},
			},
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, emailId, attachmentId } = data.params ?? {};

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const attachment = await stub.getAttachment(attachmentId);

		if (!attachment) {
			return c.json({ error: "Attachment not found" }, 404);
		}

		const attachmentKey = `attachments/${emailId}/${attachmentId}/${attachment.filename}`;
		const attachmentObj = await c.env.BUCKET.get(attachmentKey);

		if (!attachmentObj) {
			return c.json({ error: "Attachment file not found" }, 404);
		}

		const headers = new Headers();
		headers.set("Content-Type", attachment.mimetype);
		headers.set(
			"Content-Disposition",
			`attachment; filename="${attachment.filename}"`,
		);

		return new Response(attachmentObj.body, {
			headers,
		});
	}
}

export class GetSearch extends OpenAPIRoute {
	schema = {
		summary: "Search for emails",
		operationId: "searchEmails",
		tags: ["Search"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
			query: z.object({
				query: z.string(),
				folder: z.string().optional(),
				from: z.string().optional(),
				to: z.string().optional(),
				date_start: z.string().datetime().optional(),
				date_end: z.string().datetime().optional(),
			}),
		},
		responses: {
			"200": {
				description: "List of matching emails",
				...contentJson(z.array(EmailMetadataSchema)),
			},
		},
	};

	async handle(c: any): Promise<Response> {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const { query, folder, from, to, date_start, date_end } = data.query;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);

		const emails = await stub.searchEmails({
			query,
			folder,
			from,
			to,
			date_start,
			date_end,
		});

		return c.json(emails as any);
	}
}
