import type { DOQB } from "workers-qb";
import type { Session, User } from "../types";

export class AuthHandler {
	#qb: DOQB;
	#isAuthDO: boolean;

	constructor(qb: DOQB, isAuthDO: boolean) {
		this.#qb = qb;
		this.#isAuthDO = isAuthDO;
	}

	async #hashPassword(password: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(password);
		const hash = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hash));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	async #verifyPassword(password: string, hash: string): Promise<boolean> {
		const passwordHash = await this.#hashPassword(password);
		return passwordHash === hash;
	}

	#generateToken(): string {
		return crypto.randomUUID();
	}

	async hasUsers(): Promise<boolean> {
		if (!this.#isAuthDO) return false;
		const result = this.#qb.select("users").fields(["COUNT(*) as count"]).one();
		return (result.results?.count as number) > 0;
	}

	async isAdmin(userId: string): Promise<boolean> {
		if (!this.#isAuthDO) return false;
		const result = this.#qb
			.select("users")
			.fields(["is_admin"])
			.where("id = ?", userId)
			.one();
		return result.results?.is_admin === 1;
	}

	async register(
		email: string,
		password: string,
		isFirstUser = false,
	): Promise<User> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const userId = crypto.randomUUID();
		const passwordHash = await this.#hashPassword(password);
		const now = Date.now();

		this.#qb
			.insert({
				tableName: "users",
				data: {
					id: userId,
					email,
					password_hash: passwordHash,
					is_admin: isFirstUser ? 1 : 0,
					created_at: now,
					updated_at: now,
				},
			})
			.execute();

		return {
			id: userId,
			email,
			isAdmin: isFirstUser,
			createdAt: now,
			updatedAt: now,
		};
	}

	async login(email: string, password: string): Promise<Session | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("users")
			.fields(["id", "email", "password_hash", "is_admin"])
			.where("email = ?", email)
			.one();

		if (!result.results) return null;

		const user = result.results;
		const isValid = await this.#verifyPassword(
			password,
			String(user.password_hash),
		);

		if (!isValid) return null;

		const sessionId = this.#generateToken();
		const now = Date.now();
		const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

		this.#qb
			.insert({
				tableName: "sessions",
				data: {
					id: sessionId,
					user_id: String(user.id),
					expires_at: expiresAt,
					created_at: now,
				},
			})
			.execute();

		return {
			id: sessionId,
			userId: String(user.id),
			email: String(user.email),
			isAdmin: user.is_admin === 1,
			expiresAt,
		};
	}

	async validateSession(sessionId: string): Promise<Session | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("sessions")
			.fields(["id", "user_id", "expires_at"])
			.where("id = ?", sessionId)
			.one();

		if (!result.results) return null;

		const session = result.results;
		const expiresAt = Number(session.expires_at);

		if (expiresAt < Date.now()) {
			this.#qb
				.delete({
					tableName: "sessions",
					where: {
						conditions: "id = ?",
						params: [sessionId],
					},
				})
				.execute();
			return null;
		}

		const userResult = this.#qb
			.select("users")
			.fields(["email", "is_admin"])
			.where("id = ?", String(session.user_id))
			.one();

		if (!userResult.results) return null;

		return {
			id: String(session.id),
			userId: String(session.user_id),
			email: String(userResult.results.email),
			isAdmin: userResult.results.is_admin === 1,
			expiresAt,
		};
	}

	async logout(sessionId: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		this.#qb
			.delete({
				tableName: "sessions",
				where: {
					conditions: "id = ?",
					params: [sessionId],
				},
			})
			.execute();

		return true;
	}

	async getUsers(): Promise<User[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("users")
			.fields(["id", "email", "is_admin", "created_at", "updated_at"])
			.execute();

		return (
			result.results?.map((user) => ({
				id: String(user.id),
				email: String(user.email),
				isAdmin: user.is_admin === 1,
				createdAt: Number(user.created_at),
				updatedAt: Number(user.updated_at),
			})) ?? []
		);
	}

	async getUserByEmail(email: string): Promise<User | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("users")
			.fields(["id", "email", "is_admin", "created_at", "updated_at"])
			.where("email = ?", email)
			.execute();

		if (!result.results || result.results.length === 0) {
			return null;
		}

		const user = result.results[0];
		return {
			id: String(user.id),
			email: String(user.email),
			isAdmin: user.is_admin === 1,
			createdAt: Number(user.created_at),
			updatedAt: Number(user.updated_at),
		};
	}

	async updateUserPassword(userId: string, newPassword: string): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const hashedPassword = await this.#hashPassword(newPassword);

		this.#qb
			.update({
				tableName: "users",
				data: {
					password_hash: hashedPassword,
					updated_at: Date.now(),
				},
				where: {
					conditions: "id = ?",
					params: [userId],
				},
			})
			.execute();
	}

	async grantMailboxAccess(
		userId: string,
		mailboxId: string,
		role: string,
	): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		this.#qb
			.insert({
				tableName: "user_mailboxes",
				data: {
					user_id: userId,
					mailbox_id: mailboxId,
					role,
				},
			})
			.execute();
	}

	async revokeMailboxAccess(userId: string, mailboxId: string): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		// Access is checked without regard to letter case, so revoking must remove every spelling of
		// the id: an exact match would leave "Support@x.io" in place when "support@x.io" is revoked.
		this.#qb
			.delete({
				tableName: "user_mailboxes",
				where: {
					conditions: "user_id = ? AND LOWER(mailbox_id) = LOWER(?)",
					params: [userId, mailboxId],
				},
			})
			.execute();
	}

	async getUserMailboxes(
		userId: string,
	): Promise<Array<{ mailboxId: string; role: string }>> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const result = this.#qb
			.select("user_mailboxes")
			.fields(["mailbox_id", "role"])
			.where("user_id = ?", userId)
			.execute();

		return (
			result.results?.map((row) => ({
				mailboxId: String(row.mailbox_id),
				role: String(row.role),
			})) ?? []
		);
	}
}
