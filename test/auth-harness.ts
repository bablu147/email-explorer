// Shared by the auth tests: the real AuthHandler and the real auth migrations on an in-memory SQLite
// database that starts as production is today (passwords as unsalted SHA-256, sessions stored under
// their token, grants typed in any letter case). Not a test file itself.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { TestContext } from "node:test";
import { DOQB } from "workers-qb";
import { AuthHandler } from "../src/durableObject/auth.ts";
import { authMigrations } from "../src/durableObject/migrations.ts";

export const T0 = 1_760_000_000_000;
export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const PASSWORD = "correct-horse-battery";
/** How passwords were stored before this release, and how session ids are derived now. */
export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** A session token as issued before this release: the row id is the token itself. */
export const LEGACY_TOKEN = "0b9f3c1e-7a52-4d6b-9e0f-3c2a1b4d5e6f";

// The migrations in place before this release.
const RELEASED = authMigrations.filter((m) => Number.parseInt(m.name, 10) <= 7);

type Binding = string | number | null;

/** Just enough of a Durable Object's SqlStorage: exec() with bindings for the last statement. */
export function sqlStorage(db: DatabaseSync) {
	return {
		exec(query: string, ...bindings: Binding[]) {
			const statements = query
				.split(";")
				.map((s) => s.trim())
				.filter(Boolean);
			for (const statement of statements.slice(0, -1)) db.exec(statement);

			// workers-qb numbers its placeholders (?1, ?2); node:sqlite binds only plain ones by position.
			let seen = 0;
			const last = statements[statements.length - 1].replace(/\?(\d+)/g, (_match, index) => {
				assert.equal(Number(index), ++seen, "numbered placeholders are in order");
				return "?";
			});

			const prepared = db.prepare(last);
			let rows: Array<Record<string, unknown>> = [];
			let rowsWritten = 0;
			if (/^(SELECT|WITH)\b/i.test(last)) {
				rows = prepared.all(...bindings) as Array<Record<string, unknown>>;
			} else {
				rowsWritten = Number(prepared.run(...bindings).changes);
			}
			return { toArray: () => rows, rowsRead: rows.length, rowsWritten };
		},
	};
}

export interface Store {
	db: DatabaseSync;
	auth: AuthHandler;
	rows: (query: string, ...bindings: Binding[]) => Array<Record<string, unknown>>;
	/** Applies every auth migration that has not run yet, as the object's constructor does. */
	migrate: () => void;
}

/** A database as production has it today, not yet migrated to this release. */
export function unmigratedStore(): Store {
	const db = new DatabaseSync(":memory:");
	const sql = sqlStorage(db);
	// biome-ignore lint/suspicious/noExplicitAny: a test double for SqlStorage
	const qb = new DOQB(sql as any);
	qb.migrations({ migrations: RELEASED }).apply();
	return {
		db,
		// biome-ignore lint/suspicious/noExplicitAny: a test double for SqlStorage
		auth: new AuthHandler(sql as any, qb, true),
		rows: (query, ...bindings) => sql.exec(query, ...bindings).toArray(),
		migrate: () => {
			qb.migrations({ migrations: authMigrations }).apply();
		},
	};
}

export function insertLegacyUser(store: Store, id: string, email: string, isAdmin: boolean, at = T0 - 90 * DAY) {
	store.rows(
		"INSERT INTO users (id, email, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		id,
		email,
		sha256(PASSWORD),
		isAdmin ? 1 : 0,
		at,
		at,
	);
}

/**
 * Today's production shape with this release's migrations applied on top: an admin whose address
 * was typed in mixed case, a member, one live pre-release session of the admin, and two grants.
 */
export function store(): Store {
	const s = unmigratedStore();
	insertLegacyUser(s, "admin-id", "Admin@Reflect.cloud", true);
	insertLegacyUser(s, "member-id", "member@reflect.cloud", false, T0 - 60 * DAY);
	s.rows(
		"INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
		LEGACY_TOKEN,
		"admin-id",
		T0 + 10 * DAY,
		T0 - 20 * DAY,
	);
	s.rows("INSERT INTO user_mailboxes (user_id, mailbox_id, role) VALUES ('member-id', 'Support@Reflect.cloud', 'read')");
	s.rows("INSERT INTO user_mailboxes (user_id, mailbox_id, role) VALUES ('member-id', 'sales@reflect.cloud', 'owner')");
	s.migrate();
	return s;
}

/** Freezes Date.now() for the test; move it with t.mock.timers.setTime(). */
export function at(t: TestContext, now: number) {
	t.mock.timers.enable({ apis: ["Date"], now });
}
