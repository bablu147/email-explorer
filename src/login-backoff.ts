// When repeated wrong passwords make the server stop listening for a while. Pure and without
// imports: the AUTH object stores one counter per key and asks these functions what it means, so
// the rules are unit-tested without storage.

export interface AttemptCounter {
	/** Attempts counted so far. A successful sign-in deletes the counter. */
	failures: number;
	/** When the first of them happened (ms). */
	firstFailureAt: number;
	/** When the latest of them happened (ms). */
	lastFailureAt: number;
	/** Attempts are refused until this time (ms). 0 when there is no lock. */
	lockedUntil: number;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Wrong passwords in a row, for one address from one place, before the first wait. */
export const FREE_ATTEMPTS = 5;
export const FIRST_LOCK_MS = 30 * SECOND;
export const MAX_LOCK_MS = 15 * MINUTE;
/** A counter with no new failure for this long starts again from zero, and its row can be deleted. */
export const QUIET_RESET_MS = HOUR;

/** Wrong passwords for one address from everywhere, within ACCOUNT_WINDOW_MS, before it is locked. */
export const ACCOUNT_LIMIT = 50;
export const ACCOUNT_WINDOW_MS = HOUR;
export const ACCOUNT_LOCK_MS = 15 * MINUTE;

/**
 * One more failure for an address from one place (or for one user changing a password). The
 * fifth in a row locks for 30 seconds and every further one doubles that, up to 15 minutes.
 */
export function recordAddressFailure(prev: AttemptCounter | null, now: number): AttemptCounter {
	const fresh = !prev || now - prev.lastFailureAt >= QUIET_RESET_MS;
	const failures = fresh ? 1 : prev.failures + 1;
	const doublings = failures - FREE_ATTEMPTS;
	return {
		failures,
		firstFailureAt: fresh ? now : prev.firstFailureAt,
		lastFailureAt: now,
		lockedUntil: doublings >= 0 ? now + Math.min(MAX_LOCK_MS, FIRST_LOCK_MS * 2 ** doublings) : 0,
	};
}

/**
 * One more failure for an address, counted across every place it is tried from. Coarser than the
 * rule above on purpose: it only stops many machines from guessing one account without limit. From
 * the fiftieth failure within an hour, each one locks the address for 15 minutes.
 */
export function recordAccountFailure(prev: AttemptCounter | null, now: number): AttemptCounter {
	const fresh = !prev || now - prev.firstFailureAt >= ACCOUNT_WINDOW_MS;
	const failures = fresh ? 1 : prev.failures + 1;
	return {
		failures,
		firstFailureAt: fresh ? now : prev.firstFailureAt,
		lastFailureAt: now,
		lockedUntil: failures >= ACCOUNT_LIMIT ? now + ACCOUNT_LOCK_MS : 0,
	};
}

/**
 * The part of a client address that one subscriber controls, which is what attempts are counted
 * by. An IPv6 customer is handed a whole /64 and can use any address in it, so counting per full
 * address would give each of those a fresh allowance. IPv4 is counted per address.
 */
export function networkOf(ip: string): string {
	const address = ip.trim().toLowerCase();
	if (!address.includes(":")) return address;
	// "::ffff:1.2.3.4" is an IPv4 client.
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
	if (mapped) return mapped[1];
	const halves = address.split("::");
	if (halves.length > 2) return address;
	const head = halves[0] ? halves[0].split(":") : [];
	const tail = halves[1] ? halves[1].split(":") : [];
	const groups =
		halves.length === 1 ? head : [...head, ...new Array(Math.max(0, 8 - head.length - tail.length)).fill("0"), ...tail];
	if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return address;
	return `${groups
		.slice(0, 4)
		.map((g) => g.replace(/^0+(?=.)/, ""))
		.join(":")}::/64`;
}

/** How much longer attempts are refused, in ms. 0 when they are allowed. */
export function lockedForMs(counter: AttemptCounter | null, now: number): number {
	if (!counter || counter.lockedUntil <= now) return 0;
	return counter.lockedUntil - now;
}

/** The 429 body for a lock with this long left to run. */
export function tooManyAttempts(remainingMs: number): { error: string; retry_after_seconds: number } {
	const seconds = Math.max(1, Math.ceil(remainingMs / SECOND));
	const minutes = Math.ceil(seconds / 60);
	const wait =
		seconds < 60
			? `${seconds} ${seconds === 1 ? "second" : "seconds"}`
			: `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
	return {
		error: `Too many attempts. Try again in ${wait}.`,
		retry_after_seconds: seconds,
	};
}
