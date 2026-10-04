// Tests for how src/services/api.ts treats the session. Run with `npm test` in dashboard-src; axios
// is replaced by ./stubs/axios, so nothing leaves the process.
//
// The session is an HttpOnly cookie that the browser sends by itself. The api module therefore adds
// no Authorization header to anything, and learns that the session is gone from a 401 alone: it
// then sends a signed-in page to /login with the way back, leaves the public pages where they are,
// and signs nobody out for a 503 or a network failure.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import api, { onSessionEnded, roleRefusedSince } from "@/services/api";
import { assigned, browser, storage } from "./browser";
import { client, created, fail, requestInterceptors } from "./stubs/axios";
import { toasts } from "./stubs/toast";

const TOKEN = "legacy-session-token-0123456789";
const VIEW_ONLY = { error: "Your access to this mailbox is view-only.", code: "view_only" };
const ADMIN_ONLY = { error: "Only a mailbox admin can change mailbox settings.", code: "mailbox_admin_required" };

/** How many times api.ts told the auth store that the session is gone. */
let ended = 0;

// Everything is inside one suite so that its hooks stay its own: all the suites are loaded into one
// Node process, where a hook at the top level of a file would run around every other file's tests
// too, and these hooks install a `window`.
describe("the session in api.ts", () => {
	beforeEach(() => {
		browser.install("https://mail.test/mailbox/me%40reflect.cloud/emails/inbox?filter=unread#top");
		toasts.length = 0;
		ended = 0;
		onSessionEnded(() => ended++);
	});

	afterEach(() => {
		browser.remove();
	});

	describe("no request carries a session token", () => {
		test("no Authorization header: none on the client, none added per request, and no way to set one", () => {
			// Even with the previous release's object, token included, still in this browser.
			storage.set("session", JSON.stringify({ id: TOKEN, userId: "u1", email: "me@reflect.cloud", isAdmin: true, expiresAt: Date.now() + 1000 }));

			assert.equal(created.length, 1, "api.ts makes one axios client");
			assert.equal(/authorization/i.test(JSON.stringify(created[0])), false);
			assert.deepEqual(client.defaults.headers.common, {});

			let config: any = { url: "/api/v1/mailboxes", headers: {} };
			for (const intercept of requestInterceptors) config = intercept(config);
			assert.deepEqual(config.headers, {}, "no request interceptor adds a header");

			assert.equal("setAuthToken" in api, false);
			assert.equal("clearAuthToken" in api, false);
		});

		test("the client does not switch cookies off for its same-origin requests", () => {
			assert.notEqual(created[0]?.withCredentials, false);
			assert.equal(created[0]?.baseURL, "", "requests go to the page's own origin");
		});
	});

	describe("a 401", () => {
		test("on a signed-in page: the user is forgotten and sent to sign in, with the way back", async () => {
			const { error, rejections } = await fail(401, { error: "Unauthorized" });
			assert.equal(ended, 1);
			assert.deepEqual(assigned, [
				`/login?redirect=${encodeURIComponent("/mailbox/me%40reflect.cloud/emails/inbox?filter=unread#top")}&ended=1`,
			]);
			assert.deepEqual(rejections, [error], "the caller still gets its error");
		});

		test("the redirect value reads back as the page the user was on", async () => {
			await fail(401);
			const query = new URL(assigned[0], "https://mail.test").searchParams;
			assert.equal(query.get("redirect"), "/mailbox/me%40reflect.cloud/emails/inbox?filter=unread#top");
			assert.equal(query.get("ended"), "1");
		});

		for (const path of ["/login", "/register", "/forgot-password", "/reset-password", "/reset-password/"]) {
			test(`on ${path}: the visitor stays there`, async () => {
				browser.install(`https://mail.test${path}?token=abc`);
				onSessionEnded(() => ended++);
				await fail(401, { error: "Unauthorized" }, "/api/v1/app-bindings");
				assert.deepEqual(assigned, []);
				assert.equal(ended, 1, "what was kept about a user is still dropped");
			});
		}

		test("from the sign-in request is a wrong password, not a session that ended", async () => {
			browser.install("https://mail.test/login?redirect=%2Fadmin");
			onSessionEnded(() => ended++);
			const { error, rejections } = await fail(401, { error: "Invalid credentials" }, "/api/v1/auth/login");
			assert.equal(ended, 0);
			assert.deepEqual(assigned, []);
			assert.deepEqual(rejections, [error]);
		});

		test("from the change-password request is the session ending: a wrong current password is a 400 there", async () => {
			browser.install("https://mail.test/mailbox/support%40reflect.cloud/settings");
			onSessionEnded(() => ended++);
			await fail(401, { error: "Unauthorized" }, "/api/v1/auth/change-password");
			assert.equal(ended, 1);
			assert.equal(assigned.length, 1);
			assert.match(assigned[0], /^\/login\?redirect=.*&ended=1$/);

			ended = 0;
			assigned.length = 0;
			await fail(400, { error: "The current password is not correct." }, "/api/v1/auth/change-password");
			assert.equal(ended, 0, "a wrong current password signs nobody out");
			assert.deepEqual(assigned, []);
		});
	});

	describe("anything that is not a 401 signs nobody out", () => {
		test("a 503 (the server could not check the session)", async () => {
			const { error, rejections } = await fail(503, { error: "Could not check the session. Try again." });
			assert.equal(ended, 0);
			assert.deepEqual(assigned, []);
			assert.deepEqual(rejections, [error]);
		});

		test("a 403, a 429, a 500 and a request that never got an answer", async () => {
			await fail(403, { error: "You don't have access to this mailbox" });
			await fail(429, { error: "Too many attempts. Try again in 30 seconds.", retry_after_seconds: 30 });
			await fail(500, {});
			await fail(null);
			assert.equal(ended, 0);
			assert.deepEqual(assigned, []);
		});
	});

	describe("a 403 for the user's role on the mailbox", () => {
		test("shows the server's sentence once for a burst of refused requests", async () => {
			const since = Date.now();
			assert.equal(roleRefusedSince(since + 60_000), false);
			for (let i = 0; i < 5; i++) await fail(403, VIEW_ONLY, `/api/v1/mailboxes/me@reflect.cloud/emails/${i}/move`);
			assert.deepEqual(toasts, [{ type: "error", message: VIEW_ONLY.error }]);
			assert.equal(roleRefusedSince(since), true, "so the caller leaves its own failure toast out");
		});

		test("shows the other sentence when a write user saves mailbox settings", async () => {
			await fail(403, ADMIN_ONLY, "/api/v1/mailboxes/me@reflect.cloud");
			assert.deepEqual(toasts, [{ type: "error", message: ADMIN_ONLY.error }]);
		});

		test("any other 403 is left to the caller", async () => {
			await fail(403, { error: "You don't have access to this mailbox" });
			await fail(403, { error: "Admin privileges required", code: "something_else" });
			assert.deepEqual(toasts, []);
		});
	});
});
