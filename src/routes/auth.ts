import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
// The ".ts" endings let the unit tests load this file straight from node.
import { tooManyAttempts } from "../login-backoff.ts";
import { hashPassword, verifyAndUpgrade, verifyPassword } from "../password.ts";
import {
	buildDeviceCookie,
	buildSessionCookie,
	clearSessionCookies,
	readDeviceToken,
	readSessionTokens,
} from "../session-cookie.ts";
import type { Env, Session } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

// Schemas

// The upper bound keeps one request from making the server hash megabytes of text.
const NewPasswordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters.")
	.max(256, "Password must be at most 256 characters.");

// A password being checked, not set. Accounts created before the 256 limit may hold a longer one,
// so the bound here is looser: it must never stop someone signing in.
const EnteredPasswordSchema = z.string().min(1).max(1024);

const EmailSchema = z.string().trim().email().max(254);

const RegisterRequestSchema = z.object({
	email: EmailSchema,
	password: NewPasswordSchema,
});

const LoginRequestSchema = z.object({
	email: EmailSchema,
	password: EnteredPasswordSchema,
});

const ChangePasswordRequestSchema = z.object({
	current_password: EnteredPasswordSchema,
	new_password: NewPasswordSchema,
});

// No `id`: the session token leaves the server only inside the HttpOnly cookie.
const SessionResponseSchema = z.object({
	userId: z.string(),
	email: z.string(),
	isAdmin: z.boolean(),
	expiresAt: z.number(),
});

const UserResponseSchema = z.object({
	id: z.string(),
	email: z.string(),
	isAdmin: z.boolean(),
	createdAt: z.number(),
	updatedAt: z.number(),
});

const AdminUserResponseSchema = UserResponseSchema.extend({
	disabled: z.boolean(),
	mailboxes: z.array(z.object({ mailboxId: z.string(), role: z.string() })),
});

const ErrorResponseSchema = z.object({
	error: z.string(),
});

const TooManyAttemptsResponseSchema = z.object({
	error: z.string(),
	retry_after_seconds: z.number(),
});

const SuccessResponseSchema = z.object({
	status: z.string(),
});

const GrantAccessRequestSchema = z.object({
	userId: z.string(),
	mailboxId: z.string().trim().min(1),
	role: z.enum(["owner", "admin", "write", "read"]),
});

const RevokeAccessRequestSchema = z.object({
	userId: z.string(),
	mailboxId: z.string(),
});

const UpdateUserRequestSchema = z.object({
	isAdmin: z.boolean().optional(),
	disabled: z.boolean().optional(),
	password: NewPasswordSchema.optional(),
});

const UserIdParamsSchema = z.object({
	userId: z.string(),
});

// Helper function to get auth DO
function getAuthDO(env: Env) {
	const authId = env.MAILBOX.idFromName("AUTH");
	return env.MAILBOX.get(authId);
}

// The network a sign-in attempt comes from, for the per-address backoff. Cloudflare sets the header;
// it is absent in local development.
function clientIp(c: AppContext): string {
	return c.req.header("CF-Connecting-IP")?.trim() || "unknown";
}

function publicSession(session: Session) {
	return {
		userId: session.userId,
		email: session.email,
		isAdmin: session.isAdmin,
		expiresAt: session.expiresAt,
	};
}

function tooManyAttemptsResponse(c: AppContext, lockedForMs: number) {
	const body = tooManyAttempts(lockedForMs);
	c.header("Retry-After", String(body.retry_after_seconds));
	return c.json(body, 429);
}

// chanfana answers a request that fails its schema with { errors: [...] }. These routes promise
// { error }, which is also the field the dashboard shows, so the first problem goes out as one line.
class AuthRoute extends OpenAPIRoute {
	handleValidationError(errors: z.ZodIssue[]): Response {
		const issue = errors[0];
		let error = "Invalid request";
		if (issue) {
			// The messages written in this file are whole sentences. zod's own ("Required",
			// "Invalid email") only make sense next to the field they are about.
			const field = issue.path.filter((part) => part !== "body" && part !== "params").join(".");
			error = issue.message.endsWith(".") || !field ? issue.message : `${field}: ${issue.message}`;
		}
		return Response.json({ error }, { status: 400 });
	}
}

// Public routes
export class PostRegister extends AuthRoute {
	schema = {
		summary: "Register a new user",
		operationId: "register",
		tags: ["Auth"],
		request: {
			body: contentJson(RegisterRequestSchema),
		},
		responses: {
			"201": {
				description: "User registered successfully",
				...contentJson(UserResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "Registration disabled",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { email, password } = data.body;

		const authDO = getAuthDO(c.env);
		const registerEnabled = c.env.config?.auth?.registerEnabled;

		// Check registration eligibility
		if (registerEnabled === false) {
			return c.json({ error: "Registration is disabled" }, 403);
		}

		// Smart mode: Allow first user only
		if (registerEnabled === undefined) {
			const hasUsers = await authDO.hasUsers();
			if (hasUsers) {
				return c.json(
					{
						error: "Registration is closed. Contact an administrator.",
					},
					403,
				);
			}
		}

		try {
			// Check if this is the first user
			const isFirstUser = !(await authDO.hasUsers());
			const user = await authDO.createUser(email, await hashPassword(password), isFirstUser);
			if (!user) {
				return c.json({ error: "Email already registered" }, 400);
			}
			return c.json(user, 201);
		} catch (error: any) {
			console.error("Registration failed:", error);
			return c.json({ error: "Registration failed" }, 400);
		}
	}
}

export class PostLogin extends AuthRoute {
	schema = {
		summary: "Login",
		operationId: "login",
		tags: ["Auth"],
		request: {
			body: contentJson(LoginRequestSchema),
		},
		responses: {
			"200": {
				description: "Login successful. The session token is in the Set-Cookie header only.",
				...contentJson(SessionResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "The account is disabled",
				...contentJson(ErrorResponseSchema),
			},
			"429": {
				description: "Too many failed attempts",
				...contentJson(TooManyAttemptsResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { email, password } = data.body;

		const authDO = getAuthDO(c.env);
		const ip = clientIp(c);
		const deviceToken = readDeviceToken(c.req.raw);

		// One round, normally. completeLogin answers "invalid" when the stored hash changed after it
		// was handed out: two sign-ins of an account still on the old format, both upgrading it, or a
		// reset in between. Then the password is checked once more, against what is stored now.
		for (let round = 0; round < 2; round++) {
			const attempt = await authDO.beginLogin(email, ip, deviceToken);
			if (attempt.lockedForMs > 0) {
				return tooManyAttemptsResponse(c, attempt.lockedForMs);
			}

			// The password is checked here, in the Worker, not in the AUTH object: the check is slow on
			// purpose, and that object handles one request at a time while every signed-in request
			// waits on it.
			const check = await verifyAndUpgrade(password, attempt.user ? attempt.user.passwordHash : null);
			if (!check.ok || !attempt.user) break;

			const result = await authDO.completeLogin({
				userId: attempt.user.id,
				verifiedHash: attempt.user.passwordHash,
				upgradedHash: check.upgradedHash,
				email,
				ip,
				deviceToken,
			});
			if (result.status === "disabled") {
				return c.json({ error: "This account is disabled. Contact an administrator." }, 403);
			}
			if (result.status === "ok") {
				const maxAge = Math.floor((result.session.expiresAt - Date.now()) / 1000);
				const cookie = buildSessionCookie(result.token, c.req.url, maxAge);
				// A browser may still hold a session cookie under the name used before this release. It
				// is dropped here so that it cannot outlive, or stand in for, the session that starts now.
				const cookieName = cookie.slice(0, cookie.indexOf("=") + 1);
				for (const cleared of clearSessionCookies(c.req.url)) {
					if (!cleared.startsWith(cookieName)) {
						c.header("Set-Cookie", cleared, { append: true });
					}
				}
				c.header("Set-Cookie", cookie, { append: true });
				if (result.deviceToken) {
					c.header("Set-Cookie", buildDeviceCookie(result.deviceToken, c.req.url), { append: true });
				}

				return c.json(publicSession(result.session));
			}
		}

		return c.json({ error: "Invalid credentials" }, 401);
	}
}

export class PostLogout extends AuthRoute {
	schema = {
		summary: "Logout",
		operationId: "logout",
		tags: ["Auth"],
		responses: {
			"200": {
				description: "Logout successful",
				...contentJson(SuccessResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		// Every session the request carries is ended, not only the one that authenticated it: a
		// browser can hold a cookie from before this release next to the current one.
		const authDO = getAuthDO(c.env);
		for (const presented of readSessionTokens(c.req.raw)) {
			await authDO.logout(presented.token);
		}

		for (const cleared of clearSessionCookies(c.req.url)) {
			c.header("Set-Cookie", cleared, { append: true });
		}

		return c.json({ status: "logged out" });
	}
}

export class GetMe extends AuthRoute {
	schema = {
		summary: "Get current user",
		operationId: "getCurrentUser",
		tags: ["Auth"],
		responses: {
			"200": {
				description: "Current user session",
				...contentJson(SessionResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		return c.json(publicSession(session));
	}
}

export class PostChangePassword extends AuthRoute {
	schema = {
		summary: "Change your own password",
		operationId: "changePassword",
		tags: ["Auth"],
		request: {
			body: contentJson(ChangePasswordRequestSchema),
		},
		responses: {
			"200": {
				description: "Password changed. Every other session of the user is ended.",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"429": {
				description: "Too many failed attempts",
				...contentJson(TooManyAttemptsResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { current_password, new_password } = data.body;

		const authDO = getAuthDO(c.env);
		const attempt = await authDO.beginPasswordChange(session.userId);
		if (attempt.lockedForMs > 0) {
			return tooManyAttemptsResponse(c, attempt.lockedForMs);
		}
		if (!attempt.passwordHash) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		// 400, not 401: the dashboard treats a 401 as "signed out" and would drop the session.
		const check = await verifyPassword(current_password, attempt.passwordHash);
		if (!check.ok) {
			return c.json({ error: "Current password is incorrect" }, 400);
		}

		const changed = await authDO.completePasswordChange(
			session.userId,
			attempt.passwordHash,
			await hashPassword(new_password),
			session.id,
		);
		if (!changed) {
			return c.json({ error: "Your password was changed somewhere else just now. Try again." }, 400);
		}

		return c.json({ status: "updated" });
	}
}

// Admin routes
export class PostAdminRegister extends AuthRoute {
	schema = {
		summary: "Register a new user (admin only)",
		operationId: "adminRegister",
		tags: ["Auth - Admin"],
		request: {
			body: contentJson(RegisterRequestSchema),
		},
		responses: {
			"201": {
				description: "User registered successfully",
				...contentJson(UserResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "Forbidden - Admin privileges required",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		if (!session.isAdmin) {
			return c.json({ error: "Admin privileges required" }, 403);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { email, password } = data.body;

		const authDO = getAuthDO(c.env);

		try {
			const user = await authDO.createUser(email, await hashPassword(password), false);
			if (!user) {
				return c.json({ error: "Email already registered" }, 400);
			}
			return c.json(user, 201);
		} catch (error: any) {
			console.error("Registration failed:", error);
			return c.json({ error: "Registration failed" }, 400);
		}
	}
}

export class GetUsers extends AuthRoute {
	schema = {
		summary: "Get all users (admin only)",
		operationId: "getUsers",
		tags: ["Auth - Admin"],
		responses: {
			"200": {
				description: "List of users, each with the mailboxes it has access to",
				...contentJson(z.array(AdminUserResponseSchema)),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "Forbidden - Admin privileges required",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		if (!session.isAdmin) {
			return c.json({ error: "Admin privileges required" }, 403);
		}

		const authDO = getAuthDO(c.env);
		const users = await authDO.getUsers();

		return c.json(users);
	}
}

export class PutUser extends AuthRoute {
	schema = {
		summary: "Update a user (admin only)",
		operationId: "updateUser",
		tags: ["Auth - Admin"],
		request: {
			params: UserIdParamsSchema,
			body: contentJson(UpdateUserRequestSchema),
		},
		responses: {
			"200": {
				description: "User updated successfully",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "Forbidden - Admin privileges required",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "User not found",
				...contentJson(ErrorResponseSchema),
			},
			"409": {
				description: "The change would leave no active administrator, or targets your own status",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		if (!session.isAdmin) {
			return c.json({ error: "Admin privileges required" }, 403);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { userId } = data.params;
		const { isAdmin, disabled, password } = data.body;

		if (isAdmin === undefined && disabled === undefined && password === undefined) {
			return c.json({ error: "Nothing to change" }, 400);
		}

		const change: { isAdmin?: boolean; disabled?: boolean; passwordHash?: string } = {};
		if (isAdmin !== undefined) change.isAdmin = isAdmin;
		if (disabled !== undefined) change.disabled = disabled;
		if (password !== undefined) change.passwordHash = await hashPassword(password);

		const authDO = getAuthDO(c.env);
		const result = await authDO.updateUser(
			{ userId: session.userId, sessionId: session.id },
			userId,
			change,
		);
		if (result.ok === false) {
			return c.json({ error: result.error }, result.status);
		}

		return c.json({ status: "updated" });
	}
}

export class DeleteUser extends AuthRoute {
	schema = {
		summary: "Delete a user (admin only)",
		operationId: "deleteUser",
		tags: ["Auth - Admin"],
		request: {
			params: UserIdParamsSchema,
		},
		responses: {
			"200": {
				description: "User deleted, with their mailbox access, sessions and push subscriptions",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "Forbidden - Admin privileges required",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "User not found",
				...contentJson(ErrorResponseSchema),
			},
			"409": {
				description: "Your own account, or the last active administrator",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		if (!session.isAdmin) {
			return c.json({ error: "Admin privileges required" }, 403);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { userId } = data.params;

		const authDO = getAuthDO(c.env);
		const result = await authDO.deleteUser(session.userId, userId);
		if (result.ok === false) {
			return c.json({ error: result.error }, result.status);
		}

		return c.json({ status: "deleted" });
	}
}

export class PostRevokeUserSessions extends AuthRoute {
	schema = {
		summary: "Sign a user out everywhere (admin only)",
		operationId: "revokeUserSessions",
		tags: ["Auth - Admin"],
		request: {
			params: UserIdParamsSchema,
		},
		responses: {
			"200": {
				description: "Every session of the user is ended",
				...contentJson(
					z.object({
						status: z.string(),
						revoked: z.number(),
					}),
				),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "Forbidden - Admin privileges required",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "User not found",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		if (!session.isAdmin) {
			return c.json({ error: "Admin privileges required" }, 403);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { userId } = data.params;

		const authDO = getAuthDO(c.env);
		const revoked = await authDO.revokeUserSessions(userId);
		if (revoked === null) {
			return c.json({ error: "User not found" }, 404);
		}

		return c.json({ status: "revoked", revoked });
	}
}

export class PostGrantAccess extends AuthRoute {
	schema = {
		summary: "Grant mailbox access to a user, or change the role of an existing grant (admin only)",
		operationId: "grantMailboxAccess",
		tags: ["Auth - Admin"],
		request: {
			body: contentJson(GrantAccessRequestSchema),
		},
		responses: {
			"200": {
				description: "Access granted successfully",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "Forbidden - Admin privileges required",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		if (!session.isAdmin) {
			return c.json({ error: "Admin privileges required" }, 403);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { userId, mailboxId, role } = data.body;

		const authDO = getAuthDO(c.env);
		await authDO.grantMailboxAccess(userId, mailboxId, role);

		return c.json({ status: "access granted" });
	}
}

export class PostRevokeAccess extends AuthRoute {
	schema = {
		summary: "Revoke mailbox access from a user (admin only)",
		operationId: "revokeMailboxAccess",
		tags: ["Auth - Admin"],
		request: {
			body: contentJson(RevokeAccessRequestSchema),
		},
		responses: {
			"200": {
				description: "Access revoked successfully",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "Forbidden - Admin privileges required",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const session = c.get("session");
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		if (!session.isAdmin) {
			return c.json({ error: "Admin privileges required" }, 403);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { userId, mailboxId } = data.body;

		const authDO = getAuthDO(c.env);
		await authDO.revokeMailboxAccess(userId, mailboxId);

		return c.json({ status: "access revoked" });
	}
}
