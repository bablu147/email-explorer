// End-to-end tests for Phase 1, accounts and access: salted password hashes and their length
// limits, the per-account backoff and the per-address limit on sign-in, the session cookie (and
// that the token is nowhere else), ending sessions, the cross-site checks on requests the cookie
// authenticated, sign-in taking JSON only, what each mailbox role may do, the user lifecycle an administrator runs,
// e-mail addresses that differ only in letter case, and the cookie's name over https.
// Against the real worker running locally.
//   npm run test:e2e
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
	type CallOptions,
	client,
	type Harness,
	httpsCall,
	PASSWORD,
	rawEmail,
	type Reply,
	sentFiles,
	sessionTokenFrom,
	startWorker,
	waitForNewMessages,
} from "./harness.ts";

const BOX = "team@phase1.test";
const ADMIN_EMAIL = "admin@phase1.test";
const NEW_PASSWORD = "a-second-good-password";
const enc = encodeURIComponent;

let h: Harness;
let api: ReturnType<typeof client>;
let admin = "";
let adminId = "";

const boxUrl = (path = "", box = BOX) => `/api/v1/mailboxes/${enc(box)}${path}`;
const userUrl = (userId: string, path = "") => `/api/v1/auth/admin/users/${userId}${path}`;
const me = (token: string) => api.get("/api/v1/auth/me", token);
const inTwoHours = () => new Date(Date.now() + 7_200_000).toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Creates an account as the administrator and returns its id. */
const createUser = async (email: string, password = PASSWORD) => {
	const res = await api.post("/api/v1/auth/admin/register", { email, password }, admin);
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body.id as string;
};
/** Signs in and returns the session token, which the harness reads from the Set-Cookie header. */
const signIn = async (email: string, password = PASSWORD) => {
	const res = await api.login(email, password);
	assert.equal(res.status, 200, JSON.stringify(res.body));
	assert.ok(res.body.id, "the login set a session cookie");
	return res.body.id as string;
};
const grant = async (userId: string, role: string, box = BOX) => {
	const res = await api.post("/api/v1/auth/admin/grant-access", { userId, mailboxId: box, role }, admin);
	assert.equal(res.status, 200, JSON.stringify(res.body));
};
const users = async () => {
	const res = await api.get("/api/v1/auth/admin/users", admin);
	assert.equal(res.status, 200, JSON.stringify(res.body));
	return res.body as Array<Record<string, any>>;
};
const userRow = async (userId: string) => (await users()).find((u) => u.id === userId);
const adminList = async (folder: string) => {
	const res = await api.get(boxUrl(`/emails?folder=${enc(folder)}&limit=100`), admin);
	assert.equal(res.status, 200, JSON.stringify(res.body));
	return res.body as Array<Record<string, any>>;
};
const inboxRow = async (subject: string) => {
	const row = (await adminList("inbox")).find((e) => e.subject === subject);
	assert.ok(row, `"${subject}" is in the inbox`);
	return row;
};
const receive = async (subject: string) => {
	const raw = rawEmail({ from: "Cust <cust@client.test>", to: BOX, subject });
	assert.equal(await api.deliver(raw, "cust@client.test", BOX), 200);
	return inboxRow(subject);
};
const folderNames = async () => ((await api.get(boxUrl("/folders"), admin)).body as Array<{ name: string }>).map((f) => f.name);
const mailboxSettings = async () => (await api.get(boxUrl(), admin)).body.settings as Record<string, any>;

before(async () => {
	// Its own port: a worker from the previous test file that is still shutting down cannot answer for this one.
	h = await startWorker(8813);
	api = client(h.base);
	const first = await api.post("/api/v1/auth/register", { email: ADMIN_EMAIL, password: PASSWORD });
	assert.equal(first.status, 201, JSON.stringify(first.body));
	assert.equal(first.body.isAdmin, true, "the first account is the administrator");
	const login = await api.login(ADMIN_EMAIL);
	admin = login.body.id;
	adminId = login.body.userId;
	assert.ok(admin, "admin login sets a session cookie");
	const box = await api.post("/api/v1/mailboxes", { email: BOX, name: BOX }, admin);
	assert.equal(box.status, 201, JSON.stringify(box.body));
});

after(async () => {
	await h?.stop();
});

describe("passwords", () => {
	test("a new account signs in with its password, and with no other", async () => {
		const id = await createUser("fresh@phase1.test");
		const ok = await api.login("fresh@phase1.test");
		assert.equal(ok.status, 200, JSON.stringify(ok.body));
		assert.equal(ok.body.userId, id);
		assert.equal(ok.body.email, "fresh@phase1.test");
		assert.equal(ok.body.isAdmin, false);
		assert.equal((await me(ok.body.id)).status, 200);

		for (const [email, password] of [
			["fresh@phase1.test", "not-the-password"],
			["nobody@phase1.test", PASSWORD],
		]) {
			const res = await api.login(email, password);
			assert.equal(res.status, 401, JSON.stringify(res.body));
			assert.deepEqual(res.body, { error: "Invalid credentials" }, "a wrong password and an unknown address answer alike");
			assert.equal(sessionTokenFrom(res.headers), "", "and no cookie is set");
		}
	});

	test("once there is an account, nobody can register themselves", async () => {
		const res = await api.post("/api/v1/auth/register", { email: "walk-in@phase1.test", password: PASSWORD });
		assert.equal(res.status, 403, JSON.stringify(res.body));
		assert.equal((await api.login("walk-in@phase1.test")).status, 401);
	});

	test("the login response has no token in it: the token is only in the cookie", async () => {
		const res = await api.call("POST", "/api/v1/auth/login", { json: { email: ADMIN_EMAIL, password: PASSWORD } });
		assert.equal(res.status, 200, JSON.stringify(res.body));
		assert.deepEqual(Object.keys(res.body).sort(), ["email", "expiresAt", "isAdmin", "userId"]);
		const token = sessionTokenFrom(res.headers);
		assert.ok(token, "the cookie carries one");
		assert.ok(!JSON.stringify(res.body).includes(token), "the body does not");

		const who = await me(token);
		assert.equal(who.status, 200);
		assert.deepEqual(Object.keys(who.body).sort(), ["email", "expiresAt", "isAdmin", "userId"], "nor does /auth/me");
		assert.ok(!JSON.stringify(who.body).includes(token));
	});

	test("a password under 8 or over 256 characters is refused wherever one is set", async () => {
		const tooShort = "seven77";
		const tooLong = "x".repeat(257);
		const SHORT = { error: "Password must be at least 8 characters." };
		const LONG = { error: "Password must be at most 256 characters." };
		const victimId = await createUser("limits@phase1.test");
		const victim = await signIn("limits@phase1.test");

		for (const [password, expected] of [
			[tooShort, SHORT],
			[tooLong, LONG],
		] as const) {
			const created = await api.post("/api/v1/auth/admin/register", { email: "never@phase1.test", password }, admin);
			assert.equal(created.status, 400, JSON.stringify(created.body));
			assert.deepEqual(created.body, expected);

			const self = await api.post("/api/v1/auth/register", { email: "never@phase1.test", password });
			assert.equal(self.status, 400, JSON.stringify(self.body));
			assert.deepEqual(self.body, expected);

			const changed = await api.post("/api/v1/auth/change-password", { current_password: PASSWORD, new_password: password }, victim);
			assert.equal(changed.status, 400, JSON.stringify(changed.body));
			assert.deepEqual(changed.body, expected);

			const reset = await api.put(userUrl(victimId), { password }, admin);
			assert.equal(reset.status, 400, JSON.stringify(reset.body));
			assert.deepEqual(reset.body, expected);
		}
		assert.ok(!(await users()).some((u) => u.email === "never@phase1.test"), "no account was created");
		assert.equal((await api.login("limits@phase1.test")).status, 200, "and the existing password still works");

		// The limits themselves are allowed.
		for (const [email, password] of [
			["eight@phase1.test", "x".repeat(8)],
			["longest@phase1.test", "y".repeat(256)],
		]) {
			await createUser(email, password);
			assert.equal((await api.login(email, password)).status, 200, `${password.length} characters`);
		}
	});
});

describe("sign-in backoff, per account and address", () => {
	const wrongTimes = async (email: string, ip: string, times: number) => {
		for (let i = 0; i < times; i++) {
			const res = await api.login(email, `wrong-password-${i}`, { ip });
			assert.equal(res.status, 401, `wrong attempt ${i + 1}: ${JSON.stringify(res.body)}`);
		}
	};
	const assertLocked = (res: Reply) => {
		assert.equal(res.status, 429, JSON.stringify(res.body));
		assert.match(res.body.error, /^Too many attempts\. Try again in \d+ (second|seconds|minute|minutes)\.$/);
		assert.ok(Number.isInteger(res.body.retry_after_seconds), "retry_after_seconds is a whole number");
		assert.ok(res.body.retry_after_seconds >= 1 && res.body.retry_after_seconds <= 30, `the first lock is 30 seconds, got ${res.body.retry_after_seconds}`);
		assert.equal(res.headers.get("retry-after"), String(res.body.retry_after_seconds));
		assert.equal(sessionTokenFrom(res.headers), "", "no cookie is set");
	};

	test("after five wrong passwords the sixth attempt is a 429, and so is the right password", async () => {
		const email = "locked@phase1.test";
		const ip = "203.0.113.10";
		await createUser(email);
		await wrongTimes(email, ip, 5);
		assertLocked(await api.login(email, "wrong-password-6", { ip }));
		assertLocked(await api.login(email, PASSWORD, { ip }));
		assertLocked(await api.login("LOCKED@phase1.test", PASSWORD, { ip }));
	});

	test("the lock is for one address: the same account still signs in from another", async () => {
		const email = "elsewhere@phase1.test";
		const ip = "203.0.113.11";
		await createUser(email);
		await wrongTimes(email, ip, 5);
		assertLocked(await api.login(email, PASSWORD, { ip }));

		const other = await api.login(email, PASSWORD, { ip: "203.0.113.12" });
		assert.equal(other.status, 200, JSON.stringify(other.body));
		assert.equal((await me(other.body.id)).status, 200);
		assertLocked(await api.login(email, PASSWORD, { ip }));
	});

	test("an address that was never registered is locked the same way, so the lock says nothing about who exists", async () => {
		const ip = "203.0.113.13";
		await wrongTimes("ghost@phase1.test", ip, 5);
		assertLocked(await api.login("ghost@phase1.test", PASSWORD, { ip }));
	});

	test("a successful sign-in resets the count", async () => {
		const email = "resets@phase1.test";
		const ip = "203.0.113.14";
		await createUser(email);
		await wrongTimes(email, ip, 4);
		assert.equal((await api.login(email, PASSWORD, { ip })).status, 200);
		// Without the reset, the first of these would be the fifth failure and the second a 429.
		await wrongTimes(email, ip, 4);
		assert.equal((await api.login(email, PASSWORD, { ip })).status, 200);
	});

	test("guesses from many addresses lock an account for strangers, but not for a browser that has signed in to it", async () => {
		const email = "known-browser@phase1.test";
		await createUser(email);
		const signIn = (ip: string, deviceCookie?: string) =>
			api.call("POST", "/api/v1/auth/login", {
				json: { email, password: PASSWORD },
				ip,
				headers: deviceCookie ? { Cookie: deviceCookie } : undefined,
			});
		const deviceCookieFrom = (res: Reply) =>
			(res.headers.getSetCookie().find((c) => /^(?:__Host-device|device)=/.test(c)) || "").split(";")[0];

		// The owner's browser signs in once and is marked as known for this account.
		const first = await signIn("203.0.113.40");
		assert.equal(first.status, 200, JSON.stringify(first.body));
		const device = deviceCookieFrom(first);
		assert.match(device, /^device=.+/, "the first sign-in sets the device cookie");
		const setCookie = first.headers.getSetCookie().find((c) => c.startsWith("device=")) as string;
		assert.match(setCookie, /; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=31536000$/);
		assert.ok(!JSON.stringify(first.body).includes(device.split("=")[1]), "it is not in the body");

		// Fifty wrong passwords, each from its own address: none of them is locked itself,
		// together they lock the account.
		for (let i = 0; i < 50; i++) {
			const res = await api.login(email, `guess-${i}`, { ip: `198.51.100.${i + 1}` });
			assert.equal(res.status, 401, `guess ${i + 1}: ${JSON.stringify(res.body)}`);
		}
		const stranger = await signIn("203.0.113.41");
		assert.equal(stranger.status, 429, "a browser that never signed in is refused, right password or not");
		assert.ok(stranger.body.retry_after_seconds > 60, "for the account-wide lock, not the 30-second one");
		assert.equal((await signIn("203.0.113.42", "device=not-a-device-this-account-knows")).status, 429);

		// The owner is not kept out of their own account, wherever they are now.
		const owner = await signIn("203.0.113.43", device);
		assert.equal(owner.status, 200, JSON.stringify(owner.body));
		assert.equal(deviceCookieFrom(owner), "", "a known browser is not issued a second mark");
		assert.equal((await me(sessionTokenFrom(owner.headers))).status, 200);
	});
});

describe("sign-in limit per client address", () => {
	test("the 21st credential request from one address inside a minute is a 429, whatever the account", async () => {
		// The local runtime does enforce the rate-limit binding (miniflare's ratelimit worker), in
		// one-minute windows aligned to the clock. Starting late in a window could split the
		// requests over two of them, so wait for the next one.
		const intoWindow = Date.now() % 60_000;
		if (intoWindow > 45_000) await sleep(60_000 - intoWindow + 100);

		const ip = "203.0.113.20";
		// A different unknown account each time, so the per-account backoff above never applies.
		for (let i = 0; i < 20; i++) {
			const res = await api.login(`flood-${i}@phase1.test`, PASSWORD, { ip });
			assert.equal(res.status, 401, `request ${i + 1}: ${JSON.stringify(res.body)}`);
		}
		const limited = await api.login(ADMIN_EMAIL, PASSWORD, { ip });
		assert.equal(limited.status, 429, JSON.stringify(limited.body));
		assert.deepEqual(limited.body, { error: "Too many attempts. Try again in a minute.", retry_after_seconds: 60 });
		assert.equal(limited.headers.get("retry-after"), "60");
		assert.equal(sessionTokenFrom(limited.headers), "", "the right password does not get through either");

		// One budget for all the credential endpoints.
		const register = await api.call("POST", "/api/v1/auth/register", { json: { email: "flood@phase1.test", password: PASSWORD }, ip });
		assert.equal(register.status, 429, JSON.stringify(register.body));
		const forgot = await api.call("POST", "/api/v1/auth/forgot-password", { json: { email: ADMIN_EMAIL }, ip });
		assert.equal(forgot.status, 429, JSON.stringify(forgot.body));
		const change = await api.call("POST", "/api/v1/auth/change-password", {
			json: { current_password: PASSWORD, new_password: NEW_PASSWORD },
			token: admin,
			ip,
		});
		assert.equal(change.status, 429, JSON.stringify(change.body));
		assert.equal((await api.login(ADMIN_EMAIL)).status, 200, "the password was not changed");

		// Only the credential endpoints, and only that address.
		assert.equal((await api.call("GET", "/api/v1/auth/me", { token: admin, ip })).status, 200);
		assert.equal((await api.login(ADMIN_EMAIL, PASSWORD, { ip: "203.0.113.21" })).status, 200);
	});
});

describe("sessions", () => {
	test("the session cookie is HttpOnly, Secure and SameSite=Strict, for the whole site, for 30 days", async () => {
		const res = await api.call("POST", "/api/v1/auth/login", { json: { email: ADMIN_EMAIL, password: PASSWORD } });
		assert.equal(res.status, 200, JSON.stringify(res.body));
		// The session cookie, and the device cookie that marks this browser as having signed in.
		const cookies = res.headers.getSetCookie().filter((c) => !c.startsWith("device="));
		assert.equal(cookies.length, 1, `exactly one session Set-Cookie on plain http: ${JSON.stringify(cookies)}`);
		// On https the name is "__Host-session"; a browser accepts that prefix only over https, and the worker runs on plain http here.
		const [nameValue, ...attributes] = cookies[0].split("; ");
		assert.match(nameValue, /^session=[^;\s]+$/);
		assert.deepEqual(attributes.slice(0, 4), ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"]);
		const maxAge = Number(/^Max-Age=(\d+)$/.exec(attributes[4] ?? "")?.[1]);
		assert.ok(maxAge > 30 * 86_400 - 60 && maxAge <= 30 * 86_400, `Max-Age is 30 days, got ${attributes[4]}`);
		assert.ok(!attributes.some((a) => /^domain=/i.test(a)), "no Domain: the cookie stays on this host");
		assert.ok(Math.abs(res.body.expiresAt - (Date.now() + 30 * 86_400_000)) < 60_000, "expiresAt says the same");
	});

	test("a request with only that cookie is signed in", async () => {
		const token = await signIn(ADMIN_EMAIL);
		const who = await api.call("GET", "/api/v1/auth/me", { cookie: token });
		assert.equal(who.status, 200, JSON.stringify(who.body));
		assert.equal(who.body.email, ADMIN_EMAIL);
		assert.equal((await api.call("GET", "/api/v1/mailboxes", { cookie: token })).status, 200);
		const write = await api.call("POST", boxUrl("/contacts"), { cookie: token, json: { name: "By Cookie", email: "by-cookie@client.test" } });
		assert.equal(write.status, 201, JSON.stringify(write.body));
		// The dashboard's DELETE requests, and some of its POSTs, have no body and so no Content-Type.
		const bodyless = await api.call("POST", boxUrl("/queue/run-due"), { cookie: token });
		assert.equal(bodyless.status, 200, JSON.stringify(bodyless.body));
		const removed = await api.call("DELETE", boxUrl(`/contacts/${write.body.id}`), { cookie: token });
		assert.ok(removed.status === 200 || removed.status === 204, `got ${removed.status}`);

		assert.equal((await api.call("GET", "/api/v1/auth/me", { cookie: "not-a-session" })).status, 401);
		assert.equal((await api.call("GET", "/api/v1/auth/me", { headers: { Cookie: `xsession=${token}` } })).status, 401, "a cookie whose name only ends in `session` is not it");
	});

	test("`Authorization: Bearer undefined` next to a valid cookie is accepted (a tab from the previous build)", async () => {
		const token = await signIn(ADMIN_EMAIL);
		const stale = { Authorization: "Bearer undefined" };
		const who = await api.call("GET", "/api/v1/auth/me", { cookie: token, headers: stale });
		assert.equal(who.status, 200, JSON.stringify(who.body));
		assert.equal(who.body.email, ADMIN_EMAIL);
		assert.equal((await api.call("GET", "/api/v1/auth/me", { headers: stale })).status, 401, "on its own it is nothing");

		// It is the cookie that signed this request in, so the cross-site rule applies to it.
		const crossSite = await api.call("POST", boxUrl("/folders"), {
			cookie: token,
			headers: { ...stale, "Sec-Fetch-Site": "cross-site" },
			json: { name: "Stale Tab Folder" },
		});
		assert.equal(crossSite.status, 403, JSON.stringify(crossSite.body));
		assert.ok(!(await folderNames()).includes("Stale Tab Folder"));
	});

	test("logout ends the session and clears the cookie", async () => {
		const token = await signIn(ADMIN_EMAIL);
		const other = await signIn(ADMIN_EMAIL);
		const out = await api.call("POST", "/api/v1/auth/logout", { cookie: token, json: {} });
		assert.equal(out.status, 200, JSON.stringify(out.body));
		assert.deepEqual(out.body, { status: "logged out" });
		assert.deepEqual(out.headers.getSetCookie(), ["session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"]);
		assert.equal((await api.call("GET", "/api/v1/auth/me", { cookie: token })).status, 401);
		assert.equal((await me(token)).status, 401, "as a Bearer token too");
		assert.equal((await me(other)).status, 200, "another session of the same user goes on");
		assert.equal((await me(admin)).status, 200);
	});

	test("changing your password ends your other sessions, not the one you are using", async () => {
		const email = "changer@phase1.test";
		await createUser(email);
		const here = await signIn(email);
		const there = await signIn(email);
		const alsoThere = await signIn(email);

		const res = await api.post("/api/v1/auth/change-password", { current_password: PASSWORD, new_password: NEW_PASSWORD }, here);
		assert.equal(res.status, 200, JSON.stringify(res.body));
		assert.deepEqual(res.body, { status: "updated" });
		assert.equal((await me(here)).status, 200, "this session goes on");
		assert.equal((await me(there)).status, 401, "the others are ended");
		assert.equal((await me(alsoThere)).status, 401);
		assert.equal((await api.login(email, PASSWORD)).status, 401, "the old password is gone");
		assert.equal((await api.login(email, NEW_PASSWORD)).status, 200);
	});

	test("an administrator can sign a user out everywhere", async () => {
		const email = "everywhere@phase1.test";
		const id = await createUser(email);
		const sessions = [await signIn(email), await signIn(email), await signIn(email)];
		const bystander = await signIn(ADMIN_EMAIL);

		assert.equal((await api.post(userUrl(id, "/revoke-sessions"), {}, sessions[0])).status, 403, "not something a user can call");
		const res = await api.post(userUrl(id, "/revoke-sessions"), {}, admin);
		assert.equal(res.status, 200, JSON.stringify(res.body));
		assert.deepEqual(res.body, { status: "revoked", revoked: 3 });
		for (const token of sessions) assert.equal((await me(token)).status, 401);
		assert.equal((await me(bystander)).status, 200, "nobody else is signed out");
		assert.equal((await api.login(email)).status, 200, "and the user can sign in again");

		const unknown = await api.post(userUrl("no-such-user", "/revoke-sessions"), {}, admin);
		assert.equal(unknown.status, 404, JSON.stringify(unknown.body));
	});
});

describe("requests signed in by the cookie must come from this site", () => {
	const REFUSED = { error: "Cross-site request refused" };
	let cookie = "";
	const createFolder = (name: string, opts: CallOptions) =>
		api.call("POST", boxUrl("/folders"), { json: { name }, ...opts });

	before(async () => {
		cookie = await signIn(ADMIN_EMAIL);
	});

	test("`Sec-Fetch-Site: cross-site` is refused, and so is a sibling subdomain (`same-site`)", async () => {
		for (const site of ["cross-site", "same-site"]) {
			const res = await createFolder(`From ${site}`, { cookie, headers: { "Sec-Fetch-Site": site } });
			assert.equal(res.status, 403, `${site}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body, REFUSED);
			assert.ok(!(await folderNames()).includes(`From ${site}`), "nothing was created");
		}
		const out = await api.call("POST", "/api/v1/auth/logout", { cookie, json: {}, headers: { "Sec-Fetch-Site": "cross-site" } });
		assert.equal(out.status, 403, "another site cannot sign the user out");
		assert.equal((await api.call("GET", "/api/v1/auth/me", { cookie })).status, 200);

		// Reads are not refused: following a link from another site must still open the app.
		const read = await api.call("GET", boxUrl("/folders"), { cookie, headers: { "Sec-Fetch-Site": "cross-site" } });
		assert.equal(read.status, 200);
	});

	test("without Sec-Fetch-Site, an Origin of another host is refused", async () => {
		for (const origin of ["https://evil.example", "https://blog.reflect.cloud", "null"]) {
			const res = await createFolder(`From ${origin}`, { cookie, headers: { Origin: origin } });
			assert.equal(res.status, 403, `${origin}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body, REFUSED);
			assert.ok(!(await folderNames()).includes(`From ${origin}`), "nothing was created");
		}
	});

	test("`Sec-Fetch-Site: same-origin` is let through, as is an Origin of this host", async () => {
		const sameOrigin = await createFolder("From Same Origin", { cookie, headers: { "Sec-Fetch-Site": "same-origin", Origin: h.base } });
		assert.equal(sameOrigin.status, 201, JSON.stringify(sameOrigin.body));
		const ownHost = await createFolder("From Own Host", { cookie, headers: { Origin: h.base } });
		assert.equal(ownHost.status, 201, JSON.stringify(ownHost.body));
		const names = await folderNames();
		assert.ok(names.includes("From Same Origin") && names.includes("From Own Host"));
	});

	test("a Bearer token with a foreign Origin is let through: no other site can add that header", async () => {
		const res = await createFolder("From A Script", { token: cookie, headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" } });
		assert.equal(res.status, 201, JSON.stringify(res.body));
		assert.ok((await folderNames()).includes("From A Script"));
	});

	test("a body that is not declared as JSON is refused for the cookie, which is what a cross-site form can send", async () => {
		const body = JSON.stringify({ name: "From A Form" });
		for (const contentType of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
			const res = await api.call("POST", boxUrl("/folders"), { cookie, raw: body, contentType });
			assert.equal(res.status, 415, `${contentType}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body, { error: "Content-Type must be application/json" });
		}
		assert.ok(!(await folderNames()).includes("From A Form"));
	});

	test("the public unsubscribe POST is not affected", async () => {
		const before = new Set(sentFiles());
		const sent = await api.post(boxUrl("/emails"), { to: "prospect@startup.test", subject: "Intro", text: "Hi" }, admin);
		assert.equal(sent.status, 201, JSON.stringify(sent.body));
		const [mime] = await waitForNewMessages(before, 1);
		const url = mime.match(/List-Unsubscribe: <https:\/\/mail\.reflect\.cloud(\/api\/v1\/unsubscribe\/[^>]+)>/)?.[1];
		assert.ok(url, "List-Unsubscribe header present");

		// What a mail provider's one-click request, or the confirmation page in a browser that is
		// also signed in here, looks like: a form body, from somewhere else, cookie attached.
		const res = await api.call("POST", url, {
			raw: "List-Unsubscribe=One-Click",
			contentType: "application/x-www-form-urlencoded",
			cookie,
			headers: { Origin: "https://mail.provider.example", "Sec-Fetch-Site": "cross-site" },
		});
		assert.equal(res.status, 200, String(res.body).slice(0, 200));
		const check = await api.post("/api/v1/suppressions/check", { emails: ["prospect@startup.test"] }, admin);
		assert.equal(check.body.suppressed.length, 1, "the address was unsubscribed");
	});
});

describe("sign-in cannot be posted by a form on another site", () => {
	// Sign-in is public, so the cookie rules above never see it. A form with enctype text/plain can
	// carry a body that parses as JSON; accepted, it would sign the visitor's browser into an account
	// the other site chose.
	const formBody = (email: string) => `{"email":"${email}","password":"${PASSWORD}","x":"="}`;
	const NOT_JSON = { error: "Content-Type must be application/json" };

	test("a login whose body is not declared as JSON is a 415 and sets no cookie", async () => {
		for (const contentType of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
			const res = await api.call("POST", "/api/v1/auth/login", {
				raw: formBody(ADMIN_EMAIL),
				contentType,
				headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
			});
			assert.equal(res.status, 415, `${contentType}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body, NOT_JSON);
			assert.deepEqual(res.headers.getSetCookie(), [], "no cookie");
		}
		// The same body, declared as JSON, is an ordinary sign-in.
		const ok = await api.call("POST", "/api/v1/auth/login", { raw: formBody(ADMIN_EMAIL), contentType: "application/json" });
		assert.equal(ok.status, 200, JSON.stringify(ok.body));
	});

	test("the other credential endpoints take JSON only too", async () => {
		for (const path of ["/api/v1/auth/register", "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password"]) {
			const res = await api.call("POST", path, { raw: formBody("form@phase1.test"), contentType: "text/plain" });
			assert.equal(res.status, 415, `${path}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body, NOT_JSON);
		}
		const change = await api.call("POST", "/api/v1/auth/change-password", {
			raw: JSON.stringify({ current_password: PASSWORD, new_password: NEW_PASSWORD }),
			contentType: "text/plain",
			token: admin,
		});
		assert.equal(change.status, 415, JSON.stringify(change.body));
		assert.equal((await api.login(ADMIN_EMAIL)).status, 200, "the password was not changed");
	});

	test("such requests do not use up the visitor's sign-in attempts", async () => {
		const ip = "203.0.113.30";
		for (let i = 0; i < 25; i++) {
			const res = await api.call("POST", "/api/v1/auth/login", { raw: formBody(ADMIN_EMAIL), contentType: "text/plain", ip });
			assert.equal(res.status, 415, `request ${i + 1}: ${JSON.stringify(res.body)}`);
		}
		assert.equal((await api.login(ADMIN_EMAIL, PASSWORD, { ip })).status, 200);
	});
});

describe("mailbox roles", () => {
	const EMAIL = "roles@phase1.test";
	const VIEW_ONLY = { error: "Your access to this mailbox is view-only.", code: "view_only" };
	const NEEDS_ADMIN = { error: "Only a mailbox admin can change mailbox settings.", code: "mailbox_admin_required" };
	let memberId = "";
	let member = "";
	let keep: Record<string, any>;
	let toMove: Record<string, any>;
	let toDelete: Record<string, any>;

	const roleInList = async () =>
		((await api.get("/api/v1/mailboxes", member)).body as Array<{ id: string; role: string }>).find((m) => m.id === BOX)?.role;
	const saveSettings = async (fromName: string, token = member) =>
		api.put(boxUrl(), { settings: { ...(await mailboxSettings()), fromName } }, token);

	/** Every kind of change a mailbox takes, as the member. `tag` keeps the names of one run apart from another's. */
	const changes = (tag: string): Array<[string, () => Promise<Reply>]> => [
		["send", () => api.post(boxUrl("/emails"), { to: "dest@client.test", subject: `Role ${tag}: send`, text: "x" }, member)],
		["save a draft", () => api.post(boxUrl("/emails"), { to: "dest@client.test", subject: `Role ${tag}: draft`, text: "x", is_draft: true }, member)],
		["reply", () => api.post(boxUrl(`/emails/${keep.id}/reply`), { to: "cust@client.test", subject: `Re: Role ${tag}`, text: "x" }, member)],
		["forward", () => api.post(boxUrl(`/emails/${keep.id}/forward`), { to: "colleague@client.test", subject: `Fwd: Role ${tag}`, text: "x" }, member)],
		["flag", () => api.put(boxUrl(`/emails/${keep.id}`), { starred: true }, member)],
		["mark read", () => api.put(boxUrl(`/emails/${keep.id}`), { read: true }, member)],
		["snooze", () => api.post(boxUrl(`/emails/${keep.id}/snooze`), { until: inTwoHours() }, member)],
		["unsnooze", () => api.post(boxUrl(`/emails/${keep.id}/snooze`), { until: null }, member)],
		["move", () => api.post(boxUrl(`/emails/${toMove.id}/move`), { folderId: "archive" }, member)],
		["delete", () => api.del(boxUrl(`/emails/${toDelete.id}`), member)],
		["create a folder", () => api.post(boxUrl("/folders"), { name: `Role ${tag}` }, member)],
		["create a contact", () => api.post(boxUrl("/contacts"), { name: `Role ${tag}`, email: `role-${tag}@client.test` }, member)],
		["run the queue", () => api.post(boxUrl("/queue/run-due"), {}, member)],
	];

	before(async () => {
		memberId = await createUser(EMAIL);
		member = await signIn(EMAIL);
		keep = await receive("Role: keep");
		toMove = await receive("Role: move");
		toDelete = await receive("Role: delete");
	});

	test("with no grant the mailbox is closed and not listed", async () => {
		const res = await api.get(boxUrl("/emails"), member);
		assert.equal(res.status, 403, JSON.stringify(res.body));
		assert.deepEqual(res.body, { error: "You don't have access to this mailbox" });
		assert.equal(await roleInList(), undefined);
	});

	test("read: every GET works, and every change is a 403 `view_only` that changes nothing", async () => {
		await grant(memberId, "read");
		assert.equal(await roleInList(), "read", "GET /mailboxes shows the role");
		for (const path of ["", "/emails?folder=inbox", `/emails/${keep.id}`, "/folders", "/contacts", `/search?query=${enc("Role")}`, "/queue-summary"]) {
			assert.equal((await api.get(boxUrl(path), member)).status, 200, `GET ${path || "the mailbox"}`);
		}

		const before = new Set(sentFiles());
		const settingsBefore = await mailboxSettings();
		for (const [what, request] of changes("read")) {
			const res = await request();
			assert.equal(res.status, 403, `${what}: ${res.status} ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body, VIEW_ONLY, what);
		}
		const settings = await saveSettings("Renamed by a reader");
		assert.equal(settings.status, 403, JSON.stringify(settings.body));
		assert.deepEqual(settings.body, VIEW_ONLY);

		await sleep(300);
		assert.equal(sentFiles().filter((f) => !before.has(f)).length, 0, "no email left the building");
		const inbox = await adminList("inbox");
		for (const row of [keep, toMove, toDelete]) {
			const now = inbox.find((e) => e.id === row.id);
			assert.ok(now, `"${row.subject}" is still in the inbox`);
			assert.equal(Boolean(now.read), false, "still unread");
			assert.equal(Boolean(now.starred), false, "still unflagged");
		}
		for (const folder of ["sent", "drafts", "snoozed"]) {
			assert.ok(!(await adminList(folder)).some((e) => String(e.subject).includes("Role read")), `nothing stored in ${folder}`);
		}
		assert.ok(!(await folderNames()).includes("Role read"));
		const contacts = (await api.get(boxUrl("/contacts"), admin)).body as Array<{ email: string }>;
		assert.ok(!contacts.some((c) => c.email === "role-read@client.test"));
		assert.deepEqual(await mailboxSettings(), settingsBefore);
	});

	test("write: granting again changes the role, and every change works except mailbox settings", async () => {
		await grant(memberId, "write");
		assert.equal(await roleInList(), "write");
		assert.deepEqual((await userRow(memberId))?.mailboxes, [{ mailboxId: BOX, role: "write" }], "one grant, with the new role");

		const before = new Set(sentFiles());
		for (const [what, request] of changes("write")) {
			const res = await request();
			assert.ok(res.status >= 200 && res.status < 300, `${what}: ${res.status} ${JSON.stringify(res.body)}`);
		}
		assert.equal((await waitForNewMessages(before, 3)).length, 3, "the send, the reply and the forward went out");
		const now = (await api.get(boxUrl(`/emails/${keep.id}`), admin)).body;
		assert.equal(Boolean(now.starred), true);
		assert.equal(Boolean(now.read), true);
		assert.ok((await adminList("archive")).some((e) => e.id === toMove.id), "moved");
		assert.ok(!(await adminList("inbox")).some((e) => e.id === toDelete.id), "deleted from the inbox");
		assert.ok((await folderNames()).includes("Role write"));

		const settingsBefore = await mailboxSettings();
		const settings = await saveSettings("Renamed by a writer");
		assert.equal(settings.status, 403, JSON.stringify(settings.body));
		assert.deepEqual(settings.body, NEEDS_ADMIN);
		assert.deepEqual(await mailboxSettings(), settingsBefore);
	});

	test("admin and owner: mailbox settings work too", async () => {
		for (const role of ["admin", "owner"]) {
			await grant(memberId, role);
			assert.equal(await roleInList(), role);
			const res = await saveSettings(`Renamed by the ${role}`);
			assert.equal(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
			assert.equal((await mailboxSettings()).fromName, `Renamed by the ${role}`);
			assert.equal((await api.post(boxUrl("/contacts"), { name: role, email: `${role}@client.test` }, member)).status, 201);
		}
		assert.deepEqual((await userRow(memberId))?.mailboxes, [{ mailboxId: BOX, role: "owner" }]);
		// Still not a global admin: the mailbox itself is theirs to run, not to delete.
		assert.equal((await api.del(boxUrl(), member)).status, 403);
		assert.equal((await api.get(boxUrl(), admin)).status, 200);
	});

	test("an unknown role is not accepted", async () => {
		const res = await api.post("/api/v1/auth/admin/grant-access", { userId: memberId, mailboxId: BOX, role: "superuser" }, admin);
		assert.equal(res.status, 400, JSON.stringify(res.body));
		assert.equal(await roleInList(), "owner", "the grant is unchanged");
	});

	test("a global admin is listed as owner of every mailbox", async () => {
		const mailboxes = (await api.get("/api/v1/mailboxes", admin)).body as Array<{ id: string; role: string }>;
		assert.ok(mailboxes.length >= 1);
		for (const mailbox of mailboxes) assert.equal(mailbox.role, "owner", mailbox.id);
	});

	test("revoking closes the mailbox again", async () => {
		const res = await api.post("/api/v1/auth/admin/revoke-access", { userId: memberId, mailboxId: BOX }, admin);
		assert.equal(res.status, 200, JSON.stringify(res.body));
		assert.equal((await api.get(boxUrl("/emails"), member)).status, 403);
		assert.equal((await api.post(boxUrl("/contacts"), { name: "x", email: "x@client.test" }, member)).status, 403);
		assert.equal(await roleInList(), undefined);
		assert.deepEqual((await userRow(memberId))?.mailboxes, []);
	});
});

describe("user lifecycle", () => {
	test("changing your own password needs the current one", async () => {
		const email = "self@phase1.test";
		await createUser(email);
		const token = await signIn(email);

		const wrong = await api.post("/api/v1/auth/change-password", { current_password: "not-the-password", new_password: NEW_PASSWORD }, token);
		assert.equal(wrong.status, 400, JSON.stringify(wrong.body));
		assert.deepEqual(wrong.body, { error: "Current password is incorrect" });
		const missing = await api.post("/api/v1/auth/change-password", { new_password: NEW_PASSWORD }, token);
		assert.equal(missing.status, 400, JSON.stringify(missing.body));
		assert.equal((await me(token)).status, 200, "a wrong current password does not sign the user out");
		assert.equal((await api.login(email, NEW_PASSWORD)).status, 401, "and nothing was changed");

		const anonymous = await api.post("/api/v1/auth/change-password", { current_password: PASSWORD, new_password: NEW_PASSWORD });
		assert.equal(anonymous.status, 401);

		const ok = await api.post("/api/v1/auth/change-password", { current_password: PASSWORD, new_password: NEW_PASSWORD }, token);
		assert.equal(ok.status, 200, JSON.stringify(ok.body));
		assert.equal((await api.login(email, NEW_PASSWORD)).status, 200);
		assert.equal((await api.login(email, PASSWORD)).status, 401);
	});

	test("guessing the current password is slowed down like sign-in: the sixth attempt is a 429", async () => {
		const email = "guesser@phase1.test";
		await createUser(email);
		const token = await signIn(email);
		const attempt = (current: string) =>
			api.post("/api/v1/auth/change-password", { current_password: current, new_password: NEW_PASSWORD }, token);
		for (let i = 0; i < 5; i++) {
			assert.equal((await attempt(`wrong-password-${i}`)).status, 400, `wrong attempt ${i + 1}`);
		}
		for (const current of ["wrong-password-6", PASSWORD]) {
			const res = await attempt(current);
			assert.equal(res.status, 429, JSON.stringify(res.body));
			assert.match(res.body.error, /^Too many attempts\. Try again in \d+ (second|seconds|minute|minutes)\.$/);
			assert.equal(res.headers.get("retry-after"), String(res.body.retry_after_seconds));
		}
		assert.equal((await me(token)).status, 200, "the session is not ended by it");
		assert.equal((await api.login(email, PASSWORD)).status, 200, "and the password is unchanged");
	});

	test("an administrator sets a user's password: the old one stops working and the user is signed out", async () => {
		const email = "reset@phase1.test";
		const id = await createUser(email);
		const sessions = [await signIn(email), await signIn(email)];

		const res = await api.put(userUrl(id), { password: NEW_PASSWORD }, admin);
		assert.equal(res.status, 200, JSON.stringify(res.body));
		assert.deepEqual(res.body, { status: "updated" });
		for (const token of sessions) assert.equal((await me(token)).status, 401);
		assert.equal((await api.login(email, PASSWORD)).status, 401);
		assert.equal((await api.login(email, NEW_PASSWORD)).status, 200);
		assert.equal((await me(admin)).status, 200, "the administrator is still signed in");
	});

	test("a disabled user cannot sign in and is signed out; enabling restores the account", async () => {
		const email = "disabled@phase1.test";
		const id = await createUser(email);
		await grant(id, "write");
		const token = await signIn(email);
		assert.equal((await api.get(boxUrl("/emails"), token)).status, 200);

		const off = await api.put(userUrl(id), { disabled: true }, admin);
		assert.equal(off.status, 200, JSON.stringify(off.body));
		assert.equal((await me(token)).status, 401, "the open session is ended");
		assert.equal((await api.get(boxUrl("/emails"), token)).status, 401);
		const login = await api.login(email);
		assert.equal(login.status, 403, JSON.stringify(login.body));
		assert.deepEqual(login.body, { error: "This account is disabled. Contact an administrator." });
		assert.equal(sessionTokenFrom(login.headers), "");
		const guess = await api.login(email, "not-the-password");
		assert.equal(guess.status, 401, "only the right password is told the account is disabled");
		assert.deepEqual(guess.body, { error: "Invalid credentials" });
		assert.equal((await userRow(id))?.disabled, true);

		const on = await api.put(userUrl(id), { disabled: false }, admin);
		assert.equal(on.status, 200, JSON.stringify(on.body));
		assert.equal((await userRow(id))?.disabled, false);
		assert.equal((await me(token)).status, 401, "the old session stays ended");
		const again = await signIn(email);
		assert.equal((await api.get(boxUrl("/emails"), again)).status, 200, "the mailbox access was kept");
	});

	test("a user can be made an administrator and back", async () => {
		const email = "promoted@phase1.test";
		const id = await createUser(email);
		const token = await signIn(email);
		const adminOnly = () => api.get("/api/v1/auth/admin/users", token);
		assert.equal((await adminOnly()).status, 403);

		assert.equal((await api.put(userUrl(id), { isAdmin: true }, admin)).status, 200);
		assert.equal((await adminOnly()).status, 200, "at once, in the session they already have");
		assert.equal((await me(token)).body.isAdmin, true);
		assert.equal((await userRow(id))?.isAdmin, true);
		assert.equal((await api.get(boxUrl("/emails"), token)).status, 200, "every mailbox is open to an admin");

		assert.equal((await api.put(userUrl(id), { isAdmin: false }, admin)).status, 200);
		assert.equal((await adminOnly()).status, 403);
		assert.equal((await me(token)).body.isAdmin, false);
		assert.equal((await api.get(boxUrl("/emails"), token)).status, 403);
	});

	test("the last active administrator cannot be demoted, disabled or deleted, least of all by themselves", async () => {
		const active = (await users()).filter((u) => u.isAdmin && !u.disabled);
		assert.deepEqual(active.map((u) => u.id), [adminId], "there is one active administrator");

		for (const change of [{ isAdmin: false }, { disabled: true }, { isAdmin: false, disabled: true }]) {
			const res = await api.put(userUrl(adminId), change, admin);
			assert.equal(res.status, 409, `${JSON.stringify(change)}: ${JSON.stringify(res.body)}`);
			assert.equal(typeof res.body.error, "string");
		}
		const del = await api.del(userUrl(adminId), admin);
		assert.equal(del.status, 409, JSON.stringify(del.body));

		const row = await userRow(adminId);
		assert.equal(row?.isAdmin, true);
		assert.equal(row?.disabled, false);
		assert.equal((await me(admin)).status, 200);
		assert.equal((await api.login(ADMIN_EMAIL)).status, 200);
	});

	test("an administrator cannot change their own flags or delete themselves, even with another admin around", async () => {
		const email = "second-admin@phase1.test";
		const id = await createUser(email);
		assert.equal((await api.put(userUrl(id), { isAdmin: true }, admin)).status, 200);
		const second = await signIn(email);

		for (const change of [{ isAdmin: false }, { disabled: true }]) {
			const res = await api.put(userUrl(id), change, second);
			assert.equal(res.status, 409, `${JSON.stringify(change)}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body, { error: "You cannot change your own administrator or disabled status. Ask another administrator." });
		}
		const del = await api.del(userUrl(id), second);
		assert.equal(del.status, 409, JSON.stringify(del.body));
		assert.deepEqual(del.body, { error: "You cannot delete your own account. Ask another administrator." });
		assert.equal((await me(second)).body.isAdmin, true);

		// Their own password is theirs to set, and it keeps the session they did it in.
		const other = await signIn(email);
		assert.equal((await api.put(userUrl(id), { password: NEW_PASSWORD }, second)).status, 200);
		assert.equal((await me(second)).status, 200);
		assert.equal((await me(other)).status, 401);

		// Another administrator can do all of it.
		assert.equal((await api.put(userUrl(id), { isAdmin: false }, admin)).status, 200);
		assert.equal((await api.get("/api/v1/auth/admin/users", second)).status, 403);
		assert.equal((await api.del(userUrl(id), admin)).status, 200);
	});

	test("a request that changes nothing, or names nobody, says so", async () => {
		const id = await createUser("untouched@phase1.test");
		const empty = await api.put(userUrl(id), {}, admin);
		assert.equal(empty.status, 400, JSON.stringify(empty.body));
		assert.equal(typeof empty.body.error, "string");
		for (const res of [await api.put(userUrl("no-such-user"), { disabled: true }, admin), await api.del(userUrl("no-such-user"), admin)]) {
			assert.equal(res.status, 404, JSON.stringify(res.body));
			assert.deepEqual(res.body, { error: "User not found" });
		}
		const member = await signIn("untouched@phase1.test");
		assert.equal((await api.put(userUrl(id), { isAdmin: true }, member)).status, 403, "a user cannot promote themselves");
		assert.equal((await api.del(userUrl(adminId), member)).status, 403);
		assert.equal((await userRow(id))?.isAdmin, false);
	});

	test("deleting a user removes the account, its sessions and its mailbox access", async () => {
		const email = "leaver@phase1.test";
		const id = await createUser(email);
		await grant(id, "write");
		const token = await signIn(email);
		assert.equal((await api.get(boxUrl("/emails"), token)).status, 200);

		const res = await api.del(userUrl(id), admin);
		assert.equal(res.status, 200, JSON.stringify(res.body));
		assert.deepEqual(res.body, { status: "deleted" });
		assert.equal((await me(token)).status, 401, "the session is ended");
		assert.equal((await api.get(boxUrl("/emails"), token)).status, 401);
		assert.equal((await api.login(email)).status, 401, "the account is gone");
		assert.equal(await userRow(id), undefined);
		assert.equal((await api.del(userUrl(id), admin)).status, 404, "deleting twice is a 404");

		// The address is free again, and the new account inherits nothing.
		const newId = await createUser(email);
		assert.notEqual(newId, id);
		assert.deepEqual((await userRow(newId))?.mailboxes, []);
		const fresh = await signIn(email);
		assert.equal((await api.get(boxUrl("/emails"), fresh)).status, 403);
	});

	test("the user list shows who is disabled and which mailboxes each user has", async () => {
		const email = "listed@phase1.test";
		const id = await createUser(email);
		await grant(id, "read");
		assert.equal((await api.put(userUrl(id), { disabled: true }, admin)).status, 200);

		const list = await users();
		const row = list.find((u) => u.id === id);
		assert.ok(row);
		assert.deepEqual(Object.keys(row).sort(), ["createdAt", "disabled", "email", "id", "isAdmin", "mailboxes", "updatedAt"]);
		assert.equal(row.email, email);
		assert.equal(row.isAdmin, false);
		assert.equal(row.disabled, true);
		assert.deepEqual(row.mailboxes, [{ mailboxId: BOX, role: "read" }]);

		const adminRow = list.find((u) => u.id === adminId);
		assert.equal(adminRow?.disabled, false);
		assert.equal(adminRow?.isAdmin, true);
		assert.deepEqual(adminRow?.mailboxes, [], "an admin needs no grants");
		assert.ok(!JSON.stringify(list).includes("pbkdf2"), "no password hash in the list");

		const member = await signIn("untouched@phase1.test");
		assert.equal((await api.get("/api/v1/auth/admin/users", member)).status, 403);
	});
});

describe("e-mail addresses ignore letter case", () => {
	test("a user registered as Mixed@Case.test signs in as mixed@case.test", async () => {
		const created = await api.post("/api/v1/auth/admin/register", { email: "Mixed@Case.test", password: PASSWORD }, admin);
		assert.equal(created.status, 201, JSON.stringify(created.body));
		for (const typed of ["mixed@case.test", "Mixed@Case.test", "MIXED@CASE.TEST", "  mixed@case.test  "]) {
			const res = await api.login(typed);
			assert.equal(res.status, 200, `${typed}: ${JSON.stringify(res.body)}`);
			assert.equal(res.body.userId, created.body.id, "the same account");
		}
	});

	test("the same address in another letter case cannot be registered again", async () => {
		for (const typed of ["mixed@case.test", "MIXED@case.TEST"]) {
			const res = await api.post("/api/v1/auth/admin/register", { email: typed, password: PASSWORD }, admin);
			assert.equal(res.status, 400, `${typed}: ${JSON.stringify(res.body)}`);
			assert.deepEqual(res.body, { error: "Email already registered" });
		}
		assert.equal((await users()).filter((u) => String(u.email).toLowerCase() === "mixed@case.test").length, 1);
	});
});

describe("over https, as in production", () => {
	const EMAIL = "admin@https.test";
	const CLEARED = "HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
	let s: Harness;
	const login = async () => {
		const res = await httpsCall(s.base, "POST", "/api/v1/auth/login", { json: { email: EMAIL, password: PASSWORD } });
		assert.equal(res.status, 200, JSON.stringify(res.body));
		const token = /^__Host-session=([^;]+)/.exec(res.setCookie.find((c) => !c.includes("Max-Age=0")) ?? "")?.[1] ?? "";
		assert.ok(token, `a __Host-session cookie was set: ${JSON.stringify(res.setCookie)}`);
		return { res, token };
	};
	const me = (cookie: string) => httpsCall(s.base, "GET", "/api/v1/auth/me", { headers: { Cookie: cookie } });

	before(async () => {
		// A second worker, on its own port and database: only the protocol differs.
		s = await startWorker(8814, { https: true });
		const first = await httpsCall(s.base, "POST", "/api/v1/auth/register", { json: { email: EMAIL, password: PASSWORD } });
		assert.equal(first.status, 201, JSON.stringify(first.body));
	});

	after(async () => {
		await s?.stop();
	});

	test("the cookie is named __Host-session, and a cookie under the old name is cleared at sign-in", async () => {
		const { res, token } = await login();
		assert.equal(res.setCookie.length, 3, JSON.stringify(res.setCookie));
		assert.equal(res.setCookie[0], `session=; ${CLEARED}`);
		assert.match(res.setCookie[1], /^__Host-session=[^;\s]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=\d+$/);
		// The mark of a browser that has signed in to this account, under the same __Host- rules.
		assert.match(res.setCookie[2], /^__Host-device=[^;\s]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=31536000$/);
		assert.ok(!JSON.stringify(res.body).includes(token), "the token is not in the body");
		const who = await me(`__Host-session=${token}`);
		assert.equal(who.status, 200, JSON.stringify(who.body));
		assert.equal(who.body.email, EMAIL);
	});

	test("a session cookie under the old name, from before this release, is still read", async () => {
		const { token } = await login();
		assert.equal((await me(`session=${token}`)).status, 200);
		assert.equal((await me(`__Host-session=stale; session=${token}`)).status, 200, "also next to a __Host-session that is no longer valid");
		assert.equal((await me("__Host-session=stale; session=stale")).status, 401);
	});

	test("logout clears the cookie under both names", async () => {
		const { token } = await login();
		const out = await httpsCall(s.base, "POST", "/api/v1/auth/logout", { json: {}, headers: { Cookie: `__Host-session=${token}` } });
		assert.equal(out.status, 200, JSON.stringify(out.body));
		assert.deepEqual(out.setCookie, [`__Host-session=; ${CLEARED}`, `session=; ${CLEARED}`]);
		assert.equal((await me(`__Host-session=${token}`)).status, 401);
	});
});
