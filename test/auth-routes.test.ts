// The auth HTTP routes, answered by the real route classes over the real AuthHandler (see
// auth-harness.ts). The request gate in worker.ts is not part of this: a few lines below stand in
// for the one thing these routes need from it, the session of the first valid presented token.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import {
	DeleteUser,
	GetMe,
	GetUsers,
	PostAdminRegister,
	PostChangePassword,
	PostGrantAccess,
	PostLogin,
	PostLogout,
	PostRegister,
	PostRevokeAccess,
	PostRevokeUserSessions,
	PutUser,
} from "../src/routes/auth.ts";
import { isPasswordHash } from "../src/password.ts";
import { readSessionTokens } from "../src/session-cookie.ts";
import { at, DAY, LEGACY_TOKEN, PASSWORD, type Store, sha256, store, T0, unmigratedStore } from "./auth-harness.ts";

const ORIGIN = "https://mail.example.test";
const HOST_COOKIE = /^__Host-session=([^;]+); HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=2592000$/;

interface Reply {
	status: number;
	// biome-ignore lint/suspicious/noExplicitAny: arbitrary JSON
	body: any;
	text: string;
	cookies: string[];
	headers: Headers;
}

interface Call {
	json?: unknown;
	cookie?: string;
	bearer?: string;
	ip?: string;
	origin?: string;
}

function api(s: Store, registerEnabled?: boolean) {
	// biome-ignore lint/suspicious/noExplicitAny: the routes' own context type needs the real bindings
	const app = new Hono<any>();
	app.use("*", async (c, next) => {
		for (const { token } of readSessionTokens(c.req.raw)) {
			const session = await s.auth.validateSession(token);
			if (session) {
				c.set("session", session);
				break;
			}
		}
		await next();
	});
	const openapi = fromHono(app);
	openapi.post("/api/v1/auth/register", PostRegister);
	openapi.post("/api/v1/auth/login", PostLogin);
	openapi.post("/api/v1/auth/logout", PostLogout);
	openapi.get("/api/v1/auth/me", GetMe);
	openapi.post("/api/v1/auth/change-password", PostChangePassword);
	openapi.post("/api/v1/auth/admin/register", PostAdminRegister);
	openapi.get("/api/v1/auth/admin/users", GetUsers);
	openapi.put("/api/v1/auth/admin/users/:userId", PutUser);
	openapi.delete("/api/v1/auth/admin/users/:userId", DeleteUser);
	openapi.post("/api/v1/auth/admin/users/:userId/revoke-sessions", PostRevokeUserSessions);
	openapi.post("/api/v1/auth/admin/grant-access", PostGrantAccess);
	openapi.post("/api/v1/auth/admin/revoke-access", PostRevokeAccess);

	// The AUTH object's RPC methods are AuthHandler's, name for name.
	const env = {
		MAILBOX: { idFromName: () => "AUTH", get: () => s.auth },
		config: { auth: { enabled: true, registerEnabled } },
	};

	return async (method: string, path: string, call: Call = {}): Promise<Reply> => {
		const headers: Record<string, string> = {};
		if (call.json !== undefined) headers["Content-Type"] = "application/json";
		if (call.cookie) headers.Cookie = call.cookie;
		if (call.bearer) headers.Authorization = `Bearer ${call.bearer}`;
		if (call.ip !== "") headers["CF-Connecting-IP"] = call.ip ?? "203.0.113.7";
		const res = await app.request(
			`${call.origin ?? ORIGIN}${path}`,
			{ method, headers, body: call.json === undefined ? undefined : JSON.stringify(call.json) },
			env,
		);
		const text = await res.text();
		let body: unknown = text;
		try {
			body = JSON.parse(text);
		} catch {
			// not JSON
		}
		return { status: res.status, body, text, cookies: res.headers.getSetCookie(), headers: res.headers };
	};
}

type Api = ReturnType<typeof api>;

/** Signs in and returns the Cookie header a browser would send from then on. */
async function cookieFor(call: Api, email: string, password = PASSWORD, ip?: string): Promise<string> {
	const res = await call("POST", "/api/v1/auth/login", { json: { email, password }, ip });
	assert.equal(res.status, 200, res.text);
	const cookie = res.cookies.find((c) => c.startsWith("__Host-session=") && !c.startsWith("__Host-session=;"));
	assert.ok(cookie, "login sets the session cookie");
	return cookie.split(";")[0];
}

const userId = (s: Store, email: string) => String(s.rows("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", email)[0].id);

// --------------------------------------------------------------------- login

test("login: the token is in the cookie and nowhere in the body", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);

	const res = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: PASSWORD } });
	assert.equal(res.status, 200);
	assert.deepEqual(res.body, {
		userId: "member-id",
		email: "member@reflect.cloud",
		isAdmin: false,
		expiresAt: T0 + 30 * DAY,
	});

	// The new cookie, a deletion of the name used before this release, and the mark that this
	// browser has signed in to the account (see "a browser that has signed in before").
	assert.deepEqual(res.cookies.map((c) => c.split("=")[0]).sort(), ["__Host-device", "__Host-session", "session"]);
	assert.ok(res.cookies.includes("session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"));
	const cookie = res.cookies.find((c) => HOST_COOKIE.test(c));
	assert.ok(cookie, `unexpected cookies: ${res.cookies.join(" | ")}`);
	const token = (HOST_COOKIE.exec(cookie) as RegExpExecArray)[1];

	assert.ok(!res.text.includes(token), "the token is not in the body");
	assert.ok(!res.text.includes(sha256(token)), "nor is the id it is stored under");
	assert.equal(s.rows("SELECT id FROM sessions WHERE id = ?", token).length, 0, "and it is not stored as it is");
	assert.equal(s.rows("SELECT id FROM sessions WHERE id = ?", sha256(token)).length, 1);

	const me = await call("GET", "/api/v1/auth/me", { cookie: `__Host-session=${token}` });
	assert.equal(me.status, 200);
	assert.deepEqual(me.body, res.body, "/me has the same four fields and no id");
});

test("login on a plain-http development host uses the plain cookie name", async (t) => {
	at(t, T0);
	const call = api(store());
	const res = await call("POST", "/api/v1/auth/login", {
		json: { email: "member@reflect.cloud", password: PASSWORD },
		origin: "http://127.0.0.1:8787",
	});
	assert.equal(res.status, 200);
	assert.deepEqual(res.cookies.map((c) => c.split("=")[0]).sort(), ["device", "session"]);
	assert.match(
		res.cookies.find((c) => c.startsWith("session=")) as string,
		/^session=[^;]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=2592000$/,
	);
	assert.match(
		res.cookies.find((c) => c.startsWith("device=")) as string,
		/^device=[^;]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=31536000$/,
	);
});

test("login: wrong password and unknown address answer the same 401, with no cookie", async (t) => {
	at(t, T0);
	const call = api(store());
	const wrong = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: "not-the-password" } });
	const unknown = await call("POST", "/api/v1/auth/login", { json: { email: "nobody@reflect.cloud", password: PASSWORD } });
	for (const res of [wrong, unknown]) {
		assert.equal(res.status, 401);
		assert.deepEqual(res.body, { error: "Invalid credentials" });
		assert.deepEqual(res.cookies, []);
	}
});

test("login: an old-format password works, in any letter case of the address, and is upgraded", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	const res = await call("POST", "/api/v1/auth/login", { json: { email: "  admin@REFLECT.cloud ", password: PASSWORD } });
	assert.equal(res.status, 200, res.text);
	assert.equal(res.body.userId, "admin-id");
	assert.equal(res.body.isAdmin, true);
	assert.equal(isPasswordHash(s.rows("SELECT password_hash FROM users WHERE id = 'admin-id'")[0].password_hash), true);

	const again = await call("POST", "/api/v1/auth/login", { json: { email: "Admin@Reflect.cloud", password: PASSWORD } });
	assert.equal(again.status, 200, "and keeps working after the upgrade");
});

/** Runs `between` after the password check of the next sign-in and before its completeLogin. */
function beforeNextCompleteLogin(s: Store, between: () => Promise<unknown>) {
	const complete = s.auth.completeLogin.bind(s.auth);
	let done = false;
	s.auth.completeLogin = async (login) => {
		if (!done) {
			done = true;
			await between();
		}
		return complete(login);
	};
}

test("login: two sign-ins at once of an old-format account both succeed", async (t) => {
	// A double-clicked button on the first sign-in after the release: both requests are handed the
	// old hash, and the slower one finds it already replaced by the faster one.
	at(t, T0);
	const s = store();
	const call = api(s);
	const login = () => call("POST", "/api/v1/auth/login", { json: { email: "admin@reflect.cloud", password: PASSWORD } });

	let faster: Awaited<ReturnType<typeof login>> | undefined;
	beforeNextCompleteLogin(s, async () => {
		faster = await login();
	});
	const slower = await login();

	assert.equal(faster?.status, 200);
	assert.equal(slower.status, 200, slower.text);
	assert.equal(s.rows("SELECT id FROM sessions WHERE user_id = 'admin-id' AND length(id) = 64").length, 2);
	assert.equal(s.rows("SELECT attempt_key FROM login_attempts").length, 0, "and no failure is left counted");
});

test("login: a password reset while the old one is being checked wins", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	beforeNextCompleteLogin(s, () => s.auth.updateUserPassword("member-id", "reset-to-this-one"));

	const res = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: PASSWORD } });
	assert.equal(res.status, 401);
	assert.deepEqual(res.body, { error: "Invalid credentials" });
	assert.deepEqual(res.cookies, []);
	assert.equal(s.rows("SELECT id FROM sessions WHERE user_id = 'member-id'").length, 0);
});

test("login: a password longer than new ones may be still reaches the check", async (t) => {
	// Accounts created before the 256 limit could hold one; the limit must not lock them out.
	at(t, T0);
	const s = store();
	const long = "x".repeat(400);
	s.rows("UPDATE users SET password_hash = ? WHERE id = 'member-id'", sha256(long));
	const res = await api(s)("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: long } });
	assert.equal(res.status, 200, res.text);
});

test("login: the sixth attempt after five wrong passwords is a 429, even with the right one", async (t) => {
	at(t, T0);
	const call = api(store());
	for (let i = 0; i < 5; i++) {
		const res = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: "wrong-password" } });
		assert.equal(res.status, 401, `attempt ${i + 1}`);
	}
	const locked = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: PASSWORD } });
	assert.equal(locked.status, 429);
	assert.deepEqual(locked.body, { error: "Too many attempts. Try again in 30 seconds.", retry_after_seconds: 30 });
	assert.equal(locked.headers.get("Retry-After"), "30");
	assert.deepEqual(locked.cookies, []);

	const elsewhere = await call("POST", "/api/v1/auth/login", {
		json: { email: "member@reflect.cloud", password: PASSWORD },
		ip: "198.51.100.9",
	});
	assert.equal(elsewhere.status, 200, "the same account from another network is not locked");

	t.mock.timers.setTime(T0 + 30_000);
	const after = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: PASSWORD } });
	assert.equal(after.status, 200, "and the lock runs out");
});

test("login: without the Cloudflare header attempts are still counted", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	for (let i = 0; i < 5; i++) {
		await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: "wrong-password" }, ip: "" });
	}
	const locked = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: PASSWORD }, ip: "" });
	assert.equal(locked.status, 429);
	assert.ok(s.rows("SELECT attempt_key FROM login_attempts").some((r) => r.attempt_key === "login-from member@reflect.cloud unknown"));
});

test("login: a disabled account is told so only with the right password", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	s.rows("UPDATE users SET disabled = 1 WHERE id = 'member-id'");

	const right = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: PASSWORD } });
	assert.equal(right.status, 403);
	assert.deepEqual(right.body, { error: "This account is disabled. Contact an administrator." });
	assert.deepEqual(right.cookies, []);

	const wrong = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: "wrong-password" } });
	assert.equal(wrong.status, 401);
	assert.deepEqual(wrong.body, { error: "Invalid credentials" });
});

test("login: a malformed request is a 400 with one error line", async (t) => {
	at(t, T0);
	const call = api(store());
	const noPassword = await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud" } });
	assert.equal(noPassword.status, 400);
	assert.deepEqual(noPassword.body, { error: "password: Required" });

	const notAnEmail = await call("POST", "/api/v1/auth/login", { json: { email: "nope", password: PASSWORD } });
	assert.equal(notAnEmail.status, 400);
	assert.equal(typeof notAnEmail.body.error, "string");
	assert.match(notAnEmail.body.error, /^email: /);
});

// ------------------------------------------------- sessions from before today

test("a browser signed in before the release stays signed in", async (t) => {
	at(t, T0);
	const call = api(store());
	// The cookie as the previous release set it, and the header the previous dashboard build adds.
	const me = await call("GET", "/api/v1/auth/me", { cookie: `session=${LEGACY_TOKEN}`, bearer: LEGACY_TOKEN });
	assert.equal(me.status, 200);
	assert.deepEqual(me.body, { userId: "admin-id", email: "Admin@Reflect.cloud", isAdmin: true, expiresAt: T0 + 10 * DAY });
});

test("a tab on the previous dashboard build works after signing in again", async (t) => {
	// It stores the login response and sends its `id` as the bearer token. There is no `id` any
	// more, so the header reads "Bearer undefined" and the cookie has to carry the session.
	at(t, T0);
	const call = api(store());
	const cookie = await cookieFor(call, "member@reflect.cloud");
	const me = await call("GET", "/api/v1/auth/me", { cookie, bearer: "undefined" });
	assert.equal(me.status, 200);
	assert.equal(me.body.userId, "member-id");
});

// -------------------------------------------------------------------- logout

test("logout ends every session the request carries and clears both cookie names", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	const cookie = await cookieFor(call, "admin@reflect.cloud");

	const res = await call("POST", "/api/v1/auth/logout", { json: {}, cookie: `${cookie}; session=${LEGACY_TOKEN}` });
	assert.equal(res.status, 200);
	assert.deepEqual(res.body, { status: "logged out" });
	assert.deepEqual(res.cookies, [
		"__Host-session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
		"session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
	]);
	assert.equal(s.rows("SELECT id FROM sessions").length, 0);
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie })).status, 401);
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: `session=${LEGACY_TOKEN}` })).status, 401);
});

test("me without a session is a 401", async (t) => {
	at(t, T0);
	const call = api(store());
	assert.equal((await call("GET", "/api/v1/auth/me")).status, 401);
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: "__Host-session=not-a-session" })).status, 401);
});

// ------------------------------------------------------------------ register

test("register: the first account becomes the administrator, then registration closes", async (t) => {
	at(t, T0);
	const empty = unmigratedStore();
	empty.migrate();
	const call = api(empty);

	const first = await call("POST", "/api/v1/auth/register", { json: { email: "Owner@Reflect.cloud", password: PASSWORD } });
	assert.equal(first.status, 201, first.text);
	assert.deepEqual(first.body, { id: first.body.id, email: "owner@reflect.cloud", isAdmin: true, createdAt: T0, updatedAt: T0 });
	assert.equal(isPasswordHash(empty.rows("SELECT password_hash FROM users")[0].password_hash), true);

	const second = await call("POST", "/api/v1/auth/register", { json: { email: "second@reflect.cloud", password: PASSWORD } });
	assert.equal(second.status, 403);
	assert.equal((await call("POST", "/api/v1/auth/login", { json: { email: "owner@reflect.cloud", password: PASSWORD } })).status, 200);
});

test("register: passwords are 8 to 256 characters, said in one sentence", async (t) => {
	at(t, T0);
	const empty = unmigratedStore();
	empty.migrate();
	const call = api(empty, true);

	const short = await call("POST", "/api/v1/auth/register", { json: { email: "a@reflect.cloud", password: "1234567" } });
	assert.equal(short.status, 400);
	assert.deepEqual(short.body, { error: "Password must be at least 8 characters." });

	const long = await call("POST", "/api/v1/auth/register", { json: { email: "a@reflect.cloud", password: "x".repeat(257) } });
	assert.equal(long.status, 400);
	assert.deepEqual(long.body, { error: "Password must be at most 256 characters." });
	assert.equal(empty.rows("SELECT id FROM users").length, 0);

	assert.equal((await call("POST", "/api/v1/auth/register", { json: { email: "a@reflect.cloud", password: "x".repeat(256) } })).status, 201);
	const taken = await call("POST", "/api/v1/auth/register", { json: { email: "A@Reflect.cloud", password: PASSWORD } });
	assert.equal(taken.status, 400);
	assert.deepEqual(taken.body, { error: "Email already registered" });
});

// ----------------------------------------------------------- change password

test("change-password: a wrong current password is a 400, not a sign-out", async (t) => {
	at(t, T0);
	const call = api(store());
	const cookie = await cookieFor(call, "member@reflect.cloud");
	const res = await call("POST", "/api/v1/auth/change-password", {
		cookie,
		json: { current_password: "not-the-password", new_password: "a-brand-new-password" },
	});
	assert.equal(res.status, 400);
	assert.deepEqual(res.body, { error: "Current password is incorrect" });
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie })).status, 200);
});

test("change-password: sets the new password, keeps this session, ends the others", async (t) => {
	at(t, T0);
	const call = api(store());
	const here = await cookieFor(call, "member@reflect.cloud");
	const elsewhere = await cookieFor(call, "member@reflect.cloud", PASSWORD, "198.51.100.9");

	const res = await call("POST", "/api/v1/auth/change-password", {
		cookie: here,
		json: { current_password: PASSWORD, new_password: "a-brand-new-password" },
	});
	assert.equal(res.status, 200, res.text);
	assert.deepEqual(res.body, { status: "updated" });

	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: here })).status, 200);
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: elsewhere })).status, 401);
	assert.equal((await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: PASSWORD } })).status, 401);
	await cookieFor(call, "member@reflect.cloud", "a-brand-new-password");
});

test("change-password: the new password has the same limits, and needs a session", async (t) => {
	at(t, T0);
	const call = api(store());
	const cookie = await cookieFor(call, "member@reflect.cloud");
	const short = await call("POST", "/api/v1/auth/change-password", { cookie, json: { current_password: PASSWORD, new_password: "short" } });
	assert.equal(short.status, 400);
	assert.deepEqual(short.body, { error: "Password must be at least 8 characters." });

	const anonymous = await call("POST", "/api/v1/auth/change-password", { json: { current_password: PASSWORD, new_password: "a-brand-new-password" } });
	assert.equal(anonymous.status, 401);
});

test("change-password: five wrong guesses and the sixth is a 429", async (t) => {
	at(t, T0);
	const call = api(store());
	const cookie = await cookieFor(call, "member@reflect.cloud");
	const guess = (current_password: string) =>
		call("POST", "/api/v1/auth/change-password", { cookie, json: { current_password, new_password: "a-brand-new-password" } });
	for (let i = 0; i < 5; i++) assert.equal((await guess("not-the-password")).status, 400);

	const locked = await guess(PASSWORD);
	assert.equal(locked.status, 429);
	assert.deepEqual(locked.body, { error: "Too many attempts. Try again in 30 seconds.", retry_after_seconds: 30 });
	assert.equal(locked.headers.get("Retry-After"), "30");

	t.mock.timers.setTime(T0 + 30_000);
	assert.equal((await guess(PASSWORD)).status, 200);
});

// --------------------------------------------------------------------- admin

test("admin routes are for administrators only", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	const member = await cookieFor(call, "member@reflect.cloud");
	const routes: Array<[string, string, unknown?]> = [
		["GET", "/api/v1/auth/admin/users"],
		["POST", "/api/v1/auth/admin/register", { email: "x@reflect.cloud", password: PASSWORD }],
		["PUT", "/api/v1/auth/admin/users/admin-id", { disabled: true }],
		["DELETE", "/api/v1/auth/admin/users/admin-id"],
		["POST", "/api/v1/auth/admin/users/admin-id/revoke-sessions", {}],
		["POST", "/api/v1/auth/admin/grant-access", { userId: "member-id", mailboxId: "sales@reflect.cloud", role: "owner" }],
		["POST", "/api/v1/auth/admin/revoke-access", { userId: "admin-id", mailboxId: "sales@reflect.cloud" }],
	];
	for (const [method, path, json] of routes) {
		assert.equal((await call(method, path, { json })).status, 401, `${method} ${path} without a session`);
		const res = await call(method, path, { json, cookie: member });
		assert.equal(res.status, 403, `${method} ${path} as a member`);
		assert.deepEqual(res.body, { error: "Admin privileges required" });
	}
	assert.equal(s.rows("SELECT id FROM users").length, 2);
	assert.equal(s.rows("SELECT disabled FROM users WHERE id = 'admin-id'")[0].disabled, 0);
	assert.ok(await s.auth.validateSession(LEGACY_TOKEN), "the admin's session was not revoked");
});

test("admin: the user list carries disabled and each user's mailboxes", async (t) => {
	at(t, T0);
	const call = api(store());
	const admin = await cookieFor(call, "admin@reflect.cloud");
	const res = await call("GET", "/api/v1/auth/admin/users", { cookie: admin });
	assert.equal(res.status, 200);
	assert.deepEqual(
		res.body.map((u: Record<string, unknown>) => ({ ...u, createdAt: 0, updatedAt: 0 })),
		[
			{ id: "admin-id", email: "Admin@Reflect.cloud", isAdmin: true, disabled: false, createdAt: 0, updatedAt: 0, mailboxes: [] },
			{
				id: "member-id",
				email: "member@reflect.cloud",
				isAdmin: false,
				disabled: false,
				createdAt: 0,
				updatedAt: 0,
				mailboxes: [
					{ mailboxId: "Support@Reflect.cloud", role: "write" },
					{ mailboxId: "sales@reflect.cloud", role: "owner" },
				],
			},
		],
	);
	assert.ok(!res.text.includes("password"), "no hash in the list");
});

test("admin: creating a user, in the shape the screen already expects", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	const admin = await cookieFor(call, "admin@reflect.cloud");

	const res = await call("POST", "/api/v1/auth/admin/register", { cookie: admin, json: { email: "New@Reflect.cloud", password: PASSWORD } });
	assert.equal(res.status, 201, res.text);
	assert.deepEqual(res.body, { id: res.body.id, email: "new@reflect.cloud", isAdmin: false, createdAt: T0, updatedAt: T0 });

	const taken = await call("POST", "/api/v1/auth/admin/register", { cookie: admin, json: { email: "ADMIN@reflect.cloud", password: PASSWORD } });
	assert.equal(taken.status, 400);
	assert.deepEqual(taken.body, { error: "Email already registered" });

	const weak = await call("POST", "/api/v1/auth/admin/register", { cookie: admin, json: { email: "weak@reflect.cloud", password: "short" } });
	assert.deepEqual([weak.status, weak.body], [400, { error: "Password must be at least 8 characters." }]);
	await cookieFor(call, "new@reflect.cloud");
});

test("admin: PUT user disables, enables, promotes and sets a password for real", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	const admin = await cookieFor(call, "admin@reflect.cloud");
	const member = await cookieFor(call, "member@reflect.cloud");
	const put = (id: string, json: unknown) => call("PUT", `/api/v1/auth/admin/users/${id}`, { cookie: admin, json });

	assert.deepEqual([(await put("member-id", { disabled: true })).status, (await call("GET", "/api/v1/auth/me", { cookie: member })).status], [200, 401]);
	assert.equal((await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: PASSWORD } })).status, 403);

	const enabled = await put("member-id", { disabled: false, isAdmin: true });
	assert.deepEqual([enabled.status, enabled.body], [200, { status: "updated" }]);
	const promoted = await cookieFor(call, "member@reflect.cloud");
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: promoted })).body.isAdmin, true);

	assert.equal((await put("member-id", { password: "set-by-the-admin" })).status, 200);
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: promoted })).status, 401, "their sessions are ended");
	assert.equal((await call("POST", "/api/v1/auth/login", { json: { email: "member@reflect.cloud", password: PASSWORD } })).status, 401);
	await cookieFor(call, "member@reflect.cloud", "set-by-the-admin");
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: admin })).status, 200, "the admin is still signed in");
});

test("admin: PUT user refusals are plain sentences with the right status", async (t) => {
	at(t, T0);
	const call = api(store());
	const admin = await cookieFor(call, "admin@reflect.cloud");
	const put = (id: string, json: unknown) => call("PUT", `/api/v1/auth/admin/users/${id}`, { cookie: admin, json });

	const self = await put("admin-id", { isAdmin: false });
	assert.equal(self.status, 409);
	assert.match(self.body.error, /^You cannot change your own administrator or disabled status\./);
	assert.equal((await put("admin-id", { disabled: true })).status, 409);

	const missing = await put("no-such-id", { disabled: true });
	assert.deepEqual([missing.status, missing.body], [404, { error: "User not found" }]);

	const nothing = await put("member-id", {});
	assert.deepEqual([nothing.status, nothing.body], [400, { error: "Nothing to change" }]);

	const weak = await put("member-id", { password: "short" });
	assert.deepEqual([weak.status, weak.body], [400, { error: "Password must be at least 8 characters." }]);

	const wrongType = await put("member-id", { disabled: "yes" });
	assert.equal(wrongType.status, 400);
	assert.match(wrongType.body.error, /^disabled: /);

	// An admin resetting their own password stays signed in on the session they used.
	assert.equal((await put("admin-id", { password: "my-own-new-password" })).status, 200);
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: admin })).status, 200);
});

test("admin: deleting a user", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	const admin = await cookieFor(call, "admin@reflect.cloud");
	const member = await cookieFor(call, "member@reflect.cloud");
	const del = (id: string) => call("DELETE", `/api/v1/auth/admin/users/${id}`, { cookie: admin });

	const self = await del("admin-id");
	assert.equal(self.status, 409);
	assert.match(self.body.error, /^You cannot delete your own account\./);
	assert.deepEqual([(await del("no-such-id")).status, (await del("no-such-id")).body], [404, { error: "User not found" }]);

	const res = await del("member-id");
	assert.deepEqual([res.status, res.body], [200, { status: "deleted" }]);
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: member })).status, 401);
	assert.equal(s.rows("SELECT user_id FROM user_mailboxes WHERE user_id = 'member-id'").length, 0);
	assert.equal((await call("GET", "/api/v1/auth/admin/users", { cookie: admin })).body.length, 1);
});

test("admin: revoke-sessions signs the user out everywhere and reports the count", async (t) => {
	at(t, T0);
	const call = api(store());
	const admin = await cookieFor(call, "admin@reflect.cloud");
	const one = await cookieFor(call, "member@reflect.cloud");
	const two = await cookieFor(call, "member@reflect.cloud", PASSWORD, "198.51.100.9");

	const res = await call("POST", "/api/v1/auth/admin/users/member-id/revoke-sessions", { cookie: admin, json: {} });
	assert.deepEqual([res.status, res.body], [200, { status: "revoked", revoked: 2 }]);
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: one })).status, 401);
	assert.equal((await call("GET", "/api/v1/auth/me", { cookie: two })).status, 401);

	const missing = await call("POST", "/api/v1/auth/admin/users/no-such-id/revoke-sessions", { cookie: admin, json: {} });
	assert.deepEqual([missing.status, missing.body], [404, { error: "User not found" }]);
});

test("admin: granting twice changes the role; revoking removes it", async (t) => {
	at(t, T0);
	const s = store();
	const call = api(s);
	const admin = await cookieFor(call, "admin@reflect.cloud");
	const grant = (role: string, mailboxId = "Billing@Reflect.cloud") =>
		call("POST", "/api/v1/auth/admin/grant-access", { cookie: admin, json: { userId: "member-id", mailboxId, role } });

	assert.equal((await grant("read")).status, 200);
	const again = await grant("write", " billing@reflect.cloud ");
	assert.deepEqual([again.status, again.body], [200, { status: "access granted" }]);
	assert.deepEqual(
		s.rows("SELECT mailbox_id, role FROM user_mailboxes WHERE LOWER(mailbox_id) = 'billing@reflect.cloud'").map((r) => ({ ...r })),
		[{ mailbox_id: "billing@reflect.cloud", role: "write" }],
	);

	assert.equal((await grant("superuser")).status, 400);
	assert.equal((await grant("read", "   ")).status, 400);

	const revoked = await call("POST", "/api/v1/auth/admin/revoke-access", { cookie: admin, json: { userId: "member-id", mailboxId: "BILLING@reflect.cloud" } });
	assert.equal(revoked.status, 200);
	assert.equal(s.rows("SELECT role FROM user_mailboxes WHERE LOWER(mailbox_id) = 'billing@reflect.cloud'").length, 0);
	assert.equal(userId(s, "member@reflect.cloud"), "member-id");
});
