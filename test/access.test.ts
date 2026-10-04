import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import {
	checkCookieRequest,
	checkJsonBody,
	clientIpKey,
	CREDENTIAL_PATHS,
	decideMailboxAccess,
	MAILBOX_REFUSALS,
	normalizeRole,
	roleForMailbox,
} from "../src/access.ts";

const SRC = resolve(import.meta.dirname, "../src");

const A = "allowed";
const V = "view_only";
const M = "mailbox_admin_required";

// Every route registered under /api/v1/mailboxes/:mailboxId, with what each role gets:
//   [method, route, read, write, admin, owner]
// The test below reads the route registrations out of the source and fails when this table and the
// source disagree, so a new mailbox route cannot ship without a line here.
const ROUTES: Array<[string, string, string, string, string, string]> = [
	// The mailbox itself. DELETE passes the role check for admin and owner only to be refused by the
	// route, which lets global admins alone delete a mailbox.
	["GET", "/api/v1/mailboxes/:mailboxId", A, A, A, A],
	["PUT", "/api/v1/mailboxes/:mailboxId", V, M, A, A],
	["DELETE", "/api/v1/mailboxes/:mailboxId", V, M, A, A],
	// Mail
	["GET", "/api/v1/mailboxes/:mailboxId/emails", A, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/emails", V, A, A, A],
	["GET", "/api/v1/mailboxes/:mailboxId/emails/:id", A, A, A, A],
	["PUT", "/api/v1/mailboxes/:mailboxId/emails/:id", V, A, A, A],
	["DELETE", "/api/v1/mailboxes/:mailboxId/emails/:id", V, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/emails/:id/move", V, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/emails/:id/reply", V, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/emails/:id/forward", V, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/emails/:id/snooze", V, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/emails/:id/schedule", V, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/emails/:id/send-now", V, A, A, A],
	["GET", "/api/v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId", A, A, A, A],
	["GET", "/api/v1/mailboxes/:mailboxId/threads/:threadId", A, A, A, A],
	["GET", "/api/v1/mailboxes/:mailboxId/search", A, A, A, A],
	// Queue
	["GET", "/api/v1/mailboxes/:mailboxId/queue-summary", A, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/queue/run-due", V, A, A, A],
	// Folders
	["GET", "/api/v1/mailboxes/:mailboxId/folders", A, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/folders", V, A, A, A],
	["PUT", "/api/v1/mailboxes/:mailboxId/folders/:id", V, A, A, A],
	["DELETE", "/api/v1/mailboxes/:mailboxId/folders/:id", V, A, A, A],
	// Contacts
	["GET", "/api/v1/mailboxes/:mailboxId/contacts", A, A, A, A],
	["POST", "/api/v1/mailboxes/:mailboxId/contacts", V, A, A, A],
	["PUT", "/api/v1/mailboxes/:mailboxId/contacts/:id", V, A, A, A],
	["DELETE", "/api/v1/mailboxes/:mailboxId/contacts/:id", V, A, A, A],
	// Outreach pipeline
	["GET", "/api/v1/mailboxes/:mailboxId/pipeline", A, A, A, A],
];

/** A route pattern as a real request path. */
const concrete = (route: string) =>
	route.replace(":mailboxId", "support@example.test").replace(/:[A-Za-z]+/g, "x1");

/** Every `app.<method>("/api/v1/mailboxes/:mailboxId…")` and `openapi.<method>(…)` in the worker source. */
function registeredMailboxRoutes(): string[] {
	const files = [
		join(SRC, "worker.ts"),
		...readdirSync(join(SRC, "routes"))
			.filter((name) => name.endsWith(".ts"))
			.map((name) => join(SRC, "routes", name)),
	];
	const found: string[] = [];
	const registration = /\b(?:app|openapi)\.(get|post|put|delete|patch|all)\(\s*["'`](\/api\/v1\/mailboxes\/:mailboxId[^"'`]*)["'`]/g;
	for (const file of files) {
		for (const match of readFileSync(file, "utf8").matchAll(registration)) {
			found.push(`${match[1].toUpperCase()} ${match[2]}`);
		}
	}
	return found.sort();
}

describe("mailbox roles", () => {
	test("the table covers every mailbox route the worker registers, and nothing else", () => {
		const registered = registeredMailboxRoutes();
		assert.ok(registered.length > 0, "found no routes at all: the source scan is broken");
		assert.deepEqual(ROUTES.map(([method, route]) => `${method} ${route}`).sort(), registered);
	});

	test("each role gets exactly what the table says on every route", () => {
		for (const [method, route, read, write, admin, owner] of ROUTES) {
			const path = concrete(route);
			assert.equal(decideMailboxAccess("read", method, path), read, `read ${method} ${route}`);
			assert.equal(decideMailboxAccess("write", method, path), write, `write ${method} ${route}`);
			assert.equal(decideMailboxAccess("admin", method, path), admin, `admin ${method} ${route}`);
			assert.equal(decideMailboxAccess("owner", method, path), owner, `owner ${method} ${route}`);
		}
	});

	test("read may only GET and HEAD", () => {
		for (const [, route] of ROUTES) {
			const path = concrete(route);
			assert.equal(decideMailboxAccess("read", "GET", path), A);
			assert.equal(decideMailboxAccess("read", "HEAD", path), A);
			assert.equal(decideMailboxAccess("read", "head", path), A, "method case does not matter");
			for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "post"]) {
				assert.equal(decideMailboxAccess("read", method, path), V, `${method} ${route}`);
			}
		}
	});

	test("an unknown role string is treated as read", () => {
		for (const role of ["", "viewer", "Admin", "OWNER", " write", "write ", "null", "undefined", "root"]) {
			for (const [method, route, read] of ROUTES) {
				assert.equal(decideMailboxAccess(role, method, concrete(route)), read, `"${role}" ${method} ${route}`);
			}
		}
		assert.equal(normalizeRole(undefined), "read");
		assert.equal(normalizeRole(null), "read");
		assert.equal(normalizeRole(3), "read");
		for (const role of ["owner", "admin", "write", "read"]) assert.equal(normalizeRole(role), role);
	});

	test("write changes mail, folders, contacts and the queue, and nothing else", () => {
		const box = "/api/v1/mailboxes/support@example.test";
		assert.equal(decideMailboxAccess("write", "PUT", box), M, "mailbox settings");
		assert.equal(decideMailboxAccess("write", "PUT", `${box}/`), M, "with a trailing slash too");
		// A route nobody has decided about yet is closed to write, not open.
		for (const later of ["settings", "members", "rules", "export", "emails2", "EMAILS", ""]) {
			assert.equal(decideMailboxAccess("write", "POST", `${box}/${later}`), M, `/${later}`);
			assert.equal(decideMailboxAccess("admin", "POST", `${box}/${later}`), A, `/${later} as admin`);
		}
		// The section is the segment right after the mailbox id, wherever else its name appears.
		assert.equal(decideMailboxAccess("write", "POST", `${box}/settings/emails`), M);
		assert.equal(decideMailboxAccess("write", "POST", "/api/v1/mailboxes/emails"), M, "a mailbox called 'emails'");
		assert.equal(decideMailboxAccess("write", "POST", "/elsewhere/emails/emails"), M, "a path outside the mailbox routes");
		assert.equal(decideMailboxAccess("write", "DELETE", `${box}/emails/x1`), A);
	});

	test("each refusal has the sentence the API sends", () => {
		assert.deepEqual(MAILBOX_REFUSALS, {
			view_only: "Your access to this mailbox is view-only.",
			mailbox_admin_required: "Only a mailbox admin can change mailbox settings.",
		});
	});

	test("a user's role on a mailbox ignores letter case and is null without a grant", () => {
		const grants = [
			{ mailboxId: "Support@Example.Test", role: "write" },
			{ mailboxId: "sales@example.test", role: "owner" },
			{ mailboxId: "old@example.test", role: "something-else" },
		];
		assert.equal(roleForMailbox(grants, "support@example.test"), "write");
		assert.equal(roleForMailbox(grants, "SUPPORT@example.test"), "write");
		assert.equal(roleForMailbox(grants, "sales@example.test"), "owner");
		assert.equal(roleForMailbox(grants, "old@example.test"), "read", "an unknown role is read");
		assert.equal(roleForMailbox(grants, "other@example.test"), null);
		assert.equal(roleForMailbox(grants, "support@example.tes"), null, "no prefix matching");
		assert.equal(roleForMailbox([], "support@example.test"), null);
	});

	test("when two spellings of a mailbox are granted, the weaker role applies", () => {
		const grants = [
			{ mailboxId: "Support@Example.Test", role: "owner" },
			{ mailboxId: "support@example.test", role: "read" },
			{ mailboxId: "SUPPORT@example.test", role: "write" },
		];
		assert.equal(roleForMailbox(grants, "support@example.test"), "read");
		assert.equal(roleForMailbox(grants.slice().reverse(), "support@example.test"), "read");
	});
});

describe("requests authenticated by the session cookie", () => {
	const URL_ = "https://mail.example.test/api/v1/mailboxes/support@example.test/emails";
	const JSON_BODY = { "Content-Type": "application/json", "Content-Length": "17" };
	const check = (method: string, headers: Record<string, string>, url = URL_) =>
		checkCookieRequest(method, url, new Headers(headers));
	const CROSS = { status: 403, error: "Cross-site request refused" };

	test("reads are never refused", () => {
		for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
			assert.equal(check(method, { "Sec-Fetch-Site": "cross-site", Origin: "https://evil.test" }), null, method);
		}
	});

	test("a write the browser calls same-origin is allowed", () => {
		for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
			assert.equal(check(method, { ...JSON_BODY, "Sec-Fetch-Site": "same-origin", Origin: "https://mail.example.test" }), null, method);
		}
		assert.equal(check("POST", { ...JSON_BODY, "Sec-Fetch-Site": "Same-Origin" }), null);
		assert.equal(check("POST", { ...JSON_BODY, "Sec-Fetch-Site": "none" }), null, "made by the user directly");
	});

	test("a write from another site, or from a sibling subdomain, is refused", () => {
		for (const site of ["cross-site", "same-site", "", "something-new"]) {
			for (const method of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
				assert.deepEqual(check(method, { ...JSON_BODY, "Sec-Fetch-Site": site }), CROSS, `${method} "${site}"`);
			}
		}
		// Sec-Fetch-Site is what counts when it is there, even next to an Origin that looks right.
		assert.deepEqual(check("POST", { ...JSON_BODY, "Sec-Fetch-Site": "same-site", Origin: "https://mail.example.test" }), CROSS);
		assert.deepEqual(check("DELETE", { "Sec-Fetch-Site": "cross-site" }), CROSS, "with no body too");
	});

	test("without Sec-Fetch-Site, the Origin host has to be the request's host", () => {
		assert.equal(check("POST", { ...JSON_BODY, Origin: "https://mail.example.test" }), null);
		assert.equal(check("POST", { ...JSON_BODY, Origin: "https://MAIL.example.test:443" }), null, "same host, written differently");
		for (const origin of [
			"https://blog.example.test",
			"https://example.test",
			"https://mail.example.test.evil.test",
			"https://evil.test",
			"https://mail.example.test:8443",
			"null",
			"",
			"mail.example.test",
		]) {
			assert.deepEqual(check("POST", { ...JSON_BODY, Origin: origin }), CROSS, `"${origin}"`);
		}
		const local = "http://127.0.0.1:8787/api/v1/auth/logout";
		assert.equal(check("POST", { Origin: "http://127.0.0.1:8787" }, local), null);
		assert.deepEqual(check("POST", { Origin: "http://127.0.0.1:5173" }, local), CROSS, "another port is another host");
	});

	test("a request with neither header is not from a browser page and is allowed", () => {
		assert.equal(check("POST", JSON_BODY), null);
		assert.equal(check("DELETE", {}), null);
	});

	test("a body has to be declared as JSON", () => {
		const same = { "Sec-Fetch-Site": "same-origin" };
		const refused = { status: 415, error: "Content-Type must be application/json" };
		assert.equal(check("POST", { ...same, "Content-Type": "application/json", "Content-Length": "2" }), null);
		assert.equal(check("POST", { ...same, "Content-Type": "application/json; charset=utf-8", "Content-Length": "2" }), null);
		assert.equal(check("POST", { ...same, "Content-Type": "Application/JSON", "Content-Length": "2" }), null);
		assert.equal(check("PUT", { ...same, "Content-Type": "application/json", "Transfer-Encoding": "chunked" }), null);
		// What a form on another page can send without asking first.
		for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
			assert.deepEqual(check("POST", { ...same, "Content-Type": type, "Content-Length": "2" }), refused, type);
		}
		assert.deepEqual(check("POST", { ...same, "Content-Length": "2" }), refused, "no type at all");
		assert.deepEqual(check("POST", { ...same, "Content-Type": "application/jsonp", "Content-Length": "2" }), refused);
		assert.deepEqual(check("POST", { ...same, "Content-Type": "text/json", "Content-Length": "2" }), refused);
		assert.deepEqual(check("PUT", { ...same, "Content-Type": "text/plain", "Transfer-Encoding": "chunked" }), refused);
		assert.deepEqual(check("POST", { "Content-Type": "text/plain", "Content-Length": "2" }), refused, "also with no browser headers");
	});

	test("a write with no body needs no Content-Type", () => {
		const same = { "Sec-Fetch-Site": "same-origin" };
		// The dashboard's body-less POSTs (logout, send-now, pitch reset) and every DELETE.
		assert.equal(check("POST", { ...same, "Content-Length": "0" }), null);
		assert.equal(check("POST", same), null);
		assert.equal(check("DELETE", same), null);
		assert.equal(check("POST", { ...same, "Content-Length": "0", "Content-Type": "text/plain" }), null);
	});

	test("the cross-site refusal comes before the Content-Type one", () => {
		assert.deepEqual(check("POST", { "Sec-Fetch-Site": "cross-site", "Content-Type": "text/plain", "Content-Length": "2" }), CROSS);
	});
});

describe("the JSON rule on its own, as the public credential endpoints use it", () => {
	const refused = { status: 415, error: "Content-Type must be application/json" };

	test("a body that a form could post is refused, wherever the request says it comes from", () => {
		for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
			assert.deepEqual(checkJsonBody(new Headers({ "Content-Type": type, "Content-Length": "40" })), refused, type);
			assert.deepEqual(checkJsonBody(new Headers({ "Content-Type": type, "Content-Length": "40", "Sec-Fetch-Site": "same-origin" })), refused, type);
		}
		assert.deepEqual(checkJsonBody(new Headers({ "Content-Length": "40" })), refused, "no type at all");
	});

	test("a JSON body, or no body, is let through", () => {
		assert.equal(checkJsonBody(new Headers({ "Content-Type": "application/json", "Content-Length": "40" })), null);
		assert.equal(checkJsonBody(new Headers({ "Content-Type": "application/json; charset=utf-8", "Content-Length": "40", "Sec-Fetch-Site": "cross-site" })), null, "where it comes from is not this rule's business");
		assert.equal(checkJsonBody(new Headers({ "Content-Length": "0" })), null);
		assert.equal(checkJsonBody(new Headers()), null);
	});
});

describe("the per-IP limit on credential endpoints", () => {
	test("covers the five endpoints that take a password or start a reset, and the worker registers each", () => {
		assert.deepEqual(CREDENTIAL_PATHS.slice().sort(), [
			"/api/v1/auth/change-password",
			"/api/v1/auth/forgot-password",
			"/api/v1/auth/login",
			"/api/v1/auth/register",
			"/api/v1/auth/reset-password",
		]);
		// The limiter is attached per path: a path with no POST route would be a limiter on nothing.
		const worker = readFileSync(join(SRC, "worker.ts"), "utf8");
		for (const path of CREDENTIAL_PATHS) {
			assert.ok(worker.includes(`openapi.post("${path}",`), `${path} is a POST route`);
		}
	});

	test("is keyed by CF-Connecting-IP, or `unknown` without it", () => {
		assert.equal(clientIpKey(new Headers({ "CF-Connecting-IP": "203.0.113.7" })), "203.0.113.7");
		// An IPv6 client is counted by its /64: every address in it belongs to the same subscriber.
		assert.equal(clientIpKey(new Headers({ "cf-connecting-ip": " 2001:db8::1 " })), "2001:db8:0:0::/64");
		assert.equal(clientIpKey(new Headers({ "cf-connecting-ip": "2001:db8:0:0:ffff::9" })), "2001:db8:0:0::/64");
		assert.equal(clientIpKey(new Headers({ "X-Forwarded-For": "203.0.113.7" })), "unknown", "no other header is trusted");
		assert.equal(clientIpKey(new Headers()), "unknown");
		assert.equal(clientIpKey(new Headers({ "CF-Connecting-IP": "" })), "unknown");
	});
});
