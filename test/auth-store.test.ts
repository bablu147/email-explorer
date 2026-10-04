// The AUTH object's account, session and grant logic, run against a database that starts as
// production is today (see auth-harness.ts). The release must not sign anyone out or lock anyone out.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DOQB } from "workers-qb";
import { AuthHandler } from "../src/durableObject/auth.ts";
import { authMigrations } from "../src/durableObject/migrations.ts";
import { hashPassword, isPasswordHash, verifyAndUpgrade, verifyPassword } from "../src/password.ts";
import {
	at,
	DAY,
	HOUR,
	insertLegacyUser,
	LEGACY_TOKEN,
	MINUTE,
	PASSWORD,
	SECOND,
	type Store,
	sha256,
	sqlStorage,
	store,
	T0,
	unmigratedStore,
} from "./auth-harness.ts";

// One real hash, made once: each derivation costs tens of milliseconds.
const CURRENT_HASH = await hashPassword(PASSWORD);

/** Signs in the way the route does: begin, check the password in the "Worker", complete. */
async function signIn(s: Store, email: string, password = PASSWORD, ip = "203.0.113.7", deviceToken: string | null = null) {
	const attempt = await s.auth.beginLogin(email, ip, deviceToken);
	if (attempt.lockedForMs > 0) return { status: "locked" as const, lockedForMs: attempt.lockedForMs };
	const check = await verifyAndUpgrade(password, attempt.user ? attempt.user.passwordHash : null);
	if (!check.ok || !attempt.user) return { status: "wrong" as const };
	return s.auth.completeLogin({
		userId: attempt.user.id,
		verifiedHash: attempt.user.passwordHash,
		upgradedHash: check.upgradedHash,
		email,
		ip,
		deviceToken,
	});
}

async function tokenFor(s: Store, email: string): Promise<string> {
	const result = await signIn(s, email);
	assert.equal(result.status, "ok");
	return (result as { token: string }).token;
}

// ---------------------------------------------------------------- migrations

test("migrations: existing 'read' grants become 'write', other roles stay", () => {
	const s = store();
	assert.deepEqual(
		s.rows("SELECT mailbox_id, role FROM user_mailboxes ORDER BY mailbox_id").map((r) => ({ ...r })),
		[
			{ mailbox_id: "Support@Reflect.cloud", role: "write" },
			{ mailbox_id: "sales@reflect.cloud", role: "owner" },
		],
	);
});

test("migrations: existing users are enabled and existing sessions are kept", () => {
	const s = store();
	assert.deepEqual(
		s.rows("SELECT disabled FROM users").map((r) => r.disabled),
		[0, 0],
	);
	assert.deepEqual(
		s.rows("SELECT id, last_used_at FROM sessions").map((r) => ({ ...r })),
		[{ id: LEGACY_TOKEN, last_used_at: null }],
	);
});

test("migrations: applying twice changes nothing, and a later 'read' grant is left alone", async () => {
	const s = store();
	await s.auth.grantMailboxAccess("member-id", "billing@reflect.cloud", "read");
	s.migrate();
	assert.deepEqual(
		s.rows("SELECT role FROM user_mailboxes WHERE mailbox_id = 'billing@reflect.cloud'").map((r) => r.role),
		["read"],
	);
	assert.deepEqual(
		s.rows("SELECT name FROM migrations ORDER BY id").map((r) => r.name),
		authMigrations.map((m) => m.name),
	);
});

test("migrations: one that stopped before its last statement can run again", () => {
	const s = unmigratedStore();
	s.rows("INSERT INTO user_mailboxes (user_id, mailbox_id, role) VALUES ('u', 'a@x.io', 'read')");
	// Everything in migration 8 except its final ALTER has run, and it was not recorded.
	const partial = authMigrations.find((m) => m.name === "8_accounts_and_access");
	const statements = (partial?.sql ?? "")
		.split(";")
		.map((x) => x.trim())
		.filter(Boolean);
	assert.match(statements[statements.length - 1], /^ALTER TABLE users ADD COLUMN disabled/);
	assert.equal(statements.filter((x) => x.startsWith("ALTER")).length, 1, "one ALTER, and it is last");
	for (const statement of statements.slice(0, -1)) s.db.exec(statement);

	s.migrate();
	assert.deepEqual(s.rows("SELECT role, COUNT(*) AS n FROM user_mailboxes").map((r) => ({ ...r })), [{ role: "write", n: 1 }]);
	assert.equal(s.rows("SELECT disabled FROM users").length, 0);
});

// ------------------------------------------------------------------ sessions

test("a session from before the release still works, and moves under its hash", async (t) => {
	at(t, T0);
	const s = store();

	const session = await s.auth.validateSession(LEGACY_TOKEN);
	assert.deepEqual(session, {
		id: sha256(LEGACY_TOKEN),
		userId: "admin-id",
		email: "Admin@Reflect.cloud",
		isAdmin: true,
		expiresAt: T0 + 10 * DAY,
	});
	assert.deepEqual(
		s.rows("SELECT id, last_used_at FROM sessions").map((r) => ({ ...r })),
		[{ id: sha256(LEGACY_TOKEN), last_used_at: T0 }],
		"no row holds the token any more",
	);

	assert.equal((await s.auth.validateSession(LEGACY_TOKEN))?.userId, "admin-id", "and it keeps working");
});

test("a session from before the release is not ended for being old", async (t) => {
	// Created 20 days ago with no record of use: that must not read as "idle for 20 days".
	at(t, T0);
	const s = store();
	assert.ok(await s.auth.validateSession(LEGACY_TOKEN));
	t.mock.timers.setTime(T0 + 9 * DAY);
	assert.ok(await s.auth.validateSession(LEGACY_TOKEN));
});

test("what is stored cannot be used as a token", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");
	await s.auth.validateSession(LEGACY_TOKEN);

	const stored = s.rows("SELECT id FROM sessions").map((r) => String(r.id));
	assert.equal(stored.length, 2);
	for (const id of stored) {
		assert.notEqual(id, token);
		assert.notEqual(id, LEGACY_TOKEN);
		assert.match(id, /^[0-9a-f]{64}$/);
		assert.equal(await s.auth.validateSession(id), null, "a stored hash is not a session token");
	}
	assert.equal(s.rows("SELECT id FROM sessions").length, 2, "and trying one changes nothing");
});

test("junk tokens are a quiet null", async (t) => {
	at(t, T0);
	const s = store();
	for (const token of ["", "undefined", "null", "x".repeat(5000), "00000000-0000-4000-8000-000000000000"]) {
		assert.equal(await s.auth.validateSession(token), null, token.slice(0, 20));
	}
	assert.equal(await s.auth.validateSession(undefined as unknown as string), null);
});

test("signing in returns a token that is not what is stored", async (t) => {
	at(t, T0);
	const s = store();
	const result = await signIn(s, "member@reflect.cloud");
	assert.equal(result.status, "ok");
	if (result.status !== "ok") return;

	assert.equal(result.session.id, sha256(result.token));
	assert.equal(result.session.userId, "member-id");
	assert.equal(result.session.isAdmin, false);
	assert.equal(result.session.expiresAt, T0 + 30 * DAY);
	assert.deepEqual(await s.auth.validateSession(result.token), result.session);
	assert.equal(s.rows("SELECT id FROM sessions WHERE id = ?", result.token).length, 0);
});

test("a session ends after 14 days without use", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");

	t.mock.timers.setTime(T0 + 14 * DAY);
	assert.ok(await s.auth.validateSession(token), "exactly 14 days is still in time");

	t.mock.timers.setTime(T0 + 28 * DAY + 1);
	assert.equal(await s.auth.validateSession(token), null);
	assert.equal(s.rows("SELECT id FROM sessions WHERE user_id = 'member-id'").length, 0, "the row is deleted");
});

test("a session in regular use still ends 30 days after sign-in", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");

	for (const day of [10, 20, 30]) {
		t.mock.timers.setTime(T0 + day * DAY);
		assert.ok(await s.auth.validateSession(token), `day ${day}`);
	}
	t.mock.timers.setTime(T0 + 30 * DAY + 1);
	assert.equal(await s.auth.validateSession(token), null);
});

test("last use is written at most once an hour", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");
	const lastUsed = () => s.rows("SELECT last_used_at FROM sessions WHERE user_id = 'member-id'")[0].last_used_at;
	assert.equal(lastUsed(), T0);

	t.mock.timers.setTime(T0 + 59 * MINUTE);
	await s.auth.validateSession(token);
	assert.equal(lastUsed(), T0, "not rewritten within the hour");

	t.mock.timers.setTime(T0 + 60 * MINUTE);
	await s.auth.validateSession(token);
	assert.equal(lastUsed(), T0 + 60 * MINUTE);
});

test("signing in clears out expired and idle sessions", async (t) => {
	at(t, T0);
	const s = store();
	s.rows("INSERT INTO sessions (id, user_id, expires_at, created_at, last_used_at) VALUES ('expired', 'admin-id', ?, ?, ?)", T0 - 1, T0 - 30 * DAY, T0 - 1);
	s.rows("INSERT INTO sessions (id, user_id, expires_at, created_at, last_used_at) VALUES ('idle', 'admin-id', ?, ?, ?)", T0 + DAY, T0 - 29 * DAY, T0 - 15 * DAY);
	s.rows("INSERT INTO sessions (id, user_id, expires_at, created_at, last_used_at) VALUES ('live', 'admin-id', ?, ?, ?)", T0 + DAY, T0 - 29 * DAY, T0 - DAY);

	await tokenFor(s, "member@reflect.cloud");
	const left = s.rows("SELECT id FROM sessions WHERE user_id = 'admin-id' ORDER BY id").map((r) => r.id);
	assert.deepEqual(left, [LEGACY_TOKEN, "live"], "the untouched pre-release session is kept too");
});

test("logout ends the session of the token it is given, old format or new", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");
	const other = await tokenFor(s, "member@reflect.cloud");

	await s.auth.logout(token);
	assert.equal(await s.auth.validateSession(token), null);
	assert.ok(await s.auth.validateSession(other), "other sessions are untouched");

	await s.auth.logout(LEGACY_TOKEN);
	assert.equal(await s.auth.validateSession(LEGACY_TOKEN), null);

	// A stored hash handed to logout ends nothing.
	await s.auth.logout(sha256(other));
	assert.ok(await s.auth.validateSession(other));
	assert.equal(await s.auth.logout(""), true);
});

// ------------------------------------------------------------------- sign-in

test("an account with an old-format password signs in and is upgraded", async (t) => {
	at(t, T0);
	const s = store();
	const stored = () => String(s.rows("SELECT password_hash FROM users WHERE id = 'admin-id'")[0].password_hash);
	assert.equal(stored(), sha256(PASSWORD));

	const first = await signIn(s, "Admin@Reflect.cloud");
	assert.equal(first.status, "ok");
	assert.equal(isPasswordHash(stored()), true, "stored in the new format after the first sign-in");
	assert.deepEqual(await verifyPassword(PASSWORD, stored()), { ok: true, needsRehash: false });
	assert.equal(
		s.rows("SELECT updated_at FROM users WHERE id = 'admin-id'")[0].updated_at,
		T0 - 90 * DAY,
		"the upgrade is not an edit of the account",
	);

	const upgraded = stored();
	const second = await signIn(s, "Admin@Reflect.cloud");
	assert.equal(second.status, "ok", "and the same password keeps working");
	assert.equal(stored(), upgraded, "no second rewrite");
});

test("the address is matched without regard to letter case", async (t) => {
	at(t, T0);
	const s = store();
	for (const typed of ["admin@reflect.cloud", "ADMIN@REFLECT.CLOUD", " Admin@Reflect.cloud "]) {
		const result = await signIn(s, typed);
		assert.equal(result.status, "ok", typed);
		if (result.status === "ok") assert.equal(result.session.userId, "admin-id");
	}
});

test("two old accounts differing only in letter case each keep their own sign-in", async (t) => {
	at(t, T0);
	const s = store();
	insertLegacyUser(s, "twin-id", "admin@reflect.cloud", false, T0 - 10 * DAY);

	const exact = await s.auth.beginLogin("admin@reflect.cloud", "ip");
	assert.equal(exact.user?.id, "twin-id", "the spelling typed exactly wins");
	const original = await s.auth.beginLogin("Admin@Reflect.cloud", "ip");
	assert.equal(original.user?.id, "admin-id");
	const neither = await s.auth.beginLogin("ADMIN@reflect.cloud", "ip");
	assert.equal(neither.user?.id, "admin-id", "otherwise the older account");
});

test("a wrong password and an unknown address get no session", async (t) => {
	at(t, T0);
	const s = store();
	assert.deepEqual(await signIn(s, "admin@reflect.cloud", "not-the-password"), { status: "wrong" });
	assert.deepEqual(await signIn(s, "nobody@reflect.cloud"), { status: "wrong" });
	assert.equal(s.rows("SELECT id FROM sessions").length, 1, "only the pre-release session exists");
	assert.equal(
		String(s.rows("SELECT password_hash FROM users WHERE id = 'admin-id'")[0].password_hash),
		sha256(PASSWORD),
		"a failed attempt does not touch the stored password",
	);
});

test("completeLogin refuses when the password changed while it was being checked", async (t) => {
	at(t, T0);
	const s = store();
	const attempt = await s.auth.beginLogin("member@reflect.cloud", "ip");
	assert.ok(attempt.user);
	await s.auth.updateUserPassword("member-id", "a-brand-new-password");

	const result = await s.auth.completeLogin({
		userId: "member-id",
		verifiedHash: attempt.user.passwordHash,
		upgradedHash: CURRENT_HASH,
		email: "member@reflect.cloud",
		ip: "ip",
	});
	assert.deepEqual(result, { status: "invalid" });
	assert.equal(s.rows("SELECT id FROM sessions WHERE user_id = 'member-id'").length, 0);
	const stored = String(s.rows("SELECT password_hash FROM users WHERE id = 'member-id'")[0].password_hash);
	assert.equal((await verifyPassword("a-brand-new-password", stored)).ok, true, "the reset is not overwritten");
});

test("completeLogin never stores a password that is not hashed", async (t) => {
	at(t, T0);
	const s = store();
	const attempt = await s.auth.beginLogin("member@reflect.cloud", "ip");
	assert.ok(attempt.user);
	await assert.rejects(
		s.auth.completeLogin({
			userId: "member-id",
			verifiedHash: attempt.user.passwordHash,
			upgradedHash: PASSWORD,
			email: "member@reflect.cloud",
			ip: "ip",
		}),
		/not hashed/,
	);
	assert.equal(
		String(s.rows("SELECT password_hash FROM users WHERE id = 'member-id'")[0].password_hash),
		sha256(PASSWORD),
	);
});

// ------------------------------------------------------------------- backoff

test("five wrong passwords lock the address from that network for 30 seconds", async (t) => {
	at(t, T0);
	const s = store();
	for (let i = 1; i <= 5; i++) {
		assert.deepEqual(await signIn(s, "admin@reflect.cloud", "wrong"), { status: "wrong" }, `attempt ${i}`);
	}
	assert.deepEqual(await signIn(s, "admin@reflect.cloud"), { status: "locked", lockedForMs: 30 * SECOND });
	assert.deepEqual(
		await signIn(s, "ADMIN@Reflect.cloud"),
		{ status: "locked", lockedForMs: 30 * SECOND },
		"another letter case is the same address",
	);

	t.mock.timers.setTime(T0 + 30 * SECOND);
	assert.deepEqual(await signIn(s, "admin@reflect.cloud", "wrong"), { status: "wrong" }, "the lock ran out");
	assert.deepEqual(await signIn(s, "admin@reflect.cloud"), { status: "locked", lockedForMs: 60 * SECOND }, "and doubled");
});

test("a locked attempt is refused without the stored hash leaving the object", async (t) => {
	at(t, T0);
	const s = store();
	for (let i = 0; i < 5; i++) await s.auth.beginLogin("admin@reflect.cloud", "ip");
	assert.deepEqual(await s.auth.beginLogin("admin@reflect.cloud", "ip"), { lockedForMs: 30 * SECOND, user: null });
	// Refused attempts are not counted: hammering during a lock must not extend it.
	for (let i = 0; i < 20; i++) await s.auth.beginLogin("admin@reflect.cloud", "ip");
	t.mock.timers.setTime(T0 + 30 * SECOND);
	assert.equal((await s.auth.beginLogin("admin@reflect.cloud", "ip")).lockedForMs, 0);
});

test("the lock is per network: the real user elsewhere is not locked out", async (t) => {
	at(t, T0);
	const s = store();
	for (let i = 0; i < 6; i++) await signIn(s, "admin@reflect.cloud", "wrong", "198.51.100.66");
	assert.equal((await signIn(s, "admin@reflect.cloud", PASSWORD, "198.51.100.66")).status, "locked");
	assert.equal((await signIn(s, "admin@reflect.cloud", PASSWORD, "203.0.113.7")).status, "ok");
});

test("an unknown address is throttled exactly like a real one", async (t) => {
	at(t, T0);
	const s = store();
	for (let i = 0; i < 5; i++) {
		assert.deepEqual(await signIn(s, "nobody@reflect.cloud", "wrong"), { status: "wrong" });
	}
	assert.deepEqual(await signIn(s, "nobody@reflect.cloud", "wrong"), { status: "locked", lockedForMs: 30 * SECOND });
});

test("a successful sign-in clears the count", async (t) => {
	at(t, T0);
	const s = store();
	for (let i = 0; i < 4; i++) await signIn(s, "admin@reflect.cloud", "wrong");
	assert.equal((await signIn(s, "admin@reflect.cloud")).status, "ok", "the fifth attempt, with the right password");
	assert.equal(s.rows("SELECT attempt_key FROM login_attempts").length, 0);
	for (let i = 0; i < 4; i++) {
		assert.deepEqual(await signIn(s, "admin@reflect.cloud", "wrong"), { status: "wrong" });
	}
	assert.equal((await signIn(s, "admin@reflect.cloud")).status, "ok");
});

test("many networks guessing one address are stopped at 50 failures an hour", async (t) => {
	at(t, T0);
	const s = store();
	for (let i = 0; i < 50; i++) {
		assert.equal((await s.auth.beginLogin("admin@reflect.cloud", `10.0.0.${i}`)).lockedForMs, 0, `network ${i}`);
	}
	assert.deepEqual(await s.auth.beginLogin("admin@reflect.cloud", "10.0.1.1"), { lockedForMs: 15 * MINUTE, user: null });
	assert.equal((await s.auth.beginLogin("member@reflect.cloud", "10.0.1.1")).lockedForMs, 0, "other accounts are unaffected");

	t.mock.timers.setTime(T0 + 15 * MINUTE);
	assert.equal((await signIn(s, "admin@reflect.cloud", PASSWORD, "203.0.113.7")).status, "ok", "the owner gets in once it ends");
});

test("a browser that has signed in before is not held by the account-wide lock", async (t) => {
	at(t, T0);
	const s = store();
	const first = await signIn(s, "admin@reflect.cloud");
	assert.equal(first.status, "ok");
	const device = (first as { deviceToken: string | null }).deviceToken;
	assert.ok(device, "the first sign-in from a browser marks it as known");
	assert.equal(s.rows("SELECT device_hash FROM known_devices WHERE device_hash = ?", device).length, 0, "stored hashed, not as it is");
	assert.equal(s.rows("SELECT device_hash FROM known_devices WHERE device_hash = ?", sha256(device as string)).length, 1);

	// Someone else guesses from 50 networks until the address is locked for everyone unknown.
	for (let i = 0; i < 50; i++) await s.auth.beginLogin("admin@reflect.cloud", `10.0.0.${i}`);
	assert.equal((await s.auth.beginLogin("admin@reflect.cloud", "198.51.100.9")).lockedForMs, 15 * MINUTE, "a stranger is refused");
	assert.equal((await s.auth.beginLogin("admin@reflect.cloud", "198.51.100.9", "not-a-known-device")).lockedForMs, 15 * MINUTE);

	const again = await signIn(s, "admin@reflect.cloud", PASSWORD, "198.51.100.10", device);
	assert.equal(again.status, "ok", "the owner's own browser still gets in");
	assert.equal((again as { deviceToken: string | null }).deviceToken, null, "and is not issued a second mark");

	// The mark is for one account only, and its own per-network count still applies.
	for (let i = 0; i < 50; i++) await s.auth.beginLogin("member@reflect.cloud", `10.0.2.${i}`);
	assert.equal((await s.auth.beginLogin("member@reflect.cloud", "198.51.100.11", device)).lockedForMs, 15 * MINUTE, "it does not open another account");
	for (let i = 0; i < 5; i++) assert.deepEqual(await signIn(s, "admin@reflect.cloud", "wrong", "198.51.100.12", device), { status: "wrong" });
	assert.equal((await s.auth.beginLogin("admin@reflect.cloud", "198.51.100.12", device)).lockedForMs, 30 * SECOND, "wrong passwords from it are still counted");
});

test("at most twenty known browsers are kept per account", async (t) => {
	at(t, T0);
	const s = store();
	for (let i = 0; i < 23; i++) {
		t.mock.timers.setTime(T0 + i * SECOND);
		assert.equal((await signIn(s, "member@reflect.cloud", PASSWORD, `203.0.113.${i}`)).status, "ok");
	}
	assert.equal(s.rows("SELECT device_hash FROM known_devices WHERE user_id = 'member-id'").length, 20);
});

test("counters that have been quiet for an hour are deleted", async (t) => {
	at(t, T0);
	const s = store();
	await signIn(s, "nobody@reflect.cloud", "wrong", "10.0.0.1");
	await signIn(s, "someone@reflect.cloud", "wrong", "10.0.0.2");
	assert.equal(s.rows("SELECT attempt_key FROM login_attempts").length, 4);

	t.mock.timers.setTime(T0 + HOUR + 1);
	await signIn(s, "other@reflect.cloud", "wrong", "10.0.0.3");
	assert.deepEqual(
		s.rows("SELECT attempt_key FROM login_attempts ORDER BY attempt_key").map((r) => r.attempt_key),
		["login-all other@reflect.cloud", "login-from other@reflect.cloud 10.0.0.3"],
	);
});

// ------------------------------------------------------------------ accounts

test("new accounts are stored trimmed, lower-case and hashed", async (t) => {
	at(t, T0);
	const s = store();
	const user = await s.auth.createUser("  New.Person@Reflect.Cloud ", CURRENT_HASH);
	assert.deepEqual(user, {
		id: user?.id,
		email: "new.person@reflect.cloud",
		isAdmin: false,
		createdAt: T0,
		updatedAt: T0,
	});
	assert.equal((await signIn(s, "NEW.person@reflect.cloud")).status, "ok");
});

test("an address that exists in another letter case cannot be registered", async (t) => {
	at(t, T0);
	const s = store();
	assert.equal(await s.auth.createUser("admin@reflect.cloud", CURRENT_HASH), null);
	assert.equal(await s.auth.createUser("ADMIN@REFLECT.CLOUD", CURRENT_HASH), null);
	assert.equal(s.rows("SELECT id FROM users").length, 2);
});

test("a plain password is never stored", async (t) => {
	at(t, T0);
	const s = store();
	await assert.rejects(s.auth.createUser("x@reflect.cloud", PASSWORD), /not hashed/);
	await assert.rejects(s.auth.createUser("x@reflect.cloud", sha256(PASSWORD)), /not hashed/);
	await assert.rejects(
		s.auth.updateUser({ userId: "admin-id", sessionId: "s" }, "member-id", { passwordHash: PASSWORD }),
		/not hashed/,
	);
	assert.equal(s.rows("SELECT id FROM users").length, 2);
});

test("only the very first account becomes an administrator", async (t) => {
	at(t, T0);
	const empty = unmigratedStore();
	empty.migrate();
	assert.equal(await empty.auth.hasUsers(), false);
	assert.equal((await empty.auth.createUser("first@x.io", CURRENT_HASH, true))?.isAdmin, true);
	// A second registration that also believed it was first (the two raced).
	assert.equal((await empty.auth.createUser("second@x.io", CURRENT_HASH, true))?.isAdmin, false);
	assert.equal(await empty.auth.hasUsers(), true);
});

test("getUsers lists each account with its state and mailboxes", async (t) => {
	at(t, T0);
	const s = store();
	assert.deepEqual(await s.auth.getUsers(), [
		{
			id: "admin-id",
			email: "Admin@Reflect.cloud",
			isAdmin: true,
			disabled: false,
			createdAt: T0 - 90 * DAY,
			updatedAt: T0 - 90 * DAY,
			mailboxes: [],
		},
		{
			id: "member-id",
			email: "member@reflect.cloud",
			isAdmin: false,
			disabled: false,
			createdAt: T0 - 60 * DAY,
			updatedAt: T0 - 60 * DAY,
			mailboxes: [
				{ mailboxId: "Support@Reflect.cloud", role: "write" },
				{ mailboxId: "sales@reflect.cloud", role: "owner" },
			],
		},
	]);
	assert.equal((await s.auth.getUserByEmail("MEMBER@reflect.cloud"))?.id, "member-id");
	assert.equal(await s.auth.getUserByEmail("nobody@reflect.cloud"), null);
});

const ADMIN = { userId: "admin-id", sessionId: "admin-session" };

test("disabling an account ends its sessions, its notifications and its sign-in", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");
	s.rows("INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_id, created_at) VALUES ('p1', 'https://push.example/1', 'k', 'a', 'member-id', 'now')");
	s.rows("INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_id, created_at) VALUES ('p2', 'https://push.example/2', 'k', 'a', 'admin-id', 'now')");

	assert.deepEqual(await s.auth.updateUser(ADMIN, "member-id", { disabled: true }), { ok: true });
	assert.equal(await s.auth.validateSession(token), null);
	assert.deepEqual(s.rows("SELECT id FROM push_subscriptions").map((r) => r.id), ["p2"]);
	assert.equal((await s.auth.getUsers())[1].disabled, true);

	assert.deepEqual(await signIn(s, "member@reflect.cloud"), { status: "disabled" }, "the right password is told why");
	assert.deepEqual(await signIn(s, "member@reflect.cloud", "wrong"), { status: "wrong" }, "a wrong one is told nothing");
	assert.equal(s.rows("SELECT id FROM sessions WHERE user_id = 'member-id'").length, 0);

	assert.deepEqual(await s.auth.updateUser(ADMIN, "member-id", { disabled: false }), { ok: true });
	assert.equal((await signIn(s, "member@reflect.cloud")).status, "ok");
});

test("a session of a disabled account is refused even if one is left over", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");
	s.rows("UPDATE users SET disabled = 1 WHERE id = 'member-id'");
	assert.equal(await s.auth.validateSession(token), null);
});

test("an admin setting a password signs that user out everywhere", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");
	const newHash = await hashPassword("a-brand-new-password");

	assert.deepEqual(await s.auth.updateUser(ADMIN, "member-id", { passwordHash: newHash }), { ok: true });
	assert.equal(await s.auth.validateSession(token), null);
	assert.deepEqual(await signIn(s, "member@reflect.cloud", PASSWORD), { status: "wrong" });
	assert.equal((await signIn(s, "member@reflect.cloud", "a-brand-new-password")).status, "ok");
});

test("an admin reset lets a locked-out user sign in at once", async (t) => {
	at(t, T0);
	const s = store();
	// Forgot the password: wrong guesses from two networks, both now locked.
	for (const ip of ["203.0.113.7", "203.0.113.8"]) {
		for (let i = 0; i < 6; i++) await signIn(s, "Member@Reflect.cloud", "wrong", ip);
		assert.ok((await s.auth.beginLogin("member@reflect.cloud", ip)).lockedForMs > 0);
	}
	for (let i = 0; i < 5; i++) await signIn(s, "admin@reflect.cloud", "wrong", "203.0.113.9");

	const newHash = await hashPassword("a-brand-new-password");
	assert.deepEqual(await s.auth.updateUser(ADMIN, "member-id", { passwordHash: newHash }), { ok: true });
	assert.equal((await signIn(s, "member@reflect.cloud", "a-brand-new-password", "203.0.113.7")).status, "ok");
	assert.equal((await signIn(s, "member@reflect.cloud", "a-brand-new-password", "203.0.113.8")).status, "ok");
	assert.ok((await s.auth.beginLogin("admin@reflect.cloud", "203.0.113.9")).lockedForMs > 0, "another account's lock is untouched");
});

test("an admin setting their own password keeps the session they did it from", async (t) => {
	at(t, T0);
	const s = store();
	const here = await signIn(s, "admin@reflect.cloud");
	const elsewhere = await signIn(s, "admin@reflect.cloud", PASSWORD, "198.51.100.1");
	assert.ok(here.status === "ok" && elsewhere.status === "ok");

	const actor = { userId: "admin-id", sessionId: here.session.id };
	assert.deepEqual(await s.auth.updateUser(actor, "admin-id", { passwordHash: CURRENT_HASH }), { ok: true });
	assert.ok(await s.auth.validateSession(here.token));
	assert.equal(await s.auth.validateSession(elsewhere.token), null);
	assert.equal(await s.auth.validateSession(LEGACY_TOKEN), null);
});

test("promoting and demoting takes effect on sessions that already exist", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");
	assert.deepEqual(await s.auth.updateUser(ADMIN, "member-id", { isAdmin: true }), { ok: true });
	assert.equal((await s.auth.validateSession(token))?.isAdmin, true);
	assert.deepEqual(await s.auth.updateUser(ADMIN, "member-id", { isAdmin: false }), { ok: true });
	assert.equal((await s.auth.validateSession(token))?.isAdmin, false);
});

test("an admin cannot demote, disable or delete themselves", async (t) => {
	at(t, T0);
	const s = store();
	// A second admin exists, so these are refused for being "yourself", not for being the last one.
	await s.auth.updateUser(ADMIN, "member-id", { isAdmin: true });

	for (const change of [{ isAdmin: false }, { disabled: true }, { isAdmin: false, disabled: true }]) {
		const result = await s.auth.updateUser(ADMIN, "admin-id", change);
		assert.equal(result.ok, false);
		if (result.ok === false) {
			assert.equal(result.status, 409);
			assert.match(result.error, /your own/);
		}
	}
	const deleted = await s.auth.deleteUser("admin-id", "admin-id");
	assert.equal(deleted.ok === false && deleted.status, 409);

	// Sending the flags unchanged, as a form that posts every field would, is not a change.
	assert.deepEqual(await s.auth.updateUser(ADMIN, "admin-id", { isAdmin: true, disabled: false }), { ok: true });
	assert.deepEqual(
		s.rows("SELECT is_admin, disabled FROM users WHERE id = 'admin-id'").map((r) => ({ ...r })),
		[{ is_admin: 1, disabled: 0 }],
	);
});

test("the last active administrator cannot be demoted, disabled or deleted", async (t) => {
	at(t, T0);
	const s = store();
	// Whoever asks: here a second admin who is disabled, so does not count as active.
	await s.auth.createUser("ghost@reflect.cloud", CURRENT_HASH);
	const ghost = String(s.rows("SELECT id FROM users WHERE email = 'ghost@reflect.cloud'")[0].id);
	s.rows("UPDATE users SET is_admin = 1, disabled = 1 WHERE id = ?", ghost);
	const actor = { userId: ghost, sessionId: "s" };

	for (const change of [{ isAdmin: false }, { disabled: true }]) {
		const result = await s.auth.updateUser(actor, "admin-id", change);
		assert.equal(result.ok === false && result.status, 409);
		assert.match(result.ok === false ? result.error : "", /last active administrator/);
	}
	const deleted = await s.auth.deleteUser(ghost, "admin-id");
	assert.equal(deleted.ok === false && deleted.status, 409);
	assert.deepEqual(
		s.rows("SELECT is_admin, disabled FROM users WHERE id = 'admin-id'").map((r) => ({ ...r })),
		[{ is_admin: 1, disabled: 0 }],
	);

	// With a second active admin, the first can go.
	await s.auth.updateUser(ADMIN, "member-id", { isAdmin: true });
	assert.deepEqual(await s.auth.updateUser({ userId: "member-id", sessionId: "s" }, "admin-id", { isAdmin: false }), { ok: true });
});

test("changing or deleting an unknown user is a 404", async (t) => {
	at(t, T0);
	const s = store();
	const missing = { ok: false, status: 404, error: "User not found" };
	assert.deepEqual(await s.auth.updateUser(ADMIN, "no-such-id", { disabled: true }), missing);
	assert.deepEqual(await s.auth.deleteUser("admin-id", "no-such-id"), missing);
	assert.equal(await s.auth.revokeUserSessions("no-such-id"), null);
});

test("deleting a user removes their access, sessions and notifications", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");
	s.rows("INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_id, created_at) VALUES ('p1', 'https://push.example/1', 'k', 'a', 'member-id', 'now')");

	assert.deepEqual(await s.auth.deleteUser("admin-id", "member-id"), { ok: true });
	assert.equal(await s.auth.validateSession(token), null);
	for (const table of ["user_mailboxes", "sessions", "push_subscriptions"]) {
		assert.equal(s.rows(`SELECT * FROM ${table} WHERE user_id = 'member-id'`).length, 0, table);
	}
	assert.deepEqual((await s.auth.getUsers()).map((u) => u.id), ["admin-id"]);
	assert.deepEqual(await signIn(s, "member@reflect.cloud"), { status: "wrong" });
	assert.ok(await s.auth.validateSession(LEGACY_TOKEN), "nobody else is affected");
});

test("revoking sessions signs a user out everywhere and says how many ended", async (t) => {
	at(t, T0);
	const s = store();
	const a = await tokenFor(s, "member@reflect.cloud");
	const b = await tokenFor(s, "member@reflect.cloud");

	s.rows("INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_id, created_at) VALUES ('p1', 'https://push.example/1', 'k', 'a', 'member-id', 'now')");
	s.rows("INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_id, created_at) VALUES ('p2', 'https://push.example/2', 'k', 'a', 'admin-id', 'now')");

	assert.equal(await s.auth.revokeUserSessions("member-id"), 2);
	assert.equal(await s.auth.validateSession(a), null);
	assert.equal(await s.auth.validateSession(b), null);
	// A lost phone must also stop showing mail previews, and stops counting as a known browser.
	assert.deepEqual(s.rows("SELECT id FROM push_subscriptions").map((r) => r.id), ["p2"]);
	assert.equal(s.rows("SELECT device_hash FROM known_devices WHERE user_id = 'member-id'").length, 0);
	assert.equal(await s.auth.revokeUserSessions("member-id"), 0);
	assert.ok(await s.auth.validateSession(LEGACY_TOKEN));
	assert.equal((await signIn(s, "member@reflect.cloud")).status, "ok", "they can sign in again");
});

// ---------------------------------------------------------- change password

test("changing your password ends every other session and keeps this one", async (t) => {
	at(t, T0);
	const s = store();
	const here = await signIn(s, "member@reflect.cloud");
	const elsewhere = await signIn(s, "member@reflect.cloud", PASSWORD, "198.51.100.1");
	assert.ok(here.status === "ok" && elsewhere.status === "ok");

	const attempt = await s.auth.beginPasswordChange("member-id");
	assert.equal(attempt.lockedForMs, 0);
	assert.equal((await verifyPassword(PASSWORD, attempt.passwordHash as string)).ok, true);
	const newHash = await hashPassword("a-brand-new-password");
	assert.equal(await s.auth.completePasswordChange("member-id", attempt.passwordHash as string, newHash, here.session.id), true);

	assert.ok(await s.auth.validateSession(here.token));
	assert.equal(await s.auth.validateSession(elsewhere.token), null);
	assert.deepEqual(await signIn(s, "member@reflect.cloud", PASSWORD), { status: "wrong" });
	assert.equal((await signIn(s, "member@reflect.cloud", "a-brand-new-password")).status, "ok");
	assert.equal(s.rows("SELECT attempt_key FROM login_attempts WHERE attempt_key LIKE 'password %'").length, 0);
});

test("wrong guesses at the current password are throttled per user", async (t) => {
	at(t, T0);
	const s = store();
	for (let i = 0; i < 5; i++) {
		assert.equal((await s.auth.beginPasswordChange("member-id")).lockedForMs, 0);
	}
	assert.deepEqual(await s.auth.beginPasswordChange("member-id"), { lockedForMs: 30 * SECOND, passwordHash: null });
	assert.equal((await s.auth.beginPasswordChange("admin-id")).lockedForMs, 0, "another user is unaffected");
	assert.equal((await signIn(s, "member@reflect.cloud")).status, "ok", "and so is signing in");
	assert.deepEqual(await s.auth.beginPasswordChange("no-such-id"), { lockedForMs: 0, passwordHash: null });
});

test("a password change loses to a reset that happened meanwhile", async (t) => {
	at(t, T0);
	const s = store();
	const attempt = await s.auth.beginPasswordChange("member-id");
	await s.auth.updateUser(ADMIN, "member-id", { passwordHash: CURRENT_HASH });
	const mine = await hashPassword("a-brand-new-password");
	assert.equal(await s.auth.completePasswordChange("member-id", attempt.passwordHash as string, mine, "s"), false);
	assert.equal(String(s.rows("SELECT password_hash FROM users WHERE id = 'member-id'")[0].password_hash), CURRENT_HASH);
	await assert.rejects(
		s.auth.completePasswordChange("member-id", CURRENT_HASH, "plain-text-password", "s"),
		/not hashed/,
	);
});

test("updateUserPassword (the reset route) stores the new format and ends sessions", async (t) => {
	at(t, T0);
	const s = store();
	const token = await tokenFor(s, "member@reflect.cloud");
	await s.auth.updateUserPassword("member-id", "reset-to-this-one");

	const stored = String(s.rows("SELECT password_hash FROM users WHERE id = 'member-id'")[0].password_hash);
	assert.equal(isPasswordHash(stored), true);
	assert.equal(await s.auth.validateSession(token), null);
	assert.equal((await signIn(s, "member@reflect.cloud", "reset-to-this-one")).status, "ok");
});

// -------------------------------------------------------------------- grants

test("granting twice changes the role instead of failing", async (t) => {
	at(t, T0);
	const s = store();
	await s.auth.grantMailboxAccess("member-id", "billing@reflect.cloud", "read");
	await s.auth.grantMailboxAccess("member-id", "billing@reflect.cloud", "admin");
	assert.deepEqual(
		(await s.auth.getUserMailboxes("member-id")).filter((m) => m.mailboxId === "billing@reflect.cloud"),
		[{ mailboxId: "billing@reflect.cloud", role: "admin" }],
	);
});

test("a grant matches the mailbox in any letter case and is stored lower-case", async (t) => {
	at(t, T0);
	const s = store();
	// "Support@Reflect.cloud" exists from before, as the admin typed it then.
	await s.auth.grantMailboxAccess("member-id", "  SUPPORT@reflect.cloud ", "read");
	assert.deepEqual(
		(await s.auth.getUserMailboxes("member-id")).sort((a, b) => a.mailboxId.localeCompare(b.mailboxId)),
		[
			{ mailboxId: "sales@reflect.cloud", role: "owner" },
			{ mailboxId: "support@reflect.cloud", role: "read" },
		],
	);
	assert.deepEqual(await s.auth.getUserMailboxes("admin-id"), [], "one user's grant does not touch another's");

	await s.auth.revokeMailboxAccess("member-id", " Support@REFLECT.cloud ");
	assert.deepEqual(await s.auth.getUserMailboxes("member-id"), [{ mailboxId: "sales@reflect.cloud", role: "owner" }]);
});

test("an unknown role is refused", async (t) => {
	at(t, T0);
	const s = store();
	await assert.rejects(s.auth.grantMailboxAccess("member-id", "billing@reflect.cloud", "superuser"), /role/);
	assert.equal((await s.auth.getUserMailboxes("member-id")).length, 2);
});

test("a mailbox object refuses every auth call", async () => {
	const s = unmigratedStore();
	// biome-ignore lint/suspicious/noExplicitAny: a test double for SqlStorage
	const mailbox = new AuthHandler(sqlStorage(s.db) as any, new DOQB(sqlStorage(s.db) as any), false);
	await assert.rejects(mailbox.validateSession("token"), /Not an auth DO/);
	await assert.rejects(mailbox.beginLogin("a@x.io", "ip"), /Not an auth DO/);
	await assert.rejects(mailbox.createUser("a@x.io", CURRENT_HASH), /Not an auth DO/);
	await assert.rejects(mailbox.updateUser(ADMIN, "member-id", { disabled: true }), /Not an auth DO/);
	await assert.rejects(mailbox.deleteUser("admin-id", "member-id"), /Not an auth DO/);
	assert.equal(await mailbox.hasUsers(), false);
});
