import { defineStore } from "pinia";
import api from "@/services/api";
import type { Email } from "@/types";
import { settleAll } from "@/utils/concurrency";

/** Page size for the folder list (initial load, infinite-scroll pages and background refresh). */
export const EMAIL_PAGE_SIZE = 50;

const listKeyOf = (mailboxId: string, folder?: string) => `${mailboxId}::${folder ?? ""}`;

/** Same total order as the server (`date DESC, id DESC`). */
const byDateDesc = (a: Email, b: Email) => {
	const ta = new Date(a.date).getTime() || 0;
	const tb = new Date(b.date).getTime() || 0;
	if (tb !== ta) return tb - ta;
	return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
};

type FlagPatch = { read?: boolean; starred?: boolean };

/**
 * Journal of optimistic local changes, used to reconcile server snapshots instead of discarding them.
 *
 * A list response reflects the server *at the moment it was read*. Any local change whose request had
 * not finished by the time that list request was issued may be missing from it (an archived row would
 * reappear, a star would flip back). Rather than throwing such a snapshot away — which, while you keep
 * triaging, meant new mail never showed up — the response is accepted and those changes are re-applied
 * on top of it. All operations are idempotent, so re-applying a change the server already has is a no-op.
 *
 * Kept outside reactive state on purpose: it's bookkeeping, not UI.
 */
interface LocalChange {
	kind: "remove" | "restore" | "flags";
	/** `remove` / `restore` are folder specific. `flags` apply to the message in every list. */
	listKey: string;
	ids: Set<string>;
	rows?: Email[];
	data?: FlagPatch;
	/** Clock value when the change's request finished; `null` while still in flight. */
	settledAt: number | null;
	settledWall: number;
}

let clock = 0;
const tick = () => ++clock;
let journal: LocalChange[] = [];
/** Clock value of the most recently issued first-page request; older responses are dropped. */
let latestIssued = 0;

const record = (change: Omit<LocalChange, "settledAt" | "settledWall">, settled: boolean): LocalChange => {
	const entry: LocalChange = { ...change, settledAt: settled ? tick() : null, settledWall: Date.now() };
	journal.push(entry);
	return entry;
};
const settle = (entry: LocalChange) => {
	if (entry.settledAt === null) {
		entry.settledAt = tick();
		entry.settledWall = Date.now();
	}
};
const forget = (entry: LocalChange) => {
	journal = journal.filter((c) => c !== entry);
};
/** Drop entries no future response can need (settled before the last applied request was issued). */
const prune = (appliedIssuedAt: number) => {
	// An infinite-scroll page issued earlier may still be in flight and need older entries.
	const threshold = pageIssuedAt !== null ? Math.min(appliedIssuedAt, pageIssuedAt) : appliedIssuedAt;
	const staleWall = Date.now() - 5 * 60_000;
	journal = journal.filter(
		(c) => c.settledAt === null || (c.settledAt > threshold && c.settledWall > staleWall),
	);
};
/** Clock value of the infinite-scroll page request in flight (at most one at a time). */
let pageIssuedAt: number | null = null;

/** Re-apply local changes that a response issued at `issuedAt` may not include. */
const reconcile = (rows: Email[], key: string, issuedAt: number, insertRestored: boolean): Email[] => {
	let out = rows;
	for (const c of journal) {
		if (c.settledAt !== null && c.settledAt < issuedAt) continue;
		if (c.kind === "flags") {
			out = out.map((e) => (c.ids.has(e.id) ? { ...e, ...c.data } : e));
			continue;
		}
		if (c.listKey !== key) continue;
		if (c.kind === "remove") {
			out = out.filter((e) => !c.ids.has(e.id));
		} else if (insertRestored && c.rows) {
			const known = new Set(out.map((e) => e.id));
			const missing = c.rows.filter((r) => !known.has(r.id));
			if (missing.length > 0) out = [...out, ...missing].sort(byDateDesc);
		}
	}
	return out;
};

/** Handle for an optimistic change whose server request is still running. */
export interface PendingChange {
	rows: Email[];
	/** Call once the request has finished (success or failure). */
	settle: () => void;
}

export const useEmailStore = defineStore("emails", {
	state: () => ({
		emails: [] as Email[],
		currentEmail: null as Email | null,
		isRefreshing: false,
		/** Key (`mailbox::folder`) of the list currently held in `emails`. Empty until the first successful load. */
		listKey: "",
		/** Key of the most recently *requested* list. */
		requestedKey: "",
		/** Key whose last load failed (drives the list error/retry state). */
		errorKey: "",
		/** Whether the server may have more (older) messages for `listKey`. */
		hasMore: false,
		isLoadingMore: false,
		/** Last infinite-scroll page request failed (list shows a Retry button). */
		loadMoreFailed: false,
		/**
		 * Keyset cursor: (date, id) of the oldest row the *server* has returned for `listKey`.
		 * Paging continues strictly after it, so messages archived/moved between pages can't shift the
		 * window and make a row get skipped (which a row offset would).
		 */
		cursor: null as { date: string; id: string } | null,
	}),
	actions: {
		listKeyFor(mailboxId: string, folder?: string) {
			return listKeyOf(mailboxId, folder);
		},
		/**
		 * Load (or background-refresh) the first page of a folder.
		 * On a refresh of the list already on screen, older pages that were loaded via infinite scroll are
		 * preserved instead of being truncated back to one page, and local changes still in flight are
		 * re-applied on top of the server snapshot (see `LocalChange`).
		 */
		async fetchEmails(mailboxId: string, params: { folder?: string; [k: string]: any } = {}) {
			const key = listKeyOf(mailboxId, params.folder);
			const issuedAt = tick();
			latestIssued = issuedAt;
			this.requestedKey = key;
			this.isRefreshing = true;
			try {
				const response = await api.listEmails(mailboxId, {
					limit: EMAIL_PAGE_SIZE,
					...params,
				});
				// A newer list request (other folder, or a later refresh of this one) was issued meanwhile.
				if (issuedAt !== latestIssued) return;
				const serverRows: Email[] = Array.isArray(response.data) ? response.data : [];
				const limit = Number(params.limit) || EMAIL_PAGE_SIZE;
				const oldestServer = serverRows[serverRows.length - 1];
				const fresh = reconcile(serverRows, key, issuedAt, true);
				const isSameList = this.listKey === key;

				if (isSameList && serverRows.length >= limit && this.emails.length > fresh.length) {
					// Merge: newest page from the server + older messages already loaded below it.
					const freshIds = new Set(fresh.map((e) => e.id));
					const oldestTs = oldestServer ? new Date(oldestServer.date).getTime() : 0;
					const tail = this.emails.filter(
						(e) => !freshIds.has(e.id) && new Date(e.date).getTime() <= oldestTs,
					);
					this.emails = [...fresh, ...tail];
					// Keep paging from the oldest row already fetched, not from the top page.
					if (!this.cursor && oldestServer) this.cursor = { date: oldestServer.date, id: oldestServer.id };
				} else {
					this.emails = fresh;
					this.hasMore = serverRows.length >= limit;
					this.loadMoreFailed = false;
					this.cursor = oldestServer ? { date: oldestServer.date, id: oldestServer.id } : null;
				}
				this.listKey = key;
				if (this.errorKey === key) this.errorKey = "";
				prune(issuedAt);
			} catch (err) {
				if (issuedAt === latestIssued && this.listKey !== key) {
					this.errorKey = key;
				}
				throw err;
			} finally {
				if (issuedAt === latestIssued) this.isRefreshing = false;
			}
		},
		/** Infinite scroll: append the next page of older messages for the list on screen. */
		async fetchMoreEmails(mailboxId: string, folder?: string) {
			const key = listKeyOf(mailboxId, folder);
			if (this.listKey !== key || !this.hasMore || this.isLoadingMore) return;
			const cursor = this.cursor;
			const issuedAt = tick();
			pageIssuedAt = issuedAt;
			this.isLoadingMore = true;
			try {
				const response = await api.listEmails(mailboxId, {
					folder,
					limit: EMAIL_PAGE_SIZE,
					// Cursor when we have one; offset is the backwards-compatible fallback.
					...(cursor ? { before_date: cursor.date, before_id: cursor.id } : { offset: this.emails.length }),
				});
				// Folder changed, or a refresh replaced the list (and its cursor) meanwhile: appending this
				// page could leave a gap, so drop it; the scroll sentinel will request the right page.
				if (this.listKey !== key || this.cursor !== cursor) return;
				const page: Email[] = Array.isArray(response.data) ? response.data : [];
				const last = page[page.length - 1];
				if (last) this.cursor = { date: last.date, id: last.id };
				const known = new Set(this.emails.map((e) => e.id));
				const additions = reconcile(page, key, issuedAt, false).filter((e) => !known.has(e.id));
				this.emails = [...this.emails, ...additions];
				this.hasMore = page.length >= EMAIL_PAGE_SIZE;
				this.loadMoreFailed = false;
			} catch (err) {
				if (this.listKey === key) this.loadMoreFailed = true;
				throw err;
			} finally {
				pageIssuedAt = null;
				this.isLoadingMore = false;
			}
		},
		async fetchEmail(mailboxId: string, id: string) {
			const response = await api.getEmail(mailboxId, id);
			this.currentEmail = response.data;
		},
		async sendEmail(mailboxId: string, email: any) {
			await api.sendEmail(mailboxId, email);
		},
		async updateEmail(mailboxId: string, id: string, data: any) {
			const response = await api.updateEmail(mailboxId, id, data);
			const updatedEmail = response.data;
			const index = this.emails.findIndex((email) => email.id === id);
			if (index !== -1) {
				this.emails[index] = { ...this.emails[index], ...updatedEmail };
			}
			if (this.currentEmail && this.currentEmail.id === id) {
				this.currentEmail = { ...this.currentEmail, ...updatedEmail };
			}
		},
		/** Set flags on local copies (list row + open message) without touching the server. */
		applyFlagsLocal(ids: Iterable<string>, data: FlagPatch) {
			const set = ids instanceof Set ? (ids as Set<string>) : new Set(ids);
			this.emails = this.emails.map((e) => (set.has(e.id) ? { ...e, ...data } : e));
			if (this.currentEmail && set.has(this.currentEmail.id)) {
				this.currentEmail = { ...this.currentEmail, ...data };
			}
		},
		/**
		 * Optimistic flag update (read / starred) for any number of messages: every row flips immediately,
		 * then the requests go out with bounded concurrency. Failed rows are rolled back (unless the user
		 * changed them again meanwhile). Returns the ids that failed.
		 */
		async patchFlagsMany(mailboxId: string, ids: string[], data: FlagPatch, concurrency = 6): Promise<string[]> {
			const idSet = new Set(ids);
			const unique = Array.from(idSet);
			if (unique.length === 0) return [];
			const fields = Object.keys(data) as (keyof FlagPatch)[];
			const pick = (e: Email): FlagPatch => Object.fromEntries(fields.map((f) => [f, e[f]]));
			// Previous values, for rollback.
			const before = new Map<string, FlagPatch>();
			for (const e of this.emails) {
				if (idSet.has(e.id)) before.set(e.id, pick(e));
			}
			if (this.currentEmail && idSet.has(this.currentEmail.id) && !before.has(this.currentEmail.id)) {
				before.set(this.currentEmail.id, pick(this.currentEmail));
			}

			this.applyFlagsLocal(idSet, data);
			const entry = record({ kind: "flags", listKey: this.listKey, ids: new Set(unique), data }, false);

			const results = await settleAll(unique, (id) => api.updateEmail(mailboxId, id, data), concurrency);
			const failed = unique.filter((_, i) => results[i].status === "rejected");

			if (failed.length > 0) {
				for (const id of failed) entry.ids.delete(id);
				if (entry.ids.size === 0) forget(entry);
				// Roll back only rows that still show the value we set (a later toggle wins).
				const stillOurs = (e: Email) => fields.every((f) => e[f] === data[f]);
				for (const id of failed) {
					const prev = before.get(id);
					if (!prev) continue;
					const i = this.emails.findIndex((e) => e.id === id);
					if (i !== -1 && stillOurs(this.emails[i])) this.emails[i] = { ...this.emails[i], ...prev };
					if (this.currentEmail?.id === id && stillOurs(this.currentEmail)) {
						this.currentEmail = { ...this.currentEmail, ...prev };
					}
				}
			}
			settle(entry);
			return failed;
		},
		/** Single-message optimistic flag update; throws if the server rejected it (after rolling back). */
		async patchFlags(mailboxId: string, id: string, data: FlagPatch) {
			const failed = await this.patchFlagsMany(mailboxId, [id], data);
			if (failed.length > 0) throw new Error(`Couldn't update message ${id}`);
		},
		/** Permanently deletes a message (and its attachments). Only offered from Trash. */
		async deleteEmail(mailboxId: string, id: string) {
			await api.deleteEmail(mailboxId, id);
			this.removeLocal([id], { settled: true });
		},
		async moveEmail(mailboxId: string, id: string, folderId: string) {
			await api.moveEmail(mailboxId, id, folderId);
			this.removeLocal([id], { settled: true });
		},
		/**
		 * Remove messages from the visible list immediately (optimistic move / delete).
		 * Unless `settled`, call `settle()` on the result once the server request has finished, so background
		 * refreshes that raced with it don't bring the rows back.
		 */
		removeLocal(ids: string[], opts: { settled?: boolean } = {}): PendingChange {
			const idSet = new Set(ids);
			const rows = this.emails.filter((e) => idSet.has(e.id));
			this.emails = this.emails.filter((e) => !idSet.has(e.id));
			const entry = record({ kind: "remove", listKey: this.listKey, ids: idSet }, !!opts.settled);
			return { rows, settle: () => settle(entry) };
		},
		/** Put previously removed rows back (undo / failed request), keeping date order. */
		restoreLocal(rows: Email[], opts: { settled?: boolean } = {}): PendingChange {
			const entry = record(
				{ kind: "restore", listKey: this.listKey, ids: new Set(rows.map((r) => r.id)), rows },
				!!opts.settled,
			);
			if (rows.length > 0) {
				const known = new Set(this.emails.map((e) => e.id));
				const merged = [...this.emails, ...rows.filter((r) => !known.has(r.id))];
				merged.sort(byDateDesc);
				this.emails = merged;
			}
			return { rows, settle: () => settle(entry) };
		},
	},
});
