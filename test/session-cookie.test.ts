import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSessionCookie, clearSessionCookies, readSessionTokens } from "../src/session-cookie.ts";

const HTTPS = "https://mail.example.test/api/v1/mailboxes";
const LOCAL = "http://127.0.0.1:8787/api/v1/mailboxes";

const request = (headers: Record<string, string>, url = HTTPS) => new Request(url, { headers });
const tokens = (headers: Record<string, string>, url = HTTPS) => readSessionTokens(request(headers, url));

test("a request with no token presents nothing", () => {
	assert.deepEqual(tokens({}), []);
	assert.deepEqual(tokens({ Cookie: "theme=dark; other=1" }), []);
	assert.deepEqual(tokens({ Authorization: "Basic dXNlcjpwYXNz" }), []);
	assert.deepEqual(tokens({ Authorization: "Bearer" }), []);
	assert.deepEqual(tokens({ Authorization: "Bearer   " }), []);
	assert.deepEqual(tokens({ Cookie: "session=; __Host-session=" }), [], "an empty value is not a token");
});

test("a Bearer token is read, whatever the case of the scheme", () => {
	assert.deepEqual(tokens({ Authorization: "Bearer abc-123" }), [{ token: "abc-123", via: "bearer" }]);
	assert.deepEqual(tokens({ Authorization: "bearer   abc-123  " }), [{ token: "abc-123", via: "bearer" }]);
});

test("the Bearer token comes first, then the __Host- cookie, then the legacy cookie", () => {
	assert.deepEqual(
		tokens({ Authorization: "Bearer from-header", Cookie: "session=legacy; theme=dark; __Host-session=current" }),
		[
			{ token: "from-header", via: "bearer" },
			{ token: "current", via: "cookie" },
			{ token: "legacy", via: "cookie" },
		],
	);
});

test("a previous dashboard build's `Bearer undefined` still leaves the cookie to fall through to", () => {
	assert.deepEqual(tokens({ Authorization: "Bearer undefined", Cookie: "__Host-session=real" }), [
		{ token: "undefined", via: "bearer" },
		{ token: "real", via: "cookie" },
	]);
});

test("the legacy cookie name is still read on https", () => {
	assert.deepEqual(tokens({ Cookie: "session=made-before-the-release" }), [
		{ token: "made-before-the-release", via: "cookie" },
	]);
});

test("the plain cookie is read on a local http host", () => {
	assert.deepEqual(tokens({ Cookie: "session=dev" }, LOCAL), [{ token: "dev", via: "cookie" }]);
});

test("cookie names are matched exactly, not as a substring", () => {
	// The pattern this replaces, /session=([^;]+)/, read "evil1" out of `xsession=evil1`.
	const others = "xsession=evil1; my_session=evil2; __Host-session2=evil3; SESSION=evil4; __host-session=evil5; sessions=evil6";
	assert.deepEqual(tokens({ Cookie: others }), []);
	assert.deepEqual(tokens({ Cookie: `${others}; session=real` }), [{ token: "real", via: "cookie" }]);
});

test("cookie values are taken whole: spaces around pairs are dropped, `=` inside a value is kept", () => {
	assert.deepEqual(tokens({ Cookie: "  a=b ;   __Host-session = dG9rZW4=  ; c=d" }), [
		{ token: "dG9rZW4=", via: "cookie" },
	]);
	assert.deepEqual(tokens({ Cookie: "flag; session=t" }), [{ token: "t", via: "cookie" }], "a pair with no = is skipped");
});

test("a name sent twice presents both values, in the order sent", () => {
	assert.deepEqual(tokens({ Cookie: "session=first; session=second" }), [
		{ token: "first", via: "cookie" },
		{ token: "second", via: "cookie" },
	]);
});

test("the same token in the header and the cookie counts once, as a Bearer token", () => {
	assert.deepEqual(tokens({ Authorization: "Bearer same", Cookie: "session=same; __Host-session=same" }), [
		{ token: "same", via: "bearer" },
	]);
});

test("no more than four tokens are ever presented", () => {
	const many = Array.from({ length: 30 }, (_, i) => `session=t${i}`).join("; ");
	const read = tokens({ Authorization: "Bearer b", Cookie: many });
	assert.equal(read.length, 4);
	assert.deepEqual(read[0], { token: "b", via: "bearer" });
});

test("over https the session cookie is __Host-session: Secure, HttpOnly, SameSite=Strict, Path=/, no Domain", () => {
	const cookie = buildSessionCookie("tok123", HTTPS, 30 * 24 * 60 * 60);
	assert.equal(cookie, "__Host-session=tok123; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000");
	const attributes = cookie.split("; ").slice(1);
	for (const wanted of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"]) {
		assert.ok(attributes.includes(wanted), wanted);
	}
	// A __Host- cookie with a Domain attribute is refused by the browser.
	assert.ok(!/domain/i.test(cookie));
});

test("on a local http host the cookie is the plain `session` (a __Host- cookie cannot be set there)", () => {
	for (const url of [LOCAL, "http://localhost:8787/api/v1/auth/login", "http://app.localhost/api/v1/auth/login"]) {
		const cookie = buildSessionCookie("tok123", url, 3600);
		assert.equal(cookie, "session=tok123; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600");
	}
});

test("Max-Age is a whole number of seconds", () => {
	assert.match(buildSessionCookie("t", HTTPS, 1799.9), /; Max-Age=1799$/);
});

test("clearing covers both names over https, and the one name on a local http host", () => {
	assert.deepEqual(clearSessionCookies(HTTPS), [
		"__Host-session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
		"session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
	]);
	assert.deepEqual(clearSessionCookies(LOCAL), ["session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"]);
});

test("a cookie that was set is read back as the same token", () => {
	for (const url of [HTTPS, LOCAL]) {
		const pair = buildSessionCookie("Zm9v-YmFy_0==", url, 60).split("; ")[0];
		assert.deepEqual(tokens({ Cookie: `theme=dark; ${pair}` }, url), [{ token: "Zm9v-YmFy_0==", via: "cookie" }]);
	}
});

test("building a cookie never throws, whatever the URL looks like", () => {
	assert.equal(buildSessionCookie("t", "not a url", 60).split("=")[0], "session");
	assert.deepEqual(clearSessionCookies("").length, 1);
});
