import { EmailMessage } from "cloudflare:email";
import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { type MailboxRole, roleForMailbox } from "../access";
import { buildMimeMessage } from "../mime-builder";
import type { Env, Session } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

export const MailboxSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
	// What the caller may do in this mailbox.
	role: z.enum(["owner", "admin", "write", "read"]),
});

export const MailboxDetailsSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
	settings: z.record(z.any()),
});

// Strict: an unknown top-level key is a 400 instead of being silently dropped.
export const UpdateMailboxRequestSchema = z
	.object({
		name: z.string().min(1).optional(),
		settings: z.record(z.any()),
	})
	.strict();

export const CreateMailboxRequestSchema = z
	.object({
		email: z.string().email(),
		name: z.string().min(1),
		settings: z.record(z.any()).optional(),
	})
	.strict();

export const ForgotPasswordRequestSchema = z.object({
	email: z.string().email(),
});

export const ResetPasswordRequestSchema = z.object({
	token: z.string(),
	// Same bounds as every other password field. The upper one keeps an arbitrarily long string
	// away from the password hash.
	newPassword: z.string().min(8).max(256),
});

export const AppSettingsResponseSchema = z.object({
	auth: z.object({
		enabled: z.boolean(),
		registerEnabled: z.boolean(),
	}),
	accountRecovery: z.object({
		enabled: z.boolean(),
	}),
});

const ErrorResponseSchema = z.object({
	error: z.string(),
});

const SuccessResponseSchema = z.object({
	status: z.string(),
});

// Mailbox create/delete are admin-only: returns the 403 to send, or null when allowed.
// With auth disabled by configuration there are no sessions, so everyone is allowed (as in
// GetMailboxes). The config is checked, not "no session", so a missing session fails closed.
function requireAdmin(c: AppContext) {
	if (c.env.config?.auth?.enabled === false) {
		return null;
	}

	const session = c.get("session");
	if (!session?.isAdmin) {
		return c.json({ error: "Admin access required" }, 403);
	}

	return null;
}

export class GetMailboxes extends OpenAPIRoute {
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
		const allMailboxes = await Promise.all(
			list.objects.map(async (obj) => {
				const id = obj.key.replace("mailboxes/", "").replace(".json", "");
				try {
					const r2Obj = await c.env.BUCKET.get(obj.key);
					if (r2Obj) {
						const settings: any = await r2Obj.json();
						const name = settings?.fromName || settings?.name || id;
						return { id, name, email: id };
					}
				} catch {
					// Fall through to id
				}
				return { id, name: id, email: id };
			}),
		);

		// If no session (auth disabled) or user is admin, return all mailboxes. Nothing in a mailbox
		// is closed to them, which is what "owner" means.
		if (!session || session.isAdmin) {
			return c.json(allMailboxes.map((m) => ({ ...m, role: "owner" })));
		}

		// Non-admin users can only see mailboxes they have access to, each with the role the access
		// check will hold them to (roleForMailbox is what that check uses).
		const authId = c.env.MAILBOX.idFromName("AUTH");
		const authDO = c.env.MAILBOX.get(authId);
		const userMailboxes = await authDO.getUserMailboxes(session.userId);

		const visible: Array<{ id: string; name: string; email: string; role: MailboxRole }> = [];
		for (const mailbox of allMailboxes) {
			const role = roleForMailbox(userMailboxes, mailbox.id);
			if (role) visible.push({ ...mailbox, role });
		}
		return c.json(visible);
	}
}

export class GetMailbox extends OpenAPIRoute {
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
		const key = `mailboxes/${mailboxId.toLowerCase()}.json`;
		const obj = await c.env.BUCKET.get(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}
		const settings: any = await obj.json();
		const name = settings?.fromName || settings?.name || mailboxId;
		const response = {
			id: mailboxId,
			name,
			email: mailboxId,
			settings: settings,
		};
		return c.json(response);
	}
}

export class PutMailbox extends OpenAPIRoute {
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
		const { settings, name } = data.body;
		const key = `mailboxes/${mailboxId.toLowerCase()}.json`;

		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const finalSettings = { ...settings };
		if (name !== undefined) {
			finalSettings.fromName = name.trim();
		} else if (finalSettings.fromName !== undefined) {
			finalSettings.fromName = String(finalSettings.fromName).trim();
		}
		const finalName = finalSettings.fromName || name || mailboxId;

		await c.env.BUCKET.put(key, JSON.stringify(finalSettings));

		const response = {
			id: mailboxId,
			name: finalName,
			email: mailboxId,
			settings: finalSettings,
		};
		return c.json(response);
	}
}

export class DeleteMailbox extends OpenAPIRoute {
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
			"403": {
				description: "Forbidden - Admin privileges required",
				...contentJson(ErrorResponseSchema),
			},
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const denied = requireAdmin(c);
		if (denied) {
			return denied;
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const key = `mailboxes/${mailboxId}.json`;

		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		await c.env.BUCKET.delete(key);

		return c.body(null, 204);
	}
}

export class PostMailbox extends OpenAPIRoute {
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
			"403": {
				description: "Forbidden - Admin privileges required",
				...contentJson(ErrorResponseSchema),
			},
			"409": {
				description: "Mailbox already exists",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const denied = requireAdmin(c);
		if (denied) {
			return denied;
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { name, settings } = data.body;
		// Mailbox ids are always lower-case: inbound mail is filed under the lower-cased recipient.
		const email = data.body.email.trim().toLowerCase();

		const key = `mailboxes/${email}.json`;

		const existing = await c.env.BUCKET.head(key);
		if (existing) {
			return c.json({ error: "Mailbox already exists" }, 409);
		}

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

		await c.env.BUCKET.put(key, JSON.stringify(finalSettings));

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(email);
		const stub = ns.get(id);

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

export class PostForgotPassword extends OpenAPIRoute {
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

		const token = crypto.randomUUID();
		const expiresAt = Date.now() + 3600000; // 1 hour

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

export class PostResetPassword extends OpenAPIRoute {
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

		const ns = c.env.MAILBOX;
		const authId = ns.idFromName("AUTH");
		const authStub = ns.get(authId);

		try {
			await authStub.updateUserPassword(tokenData.userId, newPassword);
		} catch (e) {
			return c.json({ error: "Failed to update password" }, 500);
		}

		await c.env.BUCKET.delete(tokenKey);

		return c.json({ status: "Password reset successfully" });
	}
}

export class GetAppSettings extends OpenAPIRoute {
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

		let userCount = 0;
		if (authEnabled) {
			const ns = c.env.MAILBOX;
			const authId = ns.idFromName("AUTH");
			const authStub = ns.get(authId);
			try {
				const users = await authStub.getUsers();
				userCount = users.length;
			} catch (e) {
				userCount = 1;
			}
		}

		const registerEnabled =
			config.auth?.registerEnabled === true ||
			(config.auth?.registerEnabled !== false && userCount === 0);

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
