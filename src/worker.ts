import { EmailMessage } from "cloudflare:email";
import { contentJson, fromHono, OpenAPIRoute } from "chanfana";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import PostalMime from "postal-mime";
import { z } from "zod";
import { buildMimeMessage } from "./mime-builder";
import { registerFollowUpRoutes, runFollowUps } from "./routes/followups";
import { registerSchedulingRoutes, runDueAcrossMailboxes } from "./routes/scheduling";
import { registerSuppressionRoutes } from "./routes/suppression";
import { registerTemplateRoutes } from "./routes/templates";
import { deliverMessage, type OutboundAttachment } from "./delivery";
import { checkSendAt, parseEmailList } from "./scheduling";
import { parseBounce, renderLeavingPage, isHttpUrl, verifyClickLink } from "./suppression";
import { injectEmailTracking } from "./tracking";

export { injectEmailTracking };
import {
	GetMe,
	GetUsers,
	PostAdminRegister,
	PostGrantAccess,
	PostLogin,
	PostLogout,
	PostRegister,
	PostRevokeAccess,
	PutUser,
} from "./routes/auth";
import {
	DeleteAppBinding,
	GetAppBindingByEmail,
	GetAppBindings,
	GetAppLookup,
	PostAppBinding,
} from "./routes/app-bindings";
import {
	DeleteDiscoverLead,
	GetDiscoverApps,
	GetDiscoverLeads,
	PostDiscoverLead,
} from "./routes/discover";
import { PostForwardEmail, PostReplyEmail } from "./routes/reply-forward";
import {
	GetVapidPublicKey,
	PostSubscribePush,
	PostTestPush,
	PostUnsubscribePush,
} from "./routes/push";
import type { EmailExplorerOptions, Env, Session } from "./types";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

export { MailboxDO } from "./durableObject";

// Schemas
const MailboxSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
});

const MailboxDetailsSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
	settings: z.record(z.any()),
});

const UpdateMailboxRequestSchema = z.object({
	settings: z.record(z.any()),
});

const CreateMailboxRequestSchema = z.object({
	email: z.string().email(),
	name: z.string().min(1),
	settings: z.record(z.any()).optional(),
});

const ErrorResponseSchema = z.object({
	error: z.string(),
});

const ForgotPasswordRequestSchema = z.object({
	email: z.string().email(),
});

const ResetPasswordRequestSchema = z.object({
	token: z.string(),
	newPassword: z.string().min(8),
});

const AppSettingsResponseSchema = z.object({
	auth: z.object({
		enabled: z.boolean(),
		registerEnabled: z.boolean(),
	}),
	accountRecovery: z.object({
		enabled: z.boolean(),
	}),
});

const EmailMetadataSchema = z.object({
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

const AttachmentSchema = z.object({
	id: z.string(),
	filename: z.string(),
	mimetype: z.string(),
	size: z.number(),
	content_id: z.string().optional(),
	disposition: z.string().optional(),
});

const EmailSchema = EmailMetadataSchema.extend({
	body: z.string().nullable(),
	attachments: z.array(AttachmentSchema),
});

const SendEmailRequestSchema = z
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
		/** ISO time to send at. The message is stored as a scheduled draft and sent by an alarm. */
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

const SendEmailResponseSchema = z.object({
	id: z.string(),
	status: z.string(),
});

const UpdateEmailStatusRequestSchema = z.object({
	read: z.boolean().optional(),
	starred: z.boolean().optional(),
});

const MoveEmailRequestSchema = z.object({
	folderId: z.string(),
});

const SuccessResponseSchema = z.object({
	status: z.string(),
});

const FolderSchema = z.object({
	id: z.string(),
	name: z.string(),
	unreadCount: z.number(),
});

const CreateFolderRequestSchema = z.object({
	name: z.string(),
});

const UpdateFolderRequestSchema = z.object({
	name: z.string(),
});

const ContactSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
});

const CreateContactRequestSchema = z.object({
	name: z.string().optional(),
	email: z.string(),
});

const UpdateContactRequestSchema = z.object({
	name: z.string().optional(),
	email: z.string().optional(),
});

function slugify(text: string) {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, "-") // Replace spaces with -
		.replace(/[^\w-]+/g, "") // Remove all non-word chars
		.replace(/--+/g, "-") // Replace multiple - with single -
		.replace(/^-+/, "") // Trim - from start of text
		.replace(/-+$/, ""); // Trim - from end of text
}

// Routes
class GetMailboxes extends OpenAPIRoute {
	schema = {
		summary: "List all mailboxes",
		operationId: "listMailboxes",
		tags: ["Mailboxes"],
		responses: {
			"200": {
				description: "List of mailboxes",
				...contentJson(z.array(MailboxSchema)),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");

		const list = await c.env.BUCKET.list({
			prefix: "mailboxes/",
		});
		const allMailboxes = list.objects.map((obj) => {
			const id = obj.key.replace("mailboxes/", "").replace(".json", "");
			return {
				id,
				name: id,
				email: id,
			};
		});

		// If no session (auth disabled) or user is admin, return all mailboxes
		if (!session || session.isAdmin) {
			return c.json(allMailboxes);
		}

		// Non-admin users can only see mailboxes they have access to
		const authId = c.env.MAILBOX.idFromName("AUTH");
		const authDO = c.env.MAILBOX.get(authId);
		const userMailboxes = await authDO.getUserMailboxes(session.userId);
		const allowedMailboxIds = new Set(userMailboxes.map((m) => m.mailboxId));

		return c.json(allMailboxes.filter((m) => allowedMailboxIds.has(m.id)));
	}
}

class GetMailbox extends OpenAPIRoute {
	schema = {
		summary: "Get a single mailbox",
		operationId: "getMailbox",
		tags: ["Mailboxes"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "Mailbox details",
				...contentJson(MailboxDetailsSchema),
			},
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.get(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}
		const settings = await obj.json();
		const response = {
			id: mailboxId,
			name: mailboxId,
			email: mailboxId,
			settings: settings,
		};
		return c.json(response);
	}
}

class PutMailbox extends OpenAPIRoute {
	schema = {
		summary: "Update a mailbox",
		operationId: "updateMailbox",
		tags: ["Mailboxes"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
			body: contentJson(UpdateMailboxRequestSchema),
		},
		responses: {
			"200": {
				description: "Updated mailbox",
				...contentJson(MailboxDetailsSchema),
			},
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const { settings } = data.body;
		const key = `mailboxes/${mailboxId}.json`;

		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		await c.env.BUCKET.put(key, JSON.stringify(settings));

		const response = {
			id: mailboxId,
			name: mailboxId,
			email: mailboxId,
			settings: settings,
		};
		return c.json(response);
	}
}

class DeleteMailbox extends OpenAPIRoute {
	schema = {
		summary: "Delete a mailbox",
		operationId: "deleteMailbox",
		tags: ["Mailboxes"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
		},
		responses: {
			"204": { description: "Deleted successfully" },
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const key = `mailboxes/${mailboxId}.json`;

		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		await c.env.BUCKET.delete(key);

		// TODO: delete durable object
		return c.body(null, 204);
	}
}

class PostMailbox extends OpenAPIRoute {
	schema = {
		summary: "Create a new mailbox",
		operationId: "createMailbox",
		tags: ["Mailboxes"],
		request: {
			body: contentJson(CreateMailboxRequestSchema),
		},
		responses: {
			"201": {
				description: "Mailbox created successfully",
				...contentJson(MailboxDetailsSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"409": {
				description: "Mailbox already exists",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { email, name, settings } = data.body;

		const key = `mailboxes/${email}.json`;

		// Check if mailbox already exists
		const existing = await c.env.BUCKET.head(key);
		if (existing) {
			return c.json({ error: "Mailbox already exists" }, 409);
		}

		// Default settings
		const defaultSettings = {
			fromName: name,
			forwarding: {
				enabled: false,
				email: "",
			},
			signature: {
				enabled: false,
				text: "",
			},
			autoReply: {
				enabled: false,
				subject: "",
				message: "",
			},
		};

		const finalSettings = { ...defaultSettings, ...settings };

		// Save mailbox settings to R2
		await c.env.BUCKET.put(key, JSON.stringify(finalSettings));

		// Initialize the durable object for this mailbox
		const ns = c.env.MAILBOX;
		const id = ns.idFromName(email);
		const stub = ns.get(id);

		// Trigger first run of the durable object to initialize database
		await stub.getFolders();

		const response = {
			id: email,
			email: email,
			name: name,
			settings: finalSettings,
		};

		return c.json(response, 201);
	}
}

class GetEmails extends OpenAPIRoute {
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
				/** Keyset cursor: return messages older than this (date, id). Preferred over `offset` for paging. */
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

/**
 * Decode base64 attachment content to raw bytes for R2. (Putting the `atob()` *string* stored it
 * UTF-8-encoded, which corrupted every byte >= 0x80 — i.e. any binary attachment on sent mail / drafts.)
 */
export function base64ToBytes(b64: string): Uint8Array {
	const bin = atob(b64 || "");
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

class PostEmail extends OpenAPIRoute {
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

		// A scheduled send is saved as a draft that carries its send time; an alarm sends it later.
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

		// If not a draft, send email via Cloudflare Email Sending
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

class GetEmail extends OpenAPIRoute {
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

class GetThreadEmails extends OpenAPIRoute {
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

class PutEmail extends OpenAPIRoute {
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

class DeleteEmail extends OpenAPIRoute {
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

class PostMoveEmail extends OpenAPIRoute {
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

class GetFolders extends OpenAPIRoute {
	schema = {
		summary: "List all folders",
		operationId: "listFolders",
		tags: ["Folders"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "List of folders",
				...contentJson(z.array(FolderSchema)),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);

		const folders = await stub.getFolders();

		return c.json(folders);
	}
}

class PostFolder extends OpenAPIRoute {
	schema = {
		summary: "Create a folder",
		operationId: "createFolder",
		tags: ["Folders"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
			body: contentJson(CreateFolderRequestSchema),
		},
		responses: {
			"201": { description: "Folder created", ...contentJson(FolderSchema) },
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const { name } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const slug = slugify(name);
		const newFolder = await stub.createFolder(slug, name);

		if (!newFolder) {
			return c.json({ error: "Folder with this name already exists" }, 409);
		}

		return c.json(newFolder, 201);
	}
}

class PutFolder extends OpenAPIRoute {
	schema = {
		summary: "Update a folder",
		operationId: "updateFolder",
		tags: ["Folders"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
			body: contentJson(UpdateFolderRequestSchema),
		},
		responses: {
			"200": { description: "Updated folder", ...contentJson(FolderSchema) },
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { name } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const updatedFolder = await stub.updateFolder(id, name);

		if (!updatedFolder) {
			return c.json({ error: "Folder not found" }, 404);
		}

		return c.json(updatedFolder);
	}
}

class DeleteFolder extends OpenAPIRoute {
	schema = {
		summary: "Delete a folder",
		operationId: "deleteFolder",
		tags: ["Folders"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
		},
		responses: {
			"204": { description: "Deleted successfully" },
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

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const success = await stub.deleteFolder(id);

		if (!success) {
			return c.json({ error: "Folder not found or cannot be deleted" }, 400);
		}

		return c.body(null, 204);
	}
}

class GetContacts extends OpenAPIRoute {
	schema = {
		summary: "List all contacts",
		operationId: "listContacts",
		tags: ["Contacts"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "List of contacts",
				...contentJson(z.array(ContactSchema)),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);

		const contacts = await stub.getContacts();

		return c.json(contacts);
	}
}

class PostContact extends OpenAPIRoute {
	schema = {
		summary: "Create a contact",
		operationId: "createContact",
		tags: ["Contacts"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
			body: contentJson(CreateContactRequestSchema),
		},
		responses: {
			"201": { description: "Contact created", ...contentJson(ContactSchema) },
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const { name, email } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);

		const newContact = await stub.createContact({ name, email });

		return c.json(newContact, 201);
	}
}

class PutContact extends OpenAPIRoute {
	schema = {
		summary: "Update a contact",
		operationId: "updateContact",
		tags: ["Contacts"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
			body: contentJson(UpdateContactRequestSchema),
		},
		responses: {
			"200": { description: "Updated contact", ...contentJson(ContactSchema) },
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { name, email } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const updatedContact = await stub.updateContact(Number.parseInt(id, 10), {
			name,
			email,
		});

		if (!updatedContact) {
			return c.json({ error: "Contact not found" }, 404);
		}

		return c.json(updatedContact);
	}
}

class DeleteContact extends OpenAPIRoute {
	schema = {
		summary: "Delete a contact",
		operationId: "deleteContact",
		tags: ["Contacts"],
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

		stub.deleteContact(Number.parseInt(id, 10));

		return c.body(null, 204);
	}
}

class GetSearch extends OpenAPIRoute {
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

	async handle(c: AppContext) {
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

		return c.json(emails);
	}
}

class GetAttachment extends OpenAPIRoute {
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

class CreateDummyMailbox extends OpenAPIRoute {
	schema = {
		summary: "Create a dummy mailbox for debugging",
		operationId: "createDummyMailbox",
		tags: ["Debug"],
		responses: {
			"200": {
				description: "Dummy mailbox created",
				...contentJson(z.object({ status: z.string() })),
			},
		},
	};

	async handle(c: AppContext) {
		const mailboxId = "test@example.com";
		const key = `mailboxes/${mailboxId}.json`;
		const settings = {
			fromName: "Test User",
			forwarding: {
				enabled: false,
				email: "",
			},
			signature: {
				enabled: true,
				text: "Sent from my awesome email client",
			},
			autoReply: {
				enabled: false,
				subject: "",
				message: "",
			},
		};

		await c.env.BUCKET.put(key, JSON.stringify(settings));

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);

		// This will trigger the first run of the durable object
		await stub.getFolders();

		return c.json({ status: "ok" });
	}
}

class PostForgotPassword extends OpenAPIRoute {
	schema = {
		summary: "Request password reset email",
		operationId: "forgotPassword",
		tags: ["Auth"],
		request: {
			body: contentJson(ForgotPasswordRequestSchema),
		},
		responses: {
			"200": {
				description: "Password reset email sent",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "User not found",
				...contentJson(ErrorResponseSchema),
			},
			"503": {
				description: "Account recovery disabled",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		if (!c.env.config?.accountRecovery) {
			return c.json({ error: "Account recovery is not enabled" }, 503);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { email } = data.body;

		const ns = c.env.MAILBOX;
		const authId = ns.idFromName("AUTH");
		const authStub = ns.get(authId);

		const user = await authStub.getUserByEmail(email);
		if (!user) {
			return c.json({ error: "User not found" }, 404);
		}

		// Generate reset token (valid for 1 hour)
		const token = crypto.randomUUID();
		const expiresAt = Date.now() + 3600000; // 1 hour

		// Store token in R2
		const tokenKey = `recovery-tokens/${token}.json`;
		await c.env.BUCKET.put(
			tokenKey,
			JSON.stringify({
				userId: user.id,
				email: user.email,
				expiresAt,
			}),
			{
				customMetadata: {
					expiresAt: expiresAt.toString(),
				},
			},
		);

		// Send recovery email
		const resetLink = `${new URL(c.req.url).origin}/reset-password?token=${token}`;
		const mimeMessage = buildMimeMessage({
			from: c.env.config.accountRecovery.fromEmail,
			to: email,
			subject: "Password Reset Request",
			html: `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
		.content { background-color: #f9f9f9; padding: 20px; border-radius: 5px; }
		.button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h2 style="margin: 0;">Password Reset Request</h2>
		</div>
		<div class="content">
			<p>We received a request to reset your password. Click the button below to proceed:</p>
			<a href="${resetLink}" class="button">Reset Password</a>
			<p>Or copy and paste this link in your browser:</p>
			<p><a href="${resetLink}" style="color: #4F46E5; word-break: break-all;">${resetLink}</a></p>
			<p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
			<p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
		</div>
		<div class="footer">
			<p>Email Explorer - Password Reset</p>
		</div>
	</div>
</body>
</html>`,
			text: `Password Reset Request

We received a request to reset your password. Click the link below to proceed:

${resetLink}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.`,
		});

		const emailMessage = new EmailMessage(
			c.env.config.accountRecovery.fromEmail,
			email,
			mimeMessage,
		);

		try {
			await c.env.SEND_EMAIL.send(emailMessage);
		} catch (e) {
			console.error("Failed to send recovery email:", e);
			return c.json({ error: "Failed to send recovery email" }, 500);
		}

		return c.json({ status: "Password reset email sent" });
	}
}

class PostResetPassword extends OpenAPIRoute {
	schema = {
		summary: "Reset password with token",
		operationId: "resetPassword",
		tags: ["Auth"],
		request: {
			body: contentJson(ResetPasswordRequestSchema),
		},
		responses: {
			"200": {
				description: "Password reset successfully",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Invalid or expired token",
				...contentJson(ErrorResponseSchema),
			},
			"503": {
				description: "Account recovery disabled",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		if (!c.env.config?.accountRecovery) {
			return c.json({ error: "Account recovery is not enabled" }, 503);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { token, newPassword } = data.body;

		// Verify token
		const tokenKey = `recovery-tokens/${token}.json`;
		const tokenObj = await c.env.BUCKET.get(tokenKey);

		if (!tokenObj) {
			return c.json({ error: "Invalid or expired token" }, 401);
		}

		const tokenData = await tokenObj.json<{
			userId: string;
			email: string;
			expiresAt: number;
		}>();

		if (tokenData.expiresAt < Date.now()) {
			await c.env.BUCKET.delete(tokenKey);
			return c.json({ error: "Token has expired" }, 401);
		}

		// Update password
		const ns = c.env.MAILBOX;
		const authId = ns.idFromName("AUTH");
		const authStub = ns.get(authId);

		try {
			await authStub.updateUserPassword(tokenData.userId, newPassword);
		} catch (e) {
			return c.json({ error: "Failed to update password" }, 500);
		}

		// Delete used token
		await c.env.BUCKET.delete(tokenKey);

		return c.json({ status: "Password reset successfully" });
	}
}

class GetAppSettings extends OpenAPIRoute {
	schema = {
		summary: "Get application settings",
		operationId: "getAppSettings",
		tags: ["Settings"],
		responses: {
			"200": {
				description: "Application settings",
				...contentJson(AppSettingsResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const config = c.env.config || {};
		const authEnabled = config.auth?.enabled !== false;

		// Check if there are any users in the system
		let userCount = 0;
		if (authEnabled) {
			const ns = c.env.MAILBOX;
			const authId = ns.idFromName("AUTH");
			const authStub = ns.get(authId);
			try {
				const users = await authStub.getUsers();
				userCount = users.length;
			} catch (e) {
				// If we can't get users, assume there are users (safer default)
				userCount = 1;
			}
		}

		// Registration is enabled if:
		// 1. Explicitly enabled in config, OR
		// 2. Not explicitly disabled AND there are 0 users (fresh app)
		const registerEnabled =
			config.auth?.registerEnabled === true ||
			(config.auth?.registerEnabled !== false && userCount === 0);

		// Account recovery is enabled if the config has accountRecovery with fromEmail
		const accountRecoveryEnabled =
			config.accountRecovery?.fromEmail !== undefined;

		return c.json({
			auth: {
				enabled: authEnabled,
				registerEnabled,
			},
			accountRecovery: {
				enabled: accountRecoveryEnabled,
			},
		});
	}
}

// Helper function to extract session token
function getSessionToken(request: Request): string | null {
	// Try Authorization header first
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.substring(7);
	}

	// Try cookie
	const cookie = request.headers.get("Cookie");
	if (cookie) {
		const match = cookie.match(/session=([^;]+)/);
		return match ? match[1] : null;
	}

	return null;
}

// Helper function to validate session
async function validateSession(
	request: Request,
	env: Env,
): Promise<Session | null> {
	const token = getSessionToken(request);
	if (!token) return null;

	const authId = env.MAILBOX.idFromName("AUTH");
	const authDO = env.MAILBOX.get(authId);

	try {
		const session = await authDO.validateSession(token);
		return session;
	} catch {
		return null;
	}
}

// Helper function to check if route is public
function isPublicRoute(pathname: string): boolean {
	const publicRoutes = [
		"/api/v1/auth/register",
		"/api/v1/auth/login",
		"/api/v1/auth/forgot-password",
		"/api/v1/auth/reset-password",
		"/api/v1/settings",
		"/api/docs",
		"/api/openapi.json",
		"/api/v1/track/",
		"/api/v1/unsubscribe/",
	];
	return publicRoutes.some((route) => pathname.startsWith(route));
}

// Helper function to check if route requires session (auth routes)
function requiresSession(pathname: string): boolean {
	const authRoutes = [
		"/api/v1/auth/me",
		"/api/v1/auth/logout",
		"/api/v1/auth/admin",
	];
	return authRoutes.some((route) => pathname.startsWith(route));
}

const app = new Hono<{ Bindings: Env; Variables: { session?: Session } }>();
app.use("/api/*", cors());

// Transparent 1x1 GIF for open tracking
const TRANSPARENT_GIF_BYTES = Uint8Array.from(
	atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
	(c) => c.charCodeAt(0),
);

app.get("/api/v1/track/open/:mailboxId/:emailId", async (c) => {
	const rawMailboxId = c.req.param("mailboxId");
	const mailboxId = decodeURIComponent(rawMailboxId);
	const emailId = c.req.param("emailId");
	try {
		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);
		await stub.recordOpen(emailId);
	} catch (e) {
		// Suppress tracking errors so the recipient image load never fails
	}
	return new Response(TRANSPARENT_GIF_BYTES, {
		status: 200,
		headers: {
			"Content-Type": "image/gif",
			"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
			"Pragma": "no-cache",
			"Expires": "0",
			"Access-Control-Allow-Origin": "*",
			"Timing-Allow-Origin": "*",
			"Surrogate-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
});

app.get("/api/v1/track/click/:mailboxId/:emailId", async (c) => {
	const rawMailboxId = c.req.param("mailboxId");
	const mailboxId = decodeURIComponent(rawMailboxId);
	const emailId = c.req.param("emailId");
	const targetUrl = c.req.query("url");
	const sig = c.req.query("s") ?? "";
	const fallback = "https://reflect.cloud";
	if (!isHttpUrl(targetUrl)) return c.redirect(fallback, 302);

	let secret: string;
	try {
		secret = await c.env.MAILBOX.get(c.env.MAILBOX.idFromName("AUTH")).getUnsubscribeSecret();
	} catch {
		return c.redirect(fallback, 302);
	}

	const recordClick = async () => {
		try {
			await c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId)).recordClick(emailId);
		} catch {
			// Ignore recording failure, still redirect user
		}
	};

	if (sig) {
		// A signature that does not match means the link was altered: never redirect to it.
		if (!(await verifyClickLink(secret, mailboxId, emailId, targetUrl, sig))) {
			return c.redirect(fallback, 302);
		}
		await recordClick();
		return c.redirect(targetUrl, 302);
	}

	// Links sent before signing existed carry no signature and cannot be trusted, so the
	// visitor sees the destination and confirms instead of being redirected.
	await recordClick();
	return c.html(renderLeavingPage(targetUrl), 200, {
		"Cache-Control": "no-store",
		"Referrer-Policy": "no-referrer",
	});
});

registerSuppressionRoutes(app);
registerTemplateRoutes(app);
registerFollowUpRoutes(app);
registerSchedulingRoutes(app);

const openapi = fromHono(app);

// Auth endpoints
openapi.post("/api/v1/auth/register", PostRegister);
openapi.post("/api/v1/auth/login", PostLogin);
openapi.post("/api/v1/auth/logout", PostLogout);
openapi.get("/api/v1/auth/me", GetMe);
openapi.post("/api/v1/auth/forgot-password", PostForgotPassword);
openapi.post("/api/v1/auth/reset-password", PostResetPassword);
openapi.post("/api/v1/auth/admin/register", PostAdminRegister);
openapi.get("/api/v1/auth/admin/users", GetUsers);
openapi.put("/api/v1/auth/admin/users/:userId", PutUser);
openapi.post("/api/v1/auth/admin/grant-access", PostGrantAccess);
openapi.post("/api/v1/auth/admin/revoke-access", PostRevokeAccess);

// Settings endpoints
openapi.get("/api/v1/settings", GetAppSettings);

// App Bindings endpoints
openapi.get("/api/v1/app-bindings", GetAppBindings);
openapi.get("/api/v1/app-bindings/:email", GetAppBindingByEmail);
openapi.post("/api/v1/app-bindings", PostAppBinding);
openapi.delete("/api/v1/app-bindings/:email", DeleteAppBinding);
openapi.get("/api/v1/app-lookup", GetAppLookup);

// App Discovery & MMP Outreach endpoints
openapi.get("/api/v1/discover/apps", GetDiscoverApps);
openapi.get("/api/v1/discover/leads", GetDiscoverLeads);
openapi.post("/api/v1/discover/leads", PostDiscoverLead);
openapi.delete("/api/v1/discover/leads/:id", DeleteDiscoverLead);

// Web Push Notifications endpoints (supported with and without /v1)
openapi.get("/api/v1/push/vapid-public-key", GetVapidPublicKey);
openapi.post("/api/v1/push/subscribe", PostSubscribePush);
openapi.post("/api/v1/push/unsubscribe", PostUnsubscribePush);
openapi.post("/api/v1/push/test", PostTestPush);

openapi.get("/api/push/vapid-public-key", GetVapidPublicKey);
openapi.post("/api/push/subscribe", PostSubscribePush);
openapi.post("/api/push/unsubscribe", PostUnsubscribePush);
openapi.post("/api/push/test", PostTestPush);

// Existing endpoints
openapi.post("/api/v1/debug/create-mailbox", CreateDummyMailbox);
openapi.get("/api/v1/mailboxes", GetMailboxes);
openapi.post("/api/v1/mailboxes", PostMailbox);
openapi.get("/api/v1/mailboxes/:mailboxId", GetMailbox);
openapi.put("/api/v1/mailboxes/:mailboxId", PutMailbox);
openapi.delete("/api/v1/mailboxes/:mailboxId", DeleteMailbox);
openapi.get("/api/v1/mailboxes/:mailboxId/emails", GetEmails);
openapi.post("/api/v1/mailboxes/:mailboxId/emails", PostEmail);
openapi.get("/api/v1/mailboxes/:mailboxId/emails/:id", GetEmail);
openapi.get("/api/v1/mailboxes/:mailboxId/threads/:threadId", GetThreadEmails);
openapi.put("/api/v1/mailboxes/:mailboxId/emails/:id", PutEmail);
openapi.delete("/api/v1/mailboxes/:mailboxId/emails/:id", DeleteEmail);
openapi.post("/api/v1/mailboxes/:mailboxId/emails/:id/move", PostMoveEmail);
openapi.post("/api/v1/mailboxes/:mailboxId/emails/:id/reply", PostReplyEmail);
openapi.post(
	"/api/v1/mailboxes/:mailboxId/emails/:id/forward",
	PostForwardEmail,
);
openapi.get("/api/v1/mailboxes/:mailboxId/folders", GetFolders);
openapi.post("/api/v1/mailboxes/:mailboxId/folders", PostFolder);
openapi.put("/api/v1/mailboxes/:mailboxId/folders/:id", PutFolder);
openapi.delete("/api/v1/mailboxes/:mailboxId/folders/:id", DeleteFolder);
openapi.get("/api/v1/mailboxes/:mailboxId/contacts", GetContacts);
openapi.post("/api/v1/mailboxes/:mailboxId/contacts", PostContact);
openapi.put("/api/v1/mailboxes/:mailboxId/contacts/:id", PutContact);
openapi.delete("/api/v1/mailboxes/:mailboxId/contacts/:id", DeleteContact);
openapi.get("/api/v1/mailboxes/:mailboxId/search", GetSearch);
openapi.get(
	"/api/v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId",
	GetAttachment,
);

async function streamToArrayBuffer(stream: ReadableStream, streamSize: number) {
	const result = new Uint8Array(streamSize);
	let bytesRead = 0;
	const reader = stream.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		result.set(value, bytesRead);
		bytesRead += value.length;
	}
	return result;
}

async function receiveEmail(
	event: { raw: ReadableStream; rawSize: number },
	env: Env,
	_ctx: ExecutionContext,
) {
	const rawEmail = await streamToArrayBuffer(event.raw, event.rawSize);
	const parser = new PostalMime();
	const parsedEmail = await parser.parse(rawEmail);

	if (
		!parsedEmail.to ||
		parsedEmail.to.length === 0 ||
		!parsedEmail.to[0].address
	) {
		throw new Error("received email with empty to");
	}

	const mailboxId = parsedEmail.to[0].address;
	const messageId = crypto.randomUUID();

	const key = `mailboxes/${mailboxId}.json`;
	const obj = await env.BUCKET.head(key);
	if (!obj) {
		await env.BUCKET.put(key, JSON.stringify({}));
	}

	const ns = env.MAILBOX;
	const id = ns.idFromName(mailboxId);
	const stub = ns.get(id);

	const attachmentData = [];
	if (parsedEmail.attachments) {
		for (const att of parsedEmail.attachments) {
			const attachmentId = crypto.randomUUID();
			const key = `attachments/${messageId}/${attachmentId}/${att.filename}`;
			await env.BUCKET.put(key, att.content);
			attachmentData.push({
				id: attachmentId,
				email_id: messageId,
				filename: att.filename || "untitled",
				mimetype: att.mimeType,
				size:
					typeof att.content === "string"
						? att.content.length
						: att.content.byteLength,
				content_id: att.contentId || null,
				disposition: att.disposition,
			});
		}
	}

	// Parse threading headers from incoming email
	// Strip angle brackets from message IDs since postal-mime returns raw RFC 2822
	// values (e.g. "<msg@example.com>") but we store bare IDs to match outgoing emails
	const stripBrackets = (s: string) => s.replace(/^</, "").replace(/>$/, "");
	const inReplyTo = parsedEmail.inReplyTo
		? stripBrackets(parsedEmail.inReplyTo)
		: null;
	const emailReferences = parsedEmail.references
		? parsedEmail.references.split(/\s+/).filter(Boolean).map(stripBrackets)
		: [];

	const toAddresses = parsedEmail.to?.map((t) => t.address).filter(Boolean) || [];
	const ccAddresses = parsedEmail.cc?.map((c) => c.address).filter(Boolean) || [];

	// Determine spam classification from headers
	const headers = parsedEmail.headers || [];
	const findHeader = (name: string) => {
		const h = headers.find((item: any) => item.key?.toLowerCase() === name.toLowerCase());
		return h ? String(h.value).toLowerCase() : "";
	};

	const authResults = findHeader("authentication-results");
	const spamStatus = findHeader("x-spam-status");
	const isSpam =
		spamStatus.includes("yes") ||
		authResults.includes("dkim=fail") ||
		authResults.includes("spf=fail") ||
		authResults.includes("dmarc=fail");

	const targetFolder = isSpam ? "spam" : "inbox";
	const deliveryStatus = isSpam ? "spam" : "inbox";

	await stub.createEmail(
		targetFolder,
		{
			id: messageId,
			subject: parsedEmail.subject || "",
			sender: parsedEmail.from?.address || "",
			recipient: toAddresses.join(", ") || parsedEmail.to[0].address,
			cc: ccAddresses.length > 0 ? ccAddresses.join(", ") : null,
			date: new Date().toISOString(),
			body: parsedEmail.html || parsedEmail.text || "",
			in_reply_to: inReplyTo,
			email_references:
				emailReferences.length > 0 ? JSON.stringify(emailReferences) : null,
			thread_id: emailReferences[0] || inReplyTo || messageId,
			delivery_status: deliveryStatus,
			spam_score: isSpam ? 5.0 : 0.0,
		},
		attachmentData,
		mailboxId,
	);

	// A permanent-failure bounce marks the original sent message and puts the address on the
	// suppression list. Never allowed to break delivery of the bounce itself.
	try {
		const headerMap: Record<string, string> = {};
		for (const h of headers as Array<{ key?: string; value?: unknown }>) {
			if (h.key) headerMap[h.key.toLowerCase()] = String(h.value ?? "");
		}
		const decoder = new TextDecoder();
		let bodyText = parsedEmail.text || "";
		for (const att of parsedEmail.attachments || []) {
			if (/delivery-status|rfc822-headers/i.test(att.mimeType || "")) {
				bodyText +=
					"\n\n" +
					(typeof att.content === "string" ? att.content : decoder.decode(att.content));
			}
		}
		const bounce = parseBounce({
			fromAddress: parsedEmail.from?.address || "",
			subject: parsedEmail.subject || "",
			headers: headerMap,
			bodyText,
		});
		if (bounce) {
			const authDO = env.MAILBOX.get(env.MAILBOX.idFromName("AUTH"));
			for (const address of bounce.recipients) {
				if (await stub.markBounced(address)) {
					await authDO.addSuppression(
						address,
						"bounce",
						"Permanent delivery failure (hard bounce)",
						mailboxId,
					);
				}
			}
		}
	} catch (err) {
		console.error("Bounce handling failed:", err);
	}
}

const defaultOptions: EmailExplorerOptions = {
	auth: {
		enabled: true, // Auth is enabled by default for security
		registerEnabled: undefined, // Smart mode: first user becomes admin, then registration closes
	},
};

export function EmailExplorer(_options: EmailExplorerOptions = {}) {
	// Merge user options with defaults
	const options: EmailExplorerOptions = {
		..._options,
		auth: {
			...defaultOptions.auth,
			..._options.auth,
		},
	};

	return {
		async email(
			event: { raw: ReadableStream; rawSize: number },
			env: Env,
			context: ExecutionContext,
		) {
			await receiveEmail(event, env, context);
		},
		/** Cron: prepares follow-up drafts and runs due queue items across mailboxes. */
		async scheduled(_event: unknown, env: Env, context: ExecutionContext) {
			context.waitUntil(
				Promise.allSettled([
					runFollowUps(env).catch((err) => console.error("Scheduled follow-ups failed:", err)),
					runDueAcrossMailboxes(env).catch((err) => console.error("Scheduled mail queue check failed:", err)),
				]),
			);
		},
		async fetch(request: Request, env: Env, context: ExecutionContext) {
			// Make options available to routes via env
			env.config = options;

			// Create a new request with context for middleware
			const url = new URL(request.url);

			// Check if auth is required (either globally enabled or auth-specific routes)
			// Auth is enforced by default (when enabled is undefined) unless explicitly disabled
			const needsAuth =
				(options.auth?.enabled !== false && !isPublicRoute(url.pathname)) ||
				requiresSession(url.pathname);

			if (needsAuth) {
				const session = await validateSession(request, env);
				if (!session) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				// Create new Hono app with session in context
				const authApp = new Hono<{
					Bindings: Env;
					Variables: { session?: Session };
				}>();

				// Middleware to inject session
				authApp.use("*", async (c, next) => {
					c.set("session", session);
					await next();
				});

				// Middleware to check mailbox access for non-admin users
				const checkMailboxAccess = async (c: any, next: any) => {
					if (session.isAdmin) {
						await next();
						return;
					}
					const mailboxId = c.req.param("mailboxId");
					if (!mailboxId) {
						await next();
						return;
					}
					const authId = env.MAILBOX.idFromName("AUTH");
					const authDO = env.MAILBOX.get(authId);
					const userMailboxes = await authDO.getUserMailboxes(session.userId);
					if (!userMailboxes.some((m: any) => m.mailboxId === mailboxId)) {
						return c.json(
							{ error: "You don't have access to this mailbox" },
							403,
						);
					}
					await next();
				};
				authApp.use("/api/v1/mailboxes/:mailboxId", checkMailboxAccess);
				authApp.use("/api/v1/mailboxes/:mailboxId/*", checkMailboxAccess);

				// Mount the main app
				authApp.route("/", app);

				return authApp.fetch(request, env, context);
			}

			return app.fetch(request, env, context);
		},
	};
}
