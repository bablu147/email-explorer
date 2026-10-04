import type { DOQB } from "workers-qb";
// The ".ts" endings let the unit tests load this file straight from node.
import {
	type AttemptCounter,
	lockedForMs,
	networkOf,
	QUIET_RESET_MS,
	recordAccountFailure,
	recordAddressFailure,
} from "../login-backoff.ts";
import { hashPassword, isPasswordHash } from "../password.ts";
import type { Session, User } from "../types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A session ends this long after sign-in, however much it is used. */
const SESSION_LIFETIME_MS = 30 * DAY_MS;
/** A session not used for this long ends. */
const SESSION_IDLE_MS = 14 * DAY_MS;
/** "Last used" is written at most this often per session, not on every request. */
const LAST_USED_WRITE_INTERVAL_MS = HOUR_MS;

const MAILBOX_ROLES = ["owner", "admin", "write", "read"];
/** Known browsers kept per account; the least recently used go first. */
const MAX_KNOWN_DEVICES = 20;

// A token from before sessions were stored hashed: crypto.randomUUID(). Those rows have the token
// itself as their id. A hashed id is 64 hex characters and never has this shape, so looking a row
// up by a token of this shape can only ever find one of those old rows. Without the shape test,
// someone who read the table could present a stored hash as if it were a token.
const LEGACY_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOKEN_LENGTH = 512;

export interface UserWithAccess extends User {
	disabled: boolean;
	mailboxes: Array<{ mailboxId: string; role: string }>;
}

/** What an administrator may change on an account. */
export interface UserChange {
	isAdmin?: boolean;
	disabled?: boolean;
	/** Already hashed: see createUser. */
	passwordHash?: string;
}

/** `status` is the HTTP status the route answers with. */
export type AccountResult = { ok: true } | { ok: false; status: 404 | 409; error: string };

export type LoginResult =
	// `deviceToken` is set when this browser was not known for the account yet: the route hands it
	// back in the device cookie.
	| { status: "ok"; token: string; session: Session; deviceToken: string | null }
	| { status: "disabled" }
	// The account or its password changed between the check and now.
	| { status: "invalid" };

const USER_NOT_FOUND: AccountResult = { ok: false, status: 404, error: "User not found" };
const LAST_ADMIN: AccountResult = {
	ok: false,
	status: 409,
	error: "This is the last active administrator. Make another user an administrator first.",
};

function loginKeys(email: string, ip: string): { address: string; account: string } {
	const who = email.trim().toLowerCase();
	return {
		// By address and network: locking by address alone would let anyone lock a user out.
		address: `login-from ${who} ${networkOf(ip).slice(0, 64)}`,
		account: `login-all ${who}`,
	};
}

function passwordChangeKey(userId: string): string {
	return `password ${userId}`;
}

export class AuthHandler {
	#sql: SqlStorage;
	#qb: DOQB;
	#isAuthDO: boolean;

	constructor(sql: SqlStorage, qb: DOQB, isAuthDO: boolean) {
		this.#sql = sql;
		this.#qb = qb;
		this.#isAuthDO = isAuthDO;
	}

	// Sessions are stored under this, not under the token: whoever reads the table must not be able
	// to sign in with what they find there.
	async #hashToken(token: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(token);
		const hash = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hash));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	#generateToken(): string {
		return crypto.randomUUID();
	}

	// Addresses were stored as typed until now, so "Ana@x.io" and "ana@x.io" are one account here.
	// Should both spellings exist from before, the one typed exactly wins, then the older.
	#findUserByEmail(email: string) {
		const address = email.trim();
		return this.#sql
			.exec(
				`SELECT id, email, password_hash, is_admin, disabled, created_at, updated_at
				 FROM users
				 WHERE LOWER(email) = LOWER(?)
				 ORDER BY (email = ?) DESC, created_at ASC
				 LIMIT 1`,
				address,
				address,
			)
			.toArray()[0];
	}

	#findUserById(userId: string) {
		return this.#sql
			.exec(
				"SELECT id, email, password_hash, is_admin, disabled FROM users WHERE id = ?",
				userId,
			)
			.toArray()[0];
	}

	#activeAdminCount(): number {
		const row = this.#sql
			.exec("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1 AND disabled = 0")
			.toArray()[0];
		return Number(row.count);
	}

	#readAttempts(key: string): AttemptCounter | null {
		const row = this.#sql
			.exec(
				"SELECT failures, first_failure_at, last_failure_at, locked_until FROM login_attempts WHERE attempt_key = ?",
				key,
			)
			.toArray()[0];
		if (!row) return null;
		return {
			failures: Number(row.failures),
			firstFailureAt: Number(row.first_failure_at),
			lastFailureAt: Number(row.last_failure_at),
			lockedUntil: Number(row.locked_until),
		};
	}

	#countAttempt(
		key: string,
		record: (prev: AttemptCounter | null, now: number) => AttemptCounter,
		now: number,
	): void {
		const next = record(this.#readAttempts(key), now);
		this.#sql.exec(
			`INSERT OR REPLACE INTO login_attempts
			   (attempt_key, failures, first_failure_at, last_failure_at, locked_until)
			 VALUES (?, ?, ?, ?, ?)`,
			key,
			next.failures,
			next.firstFailureAt,
			next.lastFailureAt,
			next.lockedUntil,
		);
	}

	#clearAttempts(...keys: string[]): void {
		for (const key of keys) {
			this.#sql.exec("DELETE FROM login_attempts WHERE attempt_key = ?", key);
		}
	}

	// Every sign-in lock for an address, from every network. Compared by prefix with substr, not
	// LIKE: an address may contain "_" or "%".
	#clearLoginLocks(email: string): void {
		const keys = loginKeys(email, "");
		const prefix = keys.address;
		this.#sql.exec(
			"DELETE FROM login_attempts WHERE attempt_key = ? OR substr(attempt_key, 1, ?) = ?",
			keys.account,
			prefix.length,
			prefix,
		);
	}

	#isKnownDevice(userId: string, deviceHash: string | null): boolean {
		if (!deviceHash) return false;
		return (
			this.#sql
				.exec("SELECT 1 FROM known_devices WHERE device_hash = ? AND user_id = ?", deviceHash, userId)
				.toArray().length > 0
		);
	}

	// Everything that lets a user's devices act for them without the password: sessions, mail
	// previews pushed to their devices, and the mark that lets a browser past the account-wide lock.
	#signOutEverywhere(userId: string, exceptSessionId?: string): void {
		this.#deleteSessions(userId, exceptSessionId);
		this.#sql.exec("DELETE FROM push_subscriptions WHERE user_id = ?", userId);
		this.#sql.exec("DELETE FROM known_devices WHERE user_id = ?", userId);
	}

	#deleteSessions(userId: string, exceptSessionId?: string): void {
		if (exceptSessionId) {
			this.#sql.exec(
				"DELETE FROM sessions WHERE user_id = ? AND id <> ?",
				userId,
				exceptSessionId,
			);
		} else {
			this.#sql.exec("DELETE FROM sessions WHERE user_id = ?", userId);
		}
	}

	#setPasswordHash(userId: string, passwordHash: string): void {
		if (!isPasswordHash(passwordHash)) {
			throw new Error("Refusing to store a password that is not hashed");
		}
		this.#sql.exec(
			"UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
			passwordHash,
			Date.now(),
			userId,
		);
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

	/**
	 * Creates an account, or returns null when the address is taken in any letter case. The
	 * password arrives already hashed: the key derivation is slow on purpose, and this object
	 * handles one request at a time while every signed-in request waits on it.
	 */
	async createUser(
		email: string,
		passwordHash: string,
		isFirstUser = false,
	): Promise<User | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		if (!isPasswordHash(passwordHash)) {
			throw new Error("Refusing to store a password that is not hashed");
		}

		const address = email.trim().toLowerCase();
		if (this.#findUserByEmail(address)) return null;

		// Checked here as well as by the caller: two registrations racing on an empty system must
		// not both become administrators.
		const existing = this.#sql.exec("SELECT COUNT(*) AS count FROM users").toArray()[0];
		const isAdmin = isFirstUser && Number(existing.count) === 0;

		const userId = crypto.randomUUID();
		const now = Date.now();

		this.#sql.exec(
			`INSERT INTO users (id, email, password_hash, is_admin, disabled, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 0, ?, ?)`,
			userId,
			address,
			passwordHash,
			isAdmin ? 1 : 0,
			now,
			now,
		);

		return {
			id: userId,
			email: address,
			isAdmin,
			createdAt: now,
			updatedAt: now,
		};
	}

	/**
	 * First half of a sign-in: says whether attempts are being refused, and if not hands back the
	 * stored hash so the Worker can check the password. `user` is null for an unknown address.
	 */
	async beginLogin(
		email: string,
		ip: string,
		deviceToken: string | null = null,
	): Promise<{ lockedForMs: number; user: { id: string; passwordHash: string } | null }> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		// The only wait in this method, and before anything is read: from here to the return no
		// other request can run in between.
		const deviceHash = deviceToken ? await this.#hashToken(deviceToken) : null;

		const now = Date.now();
		const keys = loginKeys(email, ip);
		const account = this.#findUserByEmail(email);
		// The account-wide lock is there to stop many machines guessing one account. Applied to
		// everyone, it would also let any outsider keep the real user (the only administrator, say)
		// from signing in, just by guessing wrong often enough. So a browser that has signed in to
		// this account before is not held by it; its own per-network count still applies.
		const known = account ? this.#isKnownDevice(String(account.id), deviceHash) : false;
		const wait = Math.max(
			lockedForMs(this.#readAttempts(keys.address), now),
			known ? 0 : lockedForMs(this.#readAttempts(keys.account), now),
		);
		if (wait > 0) return { lockedForMs: wait, user: null };

		// Counted as a failure now, before the password is checked, and deleted again by
		// completeLogin when it turns out right. Counting only after a failed check would let any
		// number of requests sent at the same instant all get their guess in first.
		this.#countAttempt(keys.address, recordAddressFailure, now);
		this.#countAttempt(keys.account, recordAccountFailure, now);
		this.#sql.exec(
			"DELETE FROM login_attempts WHERE last_failure_at < ? AND locked_until <= ?",
			now - QUIET_RESET_MS,
			now,
		);

		return {
			lockedForMs: 0,
			user: account ? { id: String(account.id), passwordHash: String(account.password_hash) } : null,
		};
	}

	/**
	 * Second half of a sign-in, called only once the Worker has found the password right.
	 * `verifiedHash` is the stored hash it was checked against; `upgradedHash` replaces it when it
	 * was in the old format.
	 */
	async completeLogin(login: {
		userId: string;
		verifiedHash: string;
		upgradedHash: string | null;
		email: string;
		ip: string;
		deviceToken?: string | null;
	}): Promise<LoginResult> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const { userId, verifiedHash, upgradedHash, email, ip } = login;

		const token = this.#generateToken();
		const sessionId = await this.#hashToken(token);
		const presentedDeviceHash = login.deviceToken ? await this.#hashToken(login.deviceToken) : null;
		const newDeviceToken = this.#generateToken();
		const newDeviceHash = await this.#hashToken(newDeviceToken);
		// Nothing below waits on anything, so no other request can run in between.
		const now = Date.now();

		const user = this.#findUserById(userId);
		// The password was reset, or the account deleted, while the Worker was checking the old one.
		if (!user || String(user.password_hash) !== verifiedHash) return { status: "invalid" };

		const keys = loginKeys(email, ip);
		this.#clearAttempts(keys.address, keys.account);

		if (upgradedHash) {
			if (!isPasswordHash(upgradedHash)) {
				throw new Error("Refusing to store a password that is not hashed");
			}
			// Not a change the user made, so updated_at stays.
			this.#sql.exec("UPDATE users SET password_hash = ? WHERE id = ?", upgradedHash, userId);
		}

		if (Number(user.disabled) === 1) return { status: "disabled" };

		this.#sql.exec(
			"DELETE FROM sessions WHERE expires_at < ? OR (last_used_at IS NOT NULL AND last_used_at < ?)",
			now,
			now - SESSION_IDLE_MS,
		);

		const expiresAt = now + SESSION_LIFETIME_MS;
		this.#sql.exec(
			"INSERT INTO sessions (id, user_id, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)",
			sessionId,
			userId,
			expiresAt,
			now,
			now,
		);

		// This browser has now signed in to the account: remember it (see beginLogin).
		let deviceToken: string | null = null;
		if (this.#isKnownDevice(userId, presentedDeviceHash)) {
			this.#sql.exec("UPDATE known_devices SET last_used_at = ? WHERE device_hash = ?", now, presentedDeviceHash);
		} else {
			this.#sql.exec(
				"INSERT INTO known_devices (device_hash, user_id, created_at, last_used_at) VALUES (?, ?, ?, ?)",
				newDeviceHash,
				userId,
				now,
				now,
			);
			this.#sql.exec(
				`DELETE FROM known_devices WHERE user_id = ? AND device_hash NOT IN (
				   SELECT device_hash FROM known_devices WHERE user_id = ? ORDER BY last_used_at DESC LIMIT ?
				 )`,
				userId,
				userId,
				MAX_KNOWN_DEVICES,
			);
			deviceToken = newDeviceToken;
		}

		return {
			status: "ok",
			token,
			session: {
				id: sessionId,
				userId,
				email: String(user.email),
				isAdmin: Number(user.is_admin) === 1,
				expiresAt,
			},
			deviceToken,
		};
	}

	/**
	 * Takes the token as the browser sent it. Null when it is unknown, expired, unused for too long,
	 * or the account is disabled or gone. The returned `id` is the storage key, never the token.
	 */
	async validateSession(token: string): Promise<Session | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) return null;

		const sessionId = await this.#hashToken(token);
		// Nothing below waits on anything, so no other request can run in between.
		const now = Date.now();

		const select = "SELECT user_id, expires_at, last_used_at FROM sessions WHERE id = ?";
		let session = this.#sql.exec(select, sessionId).toArray()[0];
		if (!session && LEGACY_TOKEN.test(token)) {
			// A session from before this release, stored under the token itself. It moves under its
			// hash the first time it is seen, so nobody is signed out by the release. After 30 days no
			// such row can be left and this branch can go.
			session = this.#sql.exec(select, token).toArray()[0];
			if (session) {
				this.#sql.exec("UPDATE sessions SET id = ? WHERE id = ?", sessionId, token);
			}
		}
		if (!session) return null;

		const expiresAt = Number(session.expires_at);
		// NULL on a session from before the column existed: it counts as used now.
		const lastUsedAt = session.last_used_at == null ? null : Number(session.last_used_at);

		if (expiresAt < now || (lastUsedAt !== null && now - lastUsedAt > SESSION_IDLE_MS)) {
			this.#sql.exec("DELETE FROM sessions WHERE id = ?", sessionId);
			return null;
		}

		const userId = String(session.user_id);
		const user = this.#findUserById(userId);
		if (!user || Number(user.disabled) === 1) return null;

		if (lastUsedAt === null || now - lastUsedAt >= LAST_USED_WRITE_INTERVAL_MS) {
			this.#sql.exec("UPDATE sessions SET last_used_at = ? WHERE id = ?", now, sessionId);
		}

		return {
			id: sessionId,
			userId,
			email: String(user.email),
			isAdmin: Number(user.is_admin) === 1,
			expiresAt,
		};
	}

	/** Ends the session this token belongs to. Takes the token as the browser sent it. */
	async logout(token: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) return true;

		const sessionId = await this.#hashToken(token);
		this.#sql.exec("DELETE FROM sessions WHERE id = ?", sessionId);
		if (LEGACY_TOKEN.test(token)) {
			this.#sql.exec("DELETE FROM sessions WHERE id = ?", token);
		}

		return true;
	}

	async getUsers(): Promise<UserWithAccess[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const grants = new Map<string, Array<{ mailboxId: string; role: string }>>();
		const grantRows = this.#sql
			.exec("SELECT user_id, mailbox_id, role FROM user_mailboxes ORDER BY mailbox_id")
			.toArray();
		for (const row of grantRows) {
			const userId = String(row.user_id);
			const list = grants.get(userId) ?? [];
			list.push({ mailboxId: String(row.mailbox_id), role: String(row.role) });
			grants.set(userId, list);
		}

		return this.#sql
			.exec(
				"SELECT id, email, is_admin, disabled, created_at, updated_at FROM users ORDER BY created_at, email",
			)
			.toArray()
			.map((user) => ({
				id: String(user.id),
				email: String(user.email),
				isAdmin: Number(user.is_admin) === 1,
				disabled: Number(user.disabled) === 1,
				createdAt: Number(user.created_at),
				updatedAt: Number(user.updated_at),
				mailboxes: grants.get(String(user.id)) ?? [],
			}));
	}

	async getUserByEmail(email: string): Promise<User | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const user = this.#findUserByEmail(email);
		if (!user) return null;

		return {
			id: String(user.id),
			email: String(user.email),
			isAdmin: Number(user.is_admin) === 1,
			createdAt: Number(user.created_at),
			updatedAt: Number(user.updated_at),
		};
	}

	// The reset-password route calls this with the plain password, so this is the one place where
	// the key is derived inside the object. That route answers 503 unless account recovery is
	// configured, which it is not.
	async updateUserPassword(userId: string, newPassword: string): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const passwordHash = await hashPassword(newPassword);

		this.#setPasswordHash(userId, passwordHash);
		// Whoever knew the old password is signed out everywhere.
		this.#signOutEverywhere(userId);
		this.#clearAttempts(passwordChangeKey(userId));
		const user = this.#findUserById(userId);
		if (user) this.#clearLoginLocks(String(user.email));
	}

	/**
	 * First half of a user changing their own password, built like beginLogin: wrong guesses at the
	 * current password are counted per user. `passwordHash` is null when attempts are being refused
	 * or the account is gone.
	 */
	async beginPasswordChange(
		userId: string,
	): Promise<{ lockedForMs: number; passwordHash: string | null }> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const now = Date.now();
		const key = passwordChangeKey(userId);
		const wait = lockedForMs(this.#readAttempts(key), now);
		if (wait > 0) return { lockedForMs: wait, passwordHash: null };

		const user = this.#findUserById(userId);
		if (!user) return { lockedForMs: 0, passwordHash: null };

		this.#countAttempt(key, recordAddressFailure, now);
		return { lockedForMs: 0, passwordHash: String(user.password_hash) };
	}

	/**
	 * Second half, called once the Worker has found the current password right. Stores the new hash
	 * and ends every session of the user except `keepSessionId`. False when the password was
	 * changed by someone else in the meantime.
	 */
	async completePasswordChange(
		userId: string,
		verifiedHash: string,
		newPasswordHash: string,
		keepSessionId: string,
	): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const user = this.#findUserById(userId);
		if (!user || String(user.password_hash) !== verifiedHash) return false;

		this.#setPasswordHash(userId, newPasswordHash);
		// Other devices are signed out and stop receiving mail previews. Subscriptions are not tied
		// to a session, so this device's goes too and is switched on again in Settings.
		this.#signOutEverywhere(userId, keepSessionId);
		this.#clearAttempts(passwordChangeKey(userId));
		return true;
	}

	/** An administrator changes an account. `actor` is the administrator and the session they are using. */
	async updateUser(
		actor: { userId: string; sessionId: string },
		userId: string,
		change: UserChange,
	): Promise<AccountResult> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const user = this.#findUserById(userId);
		if (!user) return USER_NOT_FOUND;

		const wasAdmin = Number(user.is_admin) === 1;
		const wasDisabled = Number(user.disabled) === 1;
		const isAdmin = change.isAdmin ?? wasAdmin;
		const disabled = change.disabled ?? wasDisabled;
		const isSelf = userId === actor.userId;

		if (isSelf && (isAdmin !== wasAdmin || disabled !== wasDisabled)) {
			return {
				ok: false,
				status: 409,
				error: "You cannot change your own administrator or disabled status. Ask another administrator.",
			};
		}
		if (wasAdmin && !wasDisabled && (!isAdmin || disabled) && this.#activeAdminCount() <= 1) {
			return LAST_ADMIN;
		}

		// Checked before the first write, so a refused password leaves the account untouched.
		if (change.passwordHash !== undefined && !isPasswordHash(change.passwordHash)) {
			throw new Error("Refusing to store a password that is not hashed");
		}

		this.#sql.exec(
			"UPDATE users SET is_admin = ?, disabled = ?, updated_at = ? WHERE id = ?",
			isAdmin ? 1 : 0,
			disabled ? 1 : 0,
			Date.now(),
			userId,
		);

		if (change.passwordHash !== undefined) {
			this.#setPasswordHash(userId, change.passwordHash);
			// An administrator resetting their own password stays signed in where they did it.
			this.#signOutEverywhere(userId, isSelf ? actor.sessionId : undefined);
			this.#clearAttempts(passwordChangeKey(userId));
			// A reset is usually for someone who is locked out after too many wrong guesses: without
			// this they would still have to wait before the new password is accepted.
			this.#clearLoginLocks(String(user.email));
		}

		if (disabled && !wasDisabled) {
			// A disabled account must stop receiving mail previews on its devices too.
			this.#signOutEverywhere(userId);
		}

		return { ok: true };
	}

	async deleteUser(actorUserId: string, userId: string): Promise<AccountResult> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		const user = this.#findUserById(userId);
		if (!user) return USER_NOT_FOUND;

		if (userId === actorUserId) {
			return {
				ok: false,
				status: 409,
				error: "You cannot delete your own account. Ask another administrator.",
			};
		}
		if (
			Number(user.is_admin) === 1 &&
			Number(user.disabled) !== 1 &&
			this.#activeAdminCount() <= 1
		) {
			return LAST_ADMIN;
		}

		this.#sql.exec("DELETE FROM user_mailboxes WHERE user_id = ?", userId);
		this.#signOutEverywhere(userId);
		this.#clearAttempts(passwordChangeKey(userId));
		this.#sql.exec("DELETE FROM users WHERE id = ?", userId);

		return { ok: true };
	}

	/** Signs a user out everywhere. Returns how many sessions ended, or null for an unknown user. */
	async revokeUserSessions(userId: string): Promise<number | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");

		if (!this.#findUserById(userId)) return null;

		// Counted first: rowsWritten on the DELETE would include index rows.
		const row = this.#sql
			.exec("SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?", userId)
			.toArray()[0];
		// A lost phone must also stop showing each new message's sender, subject and preview.
		this.#signOutEverywhere(userId);

		return Number(row.count);
	}

	/** Grants access, or changes the role when the user already has access to the mailbox. */
	async grantMailboxAccess(
		userId: string,
		mailboxId: string,
		role: string,
	): Promise<void> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		if (!MAILBOX_ROLES.includes(role)) throw new Error("Unknown mailbox role");

		// Mailbox ids are lower-case. A grant used to be stored as the admin typed it, so any other
		// spelling of the same mailbox is replaced along with the role.
		const id = mailboxId.trim().toLowerCase();
		this.#sql.exec(
			"DELETE FROM user_mailboxes WHERE user_id = ? AND LOWER(mailbox_id) = ?",
			userId,
			id,
		);
		this.#sql.exec(
			"INSERT INTO user_mailboxes (user_id, mailbox_id, role) VALUES (?, ?, ?)",
			userId,
			id,
			role,
		);
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
					params: [userId, mailboxId.trim()],
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
