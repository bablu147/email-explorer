import assert from "node:assert/strict";
import { createHash, pbkdf2Sync } from "node:crypto";
import { test } from "node:test";
import {
	hashPassword,
	isPasswordHash,
	PBKDF2_ITERATIONS,
	verifyAndUpgrade,
	verifyPassword,
} from "../src/password.ts";

const PASSWORD = "correct-horse-battery";
const legacyHash = (password: string) => createHash("sha256").update(password).digest("hex");

/** A stored hash built with node's own PBKDF2, so the format is checked against a second implementation. */
function storedWith(password: string, iterations: number, saltBytes = 16, hashBytes = 32): string {
	const salt = Buffer.alloc(saltBytes, 7);
	const hash = pbkdf2Sync(password, salt, iterations, hashBytes, "sha256");
	return `pbkdf2-sha256$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

test("the iteration count is the Workers runtime's ceiling", () => {
	// workerd refuses PBKDF2 above 100,000 in production. A larger number here would pass every
	// local test and then fail every sign-in once deployed.
	assert.equal(PBKDF2_ITERATIONS, 100_000);
});

test("a hash verifies with its own password and needs no rehash", async () => {
	const stored = await hashPassword(PASSWORD);
	assert.deepEqual(await verifyPassword(PASSWORD, stored), { ok: true, needsRehash: false });
	assert.equal(isPasswordHash(stored), true);
});

test("the stored form is self-describing and matches node's PBKDF2", async () => {
	const stored = await hashPassword(PASSWORD);
	const [scheme, iterations, salt, hash] = stored.split("$");
	assert.equal(scheme, "pbkdf2-sha256");
	assert.equal(iterations, String(PBKDF2_ITERATIONS));
	assert.equal(Buffer.from(salt, "base64").length, 16);
	assert.equal(Buffer.from(hash, "base64").length, 32);
	const expected = pbkdf2Sync(PASSWORD, Buffer.from(salt, "base64"), PBKDF2_ITERATIONS, 32, "sha256");
	assert.equal(hash, expected.toString("base64"));
});

test("a wrong password is refused", async () => {
	const stored = await hashPassword(PASSWORD);
	assert.deepEqual(await verifyPassword("correct-horse-batterx", stored), { ok: false, needsRehash: false });
	assert.deepEqual(await verifyPassword("", stored), { ok: false, needsRehash: false });
	assert.deepEqual(await verifyPassword(`${PASSWORD} `, stored), { ok: false, needsRehash: false });
});

test("two hashes of one password differ, and both verify", async () => {
	const a = await hashPassword(PASSWORD);
	const b = await hashPassword(PASSWORD);
	assert.notEqual(a, b);
	assert.equal((await verifyPassword(PASSWORD, a)).ok, true);
	assert.equal((await verifyPassword(PASSWORD, b)).ok, true);
});

test("a legacy SHA-256 hash verifies and asks for a rehash", async () => {
	const stored = legacyHash(PASSWORD);
	assert.deepEqual(await verifyPassword(PASSWORD, stored), { ok: true, needsRehash: true });
	assert.deepEqual(await verifyPassword(PASSWORD, stored.toUpperCase()), { ok: true, needsRehash: true });
	assert.deepEqual(await verifyPassword("something else", stored), { ok: false, needsRehash: false });
	assert.equal(isPasswordHash(stored), false, "a legacy hash is not the current format");
});

test("the count is read from the stored string; weaker settings ask for a rehash", async () => {
	assert.deepEqual(await verifyPassword(PASSWORD, storedWith(PASSWORD, 1000)), { ok: true, needsRehash: true });
	assert.deepEqual(await verifyPassword("nope", storedWith(PASSWORD, 1000)), { ok: false, needsRehash: false });
	assert.deepEqual(
		await verifyPassword(PASSWORD, storedWith(PASSWORD, PBKDF2_ITERATIONS, 8)),
		{ ok: true, needsRehash: true },
		"a short salt",
	);
	assert.deepEqual(
		await verifyPassword(PASSWORD, storedWith(PASSWORD, PBKDF2_ITERATIONS, 16, 16)),
		{ ok: true, needsRehash: true },
		"a short hash",
	);
	assert.deepEqual(
		await verifyPassword(PASSWORD, storedWith(PASSWORD, PBKDF2_ITERATIONS)),
		{ ok: true, needsRehash: false },
	);
});

test("malformed stored strings are a clean no, never a throw", async () => {
	const good = await hashPassword(PASSWORD);
	const [, , salt, hash] = good.split("$");
	const malformed: unknown[] = [
		"",
		PASSWORD,
		"pbkdf2-sha256",
		"pbkdf2-sha256$$$",
		`pbkdf2-sha256$${salt}$${hash}`,
		`pbkdf2-sha256$100000$${salt}$${hash}$extra`,
		`pbkdf2-sha512$100000$${salt}$${hash}`,
		`pbkdf2-sha256$0$${salt}$${hash}`,
		`pbkdf2-sha256$-5$${salt}$${hash}`,
		`pbkdf2-sha256$1e5$${salt}$${hash}`,
		`pbkdf2-sha256$abc$${salt}$${hash}`,
		`pbkdf2-sha256$99999999999$${salt}$${hash}`,
		`pbkdf2-sha256$100000$not base64!$${hash}`,
		`pbkdf2-sha256$100000$${salt}$`,
		`pbkdf2-sha256$100000$$${hash}`,
		`pbkdf2-sha256$100000$${salt}$AAAA`,
		`pbkdf2-sha256$100000$${salt}$${hash.slice(0, -1)}`,
		legacyHash(PASSWORD).slice(1),
		`${legacyHash(PASSWORD)}0`,
		"z".repeat(64),
		null,
		undefined,
		42,
		{},
	];
	for (const stored of malformed) {
		assert.deepEqual(
			await verifyPassword(PASSWORD, stored as string),
			{ ok: false, needsRehash: false },
			`stored = ${JSON.stringify(stored)}`,
		);
		assert.equal(isPasswordHash(stored), false, `stored = ${JSON.stringify(stored)}`);
	}
	assert.deepEqual(await verifyPassword(undefined as unknown as string, good), { ok: false, needsRehash: false });
});

test("non-ASCII passwords survive the round trip", async () => {
	const password = "pässwörd-密码-🔑";
	const stored = await hashPassword(password);
	assert.equal((await verifyPassword(password, stored)).ok, true);
	assert.equal((await verifyPassword("password-密码-🔑", stored)).ok, false);
	// The legacy format hashed the UTF-8 bytes too.
	assert.equal((await verifyPassword(password, legacyHash(password))).ok, true);
});

test("verifyAndUpgrade: a current hash signs in without an upgrade", async () => {
	const stored = await hashPassword(PASSWORD);
	assert.deepEqual(await verifyAndUpgrade(PASSWORD, stored), { ok: true, upgradedHash: null });
	assert.deepEqual(await verifyAndUpgrade("wrong-password", stored), { ok: false, upgradedHash: null });
});

test("verifyAndUpgrade: a legacy hash signs in and comes back in the current format", async () => {
	const result = await verifyAndUpgrade(PASSWORD, legacyHash(PASSWORD));
	assert.equal(result.ok, true);
	assert.equal(isPasswordHash(result.upgradedHash), true);
	assert.deepEqual(await verifyPassword(PASSWORD, result.upgradedHash as string), { ok: true, needsRehash: false });

	assert.deepEqual(await verifyAndUpgrade("wrong-password", legacyHash(PASSWORD)), { ok: false, upgradedHash: null });
});

test("verifyAndUpgrade: an unknown account or a damaged row is a no", async () => {
	assert.deepEqual(await verifyAndUpgrade(PASSWORD, null), { ok: false, upgradedHash: null });
	assert.deepEqual(await verifyAndUpgrade(PASSWORD, "garbage"), { ok: false, upgradedHash: null });
});

test("verifyAndUpgrade: a legacy account still signs in when the upgrade cannot be computed", async (t) => {
	// If the runtime ever refused the key derivation, the accounts still on the old format (today,
	// all of them) must not be locked out by it.
	const subtle = crypto.subtle;
	const real = subtle.deriveBits;
	t.mock.method(console, "error", () => {});
	subtle.deriveBits = (() => Promise.reject(new Error("iteration counts above 1 are not supported"))) as SubtleCrypto["deriveBits"];
	try {
		assert.deepEqual(await verifyAndUpgrade(PASSWORD, legacyHash(PASSWORD)), { ok: true, upgradedHash: null });
		assert.deepEqual(await verifyAndUpgrade("wrong-password", legacyHash(PASSWORD)), { ok: false, upgradedHash: null });
		assert.deepEqual(await verifyAndUpgrade(PASSWORD, null), { ok: false, upgradedHash: null });
	} finally {
		subtle.deriveBits = real;
	}
});

test("verifyAndUpgrade: every refusal costs a key derivation", async () => {
	// Otherwise the response time would tell an unknown address, or one still on the old format,
	// from an account with a current hash. Counted, not timed, so the test cannot be flaky.
	const subtle = crypto.subtle;
	const real = subtle.deriveBits;
	let derivations = 0;
	subtle.deriveBits = function (...args: Parameters<SubtleCrypto["deriveBits"]>) {
		derivations++;
		return real.apply(subtle, args);
	} as SubtleCrypto["deriveBits"];
	try {
		const current = await hashPassword(PASSWORD);
		const cases: Array<[string, string | null]> = [
			["unknown account", null],
			["legacy hash, wrong password", legacyHash(PASSWORD)],
			["current hash, wrong password", current],
			["damaged row", "garbage"],
		];
		for (const [name, stored] of cases) {
			derivations = 0;
			assert.equal((await verifyAndUpgrade("wrong-password", stored)).ok, false, name);
			assert.equal(derivations, 1, name);
		}

		derivations = 0;
		assert.equal((await verifyAndUpgrade(PASSWORD, legacyHash(PASSWORD))).ok, true);
		assert.equal(derivations, 1, "legacy hash, right password: the upgrade is the derivation");

		derivations = 0;
		assert.equal((await verifyAndUpgrade(PASSWORD, current)).ok, true);
		assert.equal(derivations, 1, "current hash, right password");
	} finally {
		subtle.deriveBits = real;
	}
});
