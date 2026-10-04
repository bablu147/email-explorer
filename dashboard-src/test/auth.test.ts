// Tests for what the browser keeps about the signed-in user (src/stores/auth.ts), where sign-in may
// send them afterwards (src/utils/redirect.ts) and what a view-only role switches off
// (src/stores/mailboxes.ts, src/stores/ui.ts). Run with `npm test` in dashboard-src; the api module
// is replaced by ./stubs/api, so nothing leaves the process.
//
// The session token is never in page-readable storage. The previous release stored it there, so a
// browser can still hold that object when this build first loads: the token must go at once, and
// the user must stay signed in, because the cookie the same sign-in set is still valid.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useMailboxStore } from "@/stores/mailboxes";
import { useUIStore } from "@/stores/ui";
import { safeRedirect } from "@/utils/redirect";
import { browser, storage } from "./browser";
import { calls, endSession, handlers } from "./stubs/api";
import { toasts } from "./stubs/toast";

const TOKEN = "legacy-session-token-0123456789";
const FACTS = { userId: "u1", email: "me@reflect.cloud", isAdmin: false, expiresAt: Date.now() + 86_400_000 };
/** What the previous release left in localStorage under "session": the whole sign-in response. */
const LEGACY = { id: TOKEN, ...FACTS };

/** Lets already-settled promises and their continuations run. */
const flush = async () => {
	for (let i = 0; i < 10; i++) {
		await nextTick();
		await Promise.resolve();
	}
};
const defer = <T = any>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};
const callsOf = (name: string) => calls.filter((c) => c.name === name);
const stored = () => [...storage.entries()].map(([key, value]) => `${key}=${value}`).join("\n");
const storedFacts = () => JSON.parse(storage.get("reflect_user") || "null");

// Everything is inside one suite so that its hooks stay its own: all the suites are loaded into one
// Node process, where a hook at the top level of a file would run around every other file's tests
// too, and these hooks install a `window`.
describe("the signed-in user in the browser", () => {
	beforeEach(() => {
		browser.install();
		calls.length = 0;
		toasts.length = 0;
		for (const name of Object.keys(handlers)) delete handlers[name];
		setActivePinia(createPinia());
	});

	afterEach(() => {
		browser.remove();
	});

	describe("signing in", () => {
		test("keeps the four facts and nothing else", async () => {
			handlers.login = async () => ({ data: FACTS });
			const auth = useAuthStore();
			await auth.login("me@reflect.cloud", "correct horse");

			assert.equal(auth.isAuthenticated, true);
			assert.deepEqual({ ...auth.session }, FACTS);
			assert.deepEqual([...storage.keys()], ["reflect_user"]);
			assert.deepEqual(storedFacts(), FACTS);
			assert.equal(callsOf("getCurrentUser").length, 0, "nothing to re-check: the server just answered");
		});

		test("a response that still carries a token: the token is neither stored nor kept in memory", async () => {
			handlers.login = async () => ({ data: LEGACY });
			const auth = useAuthStore();
			await auth.login("me@reflect.cloud", "correct horse");

			assert.equal(stored().includes(TOKEN), false);
			assert.equal(JSON.stringify(auth.session).includes(TOKEN), false);
			assert.deepEqual(storedFacts(), FACTS);
		});

		test("a refusal shows the server's sentence and stores nothing", async () => {
			const auth = useAuthStore();
			const refused = async (status: number, data: any) => {
				handlers.login = async () => {
					throw { response: { status, data } };
				};
				await assert.rejects(auth.login("me@reflect.cloud", "wrong"));
				return auth.error;
			};
			assert.equal(await refused(401, { error: "Invalid credentials" }), "Invalid credentials");
			assert.equal(
				await refused(403, { error: "This account is disabled. Contact an administrator." }),
				"This account is disabled. Contact an administrator.",
			);
			assert.equal(
				await refused(429, { error: "Too many attempts. Try again in 45 seconds.", retry_after_seconds: 45 }),
				"Too many attempts. Try again in 45 seconds.",
			);
			assert.equal(auth.isAuthenticated, false);
			assert.equal(storage.size, 0);
		});
	});

	describe("a browser that still holds the previous release's token object", () => {
		test("the token is gone before any request answers, and the user stays signed in through /me", async () => {
			storage.set("session", JSON.stringify(LEGACY));
			const me = defer();
			handlers.getCurrentUser = () => me.promise;

			const auth = useAuthStore();
			assert.equal(auth.isAuthenticated, true, "signed in at once, for the router guard");
			assert.equal(storage.has("session"), false);
			assert.equal(stored().includes(TOKEN), false);
			assert.equal(JSON.stringify(auth.session).includes(TOKEN), false);
			assert.equal(callsOf("getCurrentUser").length, 1, "the cookie is checked with GET /auth/me");

			// The server knows better than the stored object: the user was made an admin meanwhile.
			me.resolve({ data: { ...FACTS, isAdmin: true } });
			await flush();
			assert.equal(auth.isAuthenticated, true);
			assert.equal(auth.isAdmin, true);
			assert.deepEqual(storedFacts(), { ...FACTS, isAdmin: true });
			assert.equal(stored().includes(TOKEN), false);
		});

		test("/me answering 401: the cookie is not a session any more, so the user is signed out", async () => {
			storage.set("session", JSON.stringify(LEGACY));
			handlers.getCurrentUser = async () => {
				endSession(); // what api.ts does for a 401
				throw { response: { status: 401, data: { error: "Unauthorized" } } };
			};
			const auth = useAuthStore();
			await flush();
			assert.equal(auth.isAuthenticated, false);
			assert.equal(storage.size, 0);
		});
	});

	describe("re-checking the session on load", () => {
		test("a 503 does not sign the user out", async () => {
			storage.set("reflect_user", JSON.stringify(FACTS));
			handlers.getCurrentUser = async () => {
				throw { response: { status: 503, data: { error: "Could not check the session. Try again." } } };
			};
			const auth = useAuthStore();
			await flush();
			assert.equal(callsOf("getCurrentUser").length, 1);
			assert.equal(auth.isAuthenticated, true);
			assert.deepEqual(storedFacts(), FACTS);
			assert.equal(await auth.checkAuth(), true, "asked again, same answer, still signed in");
		});

		test("neither does a network failure, nor a 200 that names no user", async () => {
			storage.set("reflect_user", JSON.stringify(FACTS));
			handlers.getCurrentUser = async () => {
				throw new Error("Network Error");
			};
			const auth = useAuthStore();
			await flush();
			assert.equal(auth.isAuthenticated, true);

			handlers.getCurrentUser = async () => ({ data: "<!doctype html>" });
			assert.equal(await auth.checkAuth(), true);
			assert.deepEqual(storedFacts(), FACTS);
		});

		test("nothing stored: nobody is signed in and the server is not asked", async () => {
			const auth = useAuthStore();
			await flush();
			assert.equal(auth.isAuthenticated, false);
			assert.equal(callsOf("getCurrentUser").length, 0, "no 401 on the sign-in page");
		});

		test("an answer that arrives after signing out does not sign the user back in", async () => {
			storage.set("reflect_user", JSON.stringify(FACTS));
			const me = defer();
			handlers.getCurrentUser = () => me.promise;
			const auth = useAuthStore();
			endSession();
			me.resolve({ data: FACTS });
			await flush();
			assert.equal(auth.isAuthenticated, false);
			assert.equal(storage.size, 0);
		});
	});

	describe("signing out", () => {
		test("forgets the user even when the request fails", async () => {
			storage.set("reflect_user", JSON.stringify(FACTS));
			handlers.getCurrentUser = async () => ({ data: FACTS });
			handlers.logout = async () => {
				throw { response: { status: 503, data: {} } };
			};
			const logged: unknown[] = [];
			const original = console.error;
			console.error = (...args: unknown[]) => void logged.push(args);
			try {
				const auth = useAuthStore();
				await flush();
				await auth.logout();
				assert.equal(callsOf("logout").length, 1);
				assert.equal(auth.isAuthenticated, false);
				assert.equal(storage.size, 0);
			} finally {
				console.error = original;
			}
			assert.equal(logged.length, 1, "the failed request is logged");
		});
	});

	describe("where sign-in goes afterwards (?redirect=)", () => {
		test("a path on this site is kept, with its query and hash", () => {
			assert.equal(safeRedirect("/admin"), "/admin");
			assert.equal(
				safeRedirect("/mailbox/me%40reflect.cloud/email/abc?fromFolder=inbox#top"),
				"/mailbox/me%40reflect.cloud/email/abc?fromFolder=inbox#top",
			);
		});

		test("anything that is not a path on this site goes to the hub", () => {
			const elsewhere: unknown[] = [
				"https://evil.example/",
				"//evil.example",
				"/\\evil.example", // a backslash is a slash to a browser
				"/\t/evil.example", // tabs and newlines are dropped before a browser reads the address
				"/\n/evil.example",
				"/.//evil.example", // resolves to the path "//evil.example"
				"javascript:alert(1)",
				"mailbox/x",
				"",
				undefined,
				null,
				["/admin"],
			];
			for (const value of elsewhere) assert.equal(safeRedirect(value), "/", JSON.stringify(value));
		});

		test("never back to the sign-in page", () => {
			assert.equal(safeRedirect("/login"), "/");
			assert.equal(safeRedirect("/login/?redirect=%2Fadmin"), "/");
		});
	});

	describe("a view-only mailbox (role: read)", () => {
		const READ_ONLY = "support@reflect.cloud";
		const WRITABLE = "me@reflect.cloud";

		beforeEach(() => {
			handlers.listMailboxes = async () => ({
				data: [
					{ id: READ_ONLY, email: READ_ONLY, name: "Support", role: "read" },
					{ id: WRITABLE, email: WRITABLE, name: "Me", role: "write" },
					{ id: "old@reflect.cloud", email: "old@reflect.cloud", name: "No role in the answer" },
				],
			});
			handlers.getMailbox = async (id: string) => ({ data: { id: id.toLowerCase(), email: id.toLowerCase(), name: id } });
		});

		test("canWrite is false only for a known read role", async () => {
			const mailboxes = useMailboxStore();
			assert.equal(mailboxes.canWrite, true, "nothing known yet");

			// The role is known as soon as the list is, without waiting for the mailbox's own details.
			const details = mailboxes.fetchMailbox("Support@Reflect.cloud");
			await mailboxes.rolesLoaded();
			assert.equal(mailboxes.currentRole, "read");
			assert.equal(mailboxes.canWrite, false);
			await details;

			await mailboxes.fetchMailbox(WRITABLE);
			assert.equal(mailboxes.currentRole, "write");
			assert.equal(mailboxes.canWrite, true);

			await mailboxes.fetchMailbox("old@reflect.cloud");
			assert.equal(mailboxes.currentRole, null);
			assert.equal(mailboxes.canWrite, true, "an unknown role is left to the server");

			await mailboxes.rolesLoaded();
			assert.equal(callsOf("listMailboxes").length, 1, "the list is asked for once");
		});

		test("everything waiting for the roles shares one request, and a failed one does not throw", async () => {
			const list = defer();
			handlers.listMailboxes = () => list.promise;
			const mailboxes = useMailboxStore();
			const waiting = [mailboxes.rolesLoaded(), mailboxes.rolesLoaded()];
			assert.equal(callsOf("listMailboxes").length, 1);
			list.reject({ response: { status: 500, data: {} } });
			await Promise.all(waiting);
			assert.equal(mailboxes.canWrite, true);
		});

		test("the composer does not open, and the user is told why", async () => {
			const mailboxes = useMailboxStore();
			const ui = useUIStore();
			await mailboxes.rolesLoaded();

			await mailboxes.fetchMailbox(READ_ONLY);
			ui.openComposeModal({ mode: "reply", originalEmail: { id: "m1" } });
			assert.equal(ui.isComposeModalOpen, false);
			assert.deepEqual(toasts, [{ type: "info", message: "Your access to this mailbox is view-only." }]);

			await mailboxes.fetchMailbox(WRITABLE);
			ui.openComposeModal();
			assert.equal(ui.isComposeModalOpen, true);
			assert.equal(toasts.length, 1);
		});
	});
});
