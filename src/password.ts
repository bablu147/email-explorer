// Password hashing and checking. WebCrypto only and no imports, so the unit tests can load this
// straight from node.

/**
 * PBKDF2-HMAC-SHA-256 rounds for a new hash. This is the ceiling of the Workers runtime, not a
 * choice: above it, deriveBits fails with "iteration counts above 100000 are not supported".
 * Every stored hash carries its own count and is checked with that count, so raising this later
 * needs nothing else: older hashes keep working and are replaced at the next sign-in.
 */
export const PBKDF2_ITERATIONS = 100_000;

const SCHEME = "pbkdf2-sha256";
const SALT_BYTES = 16;
const HASH_BYTES = 32;

// What accounts created before this format hold: one unsalted SHA-256, as 64 hex characters.
const LEGACY_SHA256 = /^[0-9a-f]{64}$/i;

export interface PasswordCheck {
	ok: boolean;
	/** The password is right, but it is stored in the old format or with weaker settings than today's. */
	needsRehash: boolean;
}

// What WebCrypto takes: bytes over a plain ArrayBuffer, never a shared one.
type Bytes = Uint8Array<ArrayBuffer>;

interface Pbkdf2Hash {
	iterations: number;
	salt: Bytes;
	hash: Bytes;
}

function toBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function fromBase64(text: string): Bytes | null {
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
	try {
		const binary = atob(text);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		// atob accepts sloppy input; only the exact text this module writes is taken.
		return toBase64(bytes) === text ? bytes : null;
	} catch {
		return null;
	}
}

function parsePbkdf2(stored: string): Pbkdf2Hash | null {
	const parts = stored.split("$");
	if (parts.length !== 4 || parts[0] !== SCHEME) return null;
	// At most seven digits: a damaged row must not be able to ask for minutes of CPU.
	if (!/^[1-9][0-9]{0,6}$/.test(parts[1])) return null;
	const salt = fromBase64(parts[2]);
	const hash = fromBase64(parts[3]);
	if (!salt || !hash) return null;
	if (salt.length < 8 || hash.length < 16 || hash.length > 64) return null;
	return { iterations: Number(parts[1]), salt, hash };
}

async function derive(
	password: string,
	salt: Bytes,
	iterations: number,
	bytes: number,
): Promise<Bytes> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", salt, iterations },
		key,
		bytes * 8,
	);
	return new Uint8Array(bits);
}

// Looks at every byte whatever the outcome, so the time taken says nothing about where two
// values differ. The lengths are not secret.
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i];
	}
	return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

/** True for a hash in the current format. Storage uses it to refuse anything else, a plain password included. */
export function isPasswordHash(value: unknown): boolean {
	return typeof value === "string" && parsePbkdf2(value) !== null;
}

/** "pbkdf2-sha256$<iterations>$<salt, base64>$<hash, base64>" with a fresh random salt. */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await derive(password, salt, PBKDF2_ITERATIONS, HASH_BYTES);
	return `${SCHEME}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Checks a password against a stored hash in the current format or the legacy one. A stored value
 * that is neither is a plain "no": this never throws.
 */
export async function verifyPassword(password: string, stored: string): Promise<PasswordCheck> {
	const no: PasswordCheck = { ok: false, needsRehash: false };
	if (typeof password !== "string" || typeof stored !== "string") return no;

	try {
		if (LEGACY_SHA256.test(stored)) {
			const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
			const ok = equalBytes(new Uint8Array(digest), hexToBytes(stored));
			return { ok, needsRehash: ok };
		}

		const parsed = parsePbkdf2(stored);
		if (!parsed) return no;

		const derived = await derive(password, parsed.salt, parsed.iterations, parsed.hash.length);
		if (!equalBytes(derived, parsed.hash)) return no;

		return {
			ok: true,
			needsRehash:
				parsed.iterations < PBKDF2_ITERATIONS ||
				parsed.salt.length < SALT_BYTES ||
				parsed.hash.length < HASH_BYTES,
		};
	} catch (e) {
		// Not a wrong password: the runtime refused the derivation itself (for example a stored count
		// above its ceiling). Still a "no", but logged, because it would otherwise look like a typo.
		console.error("Password check could not run:", e);
		return no;
	}
}

// Matches no password. Checking against it costs exactly what checking a real hash costs.
const DUMMY_HASH = `${SCHEME}$${PBKDF2_ITERATIONS}$${toBase64(new Uint8Array(SALT_BYTES))}$${toBase64(new Uint8Array(HASH_BYTES))}`;

/**
 * The sign-in check. `stored` is null when no account has that address. Every outcome costs one key
 * derivation, so the response time does not reveal whether the address exists or whether its
 * password is still in the old format. `upgradedHash` is set when the password is right but its
 * stored form should be replaced.
 */
export async function verifyAndUpgrade(
	password: string,
	stored: string | null,
): Promise<{ ok: boolean; upgradedHash: string | null }> {
	const check = stored ? await verifyPassword(password, stored) : { ok: false, needsRehash: false };
	if (check.ok) {
		let upgradedHash: string | null = null;
		if (check.needsRehash) {
			try {
				upgradedHash = await hashPassword(password);
			} catch (e) {
				// The password is right. Failing to produce the better hash must not turn that into a
				// failed sign-in: the old one stays, and the next sign-in tries again.
				console.error("Password hash upgrade failed:", e);
			}
		}
		return { ok: true, upgradedHash };
	}
	// A missing account, a legacy hash and a damaged row were all rejected without a derivation.
	if (!stored || !parsePbkdf2(stored)) {
		await verifyPassword(password, DUMMY_HASH);
	}
	return { ok: false, upgradedHash: null };
}
