import assert from "node:assert/strict";
import { networkOf } from "../src/login-backoff.ts";
import { test } from "node:test";
import {
	ACCOUNT_LIMIT,
	ACCOUNT_LOCK_MS,
	ACCOUNT_WINDOW_MS,
	type AttemptCounter,
	FIRST_LOCK_MS,
	FREE_ATTEMPTS,
	lockedForMs,
	MAX_LOCK_MS,
	QUIET_RESET_MS,
	recordAccountFailure,
	recordAddressFailure,
	tooManyAttempts,
} from "../src/login-backoff.ts";

const T0 = 1_700_000_000_000;
const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Fails `count` times, each one the moment the previous lock (if any) ends. */
function failRepeatedly(
	record: (prev: AttemptCounter | null, now: number) => AttemptCounter,
	count: number,
): { counter: AttemptCounter; now: number; locks: number[] } {
	let counter: AttemptCounter | null = null;
	let now = T0;
	const locks: number[] = [];
	for (let i = 0; i < count; i++) {
		now = Math.max(now + 1, counter ? counter.lockedUntil : 0);
		counter = record(counter, now);
		locks.push(lockedForMs(counter, now));
	}
	return { counter: counter as AttemptCounter, now, locks };
}

test("the limits are the ones the plan asks for", () => {
	assert.equal(FREE_ATTEMPTS, 5);
	assert.equal(FIRST_LOCK_MS, 30 * SECOND);
	assert.equal(MAX_LOCK_MS, 15 * MINUTE);
	assert.equal(QUIET_RESET_MS, 60 * MINUTE);
	assert.equal(ACCOUNT_LIMIT, 50);
	assert.equal(ACCOUNT_WINDOW_MS, 60 * MINUTE);
	assert.equal(ACCOUNT_LOCK_MS, 15 * MINUTE);
});

test("no counter means no lock", () => {
	assert.equal(lockedForMs(null, T0), 0);
});

test("the first four failures do not lock; the fifth locks for 30 seconds", () => {
	const { locks, counter } = failRepeatedly(recordAddressFailure, 5);
	assert.deepEqual(locks, [0, 0, 0, 0, 30 * SECOND]);
	assert.equal(counter.failures, 5);
});

test("each further failure doubles the lock, up to 15 minutes", () => {
	const { locks } = failRepeatedly(recordAddressFailure, 14);
	assert.deepEqual(
		locks.slice(4).map((ms) => ms / SECOND),
		[30, 60, 120, 240, 480, 900, 900, 900, 900, 900],
	);
});

test("a lock runs out, and the remaining time counts down", () => {
	const { counter, now } = failRepeatedly(recordAddressFailure, 5);
	assert.equal(lockedForMs(counter, now), 30 * SECOND);
	assert.equal(lockedForMs(counter, now + 10 * SECOND), 20 * SECOND);
	assert.equal(lockedForMs(counter, now + 30 * SECOND - 1), 1);
	assert.equal(lockedForMs(counter, now + 30 * SECOND), 0);
	assert.equal(lockedForMs(counter, now + 60 * MINUTE), 0);
});

test("an hour of quiet starts the count again", () => {
	const { counter, now } = failRepeatedly(recordAddressFailure, 9);
	assert.equal(counter.failures, 9);

	const stillCounting = recordAddressFailure(counter, now + QUIET_RESET_MS - 1);
	assert.equal(stillCounting.failures, 10);
	assert.equal(lockedForMs(stillCounting, now + QUIET_RESET_MS - 1), MAX_LOCK_MS);

	const later = now + QUIET_RESET_MS;
	const fresh = recordAddressFailure(counter, later);
	assert.deepEqual(fresh, { failures: 1, firstFailureAt: later, lastFailureAt: later, lockedUntil: 0 });
});

test("an absurd failure count still locks for 15 minutes, not forever", () => {
	const counter: AttemptCounter = { failures: 5000, firstFailureAt: T0, lastFailureAt: T0, lockedUntil: 0 };
	const next = recordAddressFailure(counter, T0 + 1);
	assert.equal(lockedForMs(next, T0 + 1), MAX_LOCK_MS);
	assert.ok(Number.isFinite(next.lockedUntil));
});

test("the account-wide rule locks at the fiftieth failure within an hour", () => {
	let counter: AttemptCounter | null = null;
	for (let i = 1; i <= 49; i++) {
		counter = recordAccountFailure(counter, T0 + i * SECOND);
		assert.equal(lockedForMs(counter, T0 + i * SECOND), 0, `failure ${i}`);
	}
	const at = T0 + 50 * SECOND;
	counter = recordAccountFailure(counter, at);
	assert.equal(counter.failures, 50);
	assert.equal(lockedForMs(counter, at), ACCOUNT_LOCK_MS);

	// Still inside the hour once the lock ends: the next failure locks again straight away.
	const afterLock = at + ACCOUNT_LOCK_MS;
	assert.equal(lockedForMs(counter, afterLock), 0);
	const again = recordAccountFailure(counter, afterLock);
	assert.equal(again.failures, 51);
	assert.equal(lockedForMs(again, afterLock), ACCOUNT_LOCK_MS);
});

test("the account-wide count starts again an hour after its first failure", () => {
	let counter: AttemptCounter | null = null;
	for (let i = 0; i < 49; i++) {
		counter = recordAccountFailure(counter, T0 + i * MINUTE);
	}
	assert.equal((counter as AttemptCounter).failures, 49);
	assert.equal((counter as AttemptCounter).firstFailureAt, T0);

	const later = T0 + ACCOUNT_WINDOW_MS;
	const fresh = recordAccountFailure(counter, later);
	assert.deepEqual(fresh, { failures: 1, firstFailureAt: later, lastFailureAt: later, lockedUntil: 0 });
});

test("slow failures spread over more than an hour never lock the account-wide rule", () => {
	let counter: AttemptCounter | null = null;
	for (let i = 0; i < 200; i++) {
		const now = T0 + i * 2 * MINUTE;
		counter = recordAccountFailure(counter, now);
		assert.equal(lockedForMs(counter, now), 0);
	}
});

test("the 429 body says how long to wait", () => {
	assert.deepEqual(tooManyAttempts(30 * SECOND), {
		error: "Too many attempts. Try again in 30 seconds.",
		retry_after_seconds: 30,
	});
	assert.deepEqual(tooManyAttempts(29_001), {
		error: "Too many attempts. Try again in 30 seconds.",
		retry_after_seconds: 30,
	});
	assert.deepEqual(tooManyAttempts(1), {
		error: "Too many attempts. Try again in 1 second.",
		retry_after_seconds: 1,
	});
	assert.deepEqual(tooManyAttempts(60 * SECOND), {
		error: "Too many attempts. Try again in 1 minute.",
		retry_after_seconds: 60,
	});
	assert.deepEqual(tooManyAttempts(61 * SECOND), {
		error: "Too many attempts. Try again in 2 minutes.",
		retry_after_seconds: 61,
	});
	assert.deepEqual(tooManyAttempts(15 * MINUTE), {
		error: "Too many attempts. Try again in 15 minutes.",
		retry_after_seconds: 900,
	});
	// Never "0 seconds", whatever arrives.
	assert.equal(tooManyAttempts(0).retry_after_seconds, 1);
	assert.equal(tooManyAttempts(-5).retry_after_seconds, 1);
});

test("attempts are counted per IPv4 address and per IPv6 /64", () => {
	assert.equal(networkOf("203.0.113.7"), "203.0.113.7");
	assert.equal(networkOf(" 203.0.113.7 "), "203.0.113.7");
	// Every address in a /64 belongs to one subscriber, however it is written.
	assert.equal(networkOf("2001:db8:1:2::1"), "2001:db8:1:2::/64");
	assert.equal(networkOf("2001:0DB8:0001:0002:aaaa:bbbb:cccc:dddd"), "2001:db8:1:2::/64");
	assert.equal(networkOf("2001:db8:1:2:ffff:ffff:ffff:ffff"), networkOf("2001:db8:1:2::9"));
	assert.notEqual(networkOf("2001:db8:1:3::1"), networkOf("2001:db8:1:2::1"));
	assert.equal(networkOf("::1"), "0:0:0:0::/64");
	assert.equal(networkOf("::ffff:203.0.113.7"), "203.0.113.7", "an IPv4 client seen through IPv6");
	// Anything unexpected is used as it is: a key, never an error.
	for (const odd of ["unknown", "", "2001:db8:::1", "zz::1", "1:2:3:4:5:6:7:8:9"]) assert.equal(networkOf(odd), odd);
});
