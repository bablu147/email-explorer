import { defineStore } from "pinia";
import api from "@/services/api";
import type { Email } from "@/types";

/** Page size for the folder list (initial load, infinite-scroll pages and background refresh). */
export const EMAIL_PAGE_SIZE = 50;

const listKeyOf = (mailboxId: string, folder?: string) => `${mailboxId}::${folder ?? ""}`;

const byDateDesc = (a: Email, b: Email) => {
	const ta = new Date(a.date).getTime() || 0;
	const tb = new Date(b.date).getTime() || 0;
	return tb - ta;
};

export const useEmailStore = defineStore("emails", {
	state: () => ({
		emails: [] as Email[],
		currentEmail: null as Email | null,
		isRefreshing: false,
		/** Key (`mailbox::folder`) of the list currently held in `emails`. Empty until the first successful load. */
		listKey: "",
		/** Key of the most recently *requested* list — used to drop out-of-order responses on rapid folder switches. */
		requestedKey: "",
		/** Key whose last load failed (drives the list error/retry state). */
		errorKey: "",
		/** Whether the server may have more (older) messages for `listKey`. */
		hasMore: false,
		isLoadingMore: false,
		/** Last infinite-scroll page request failed (list shows a Retry button). */
		loadMoreFailed: false,
		/**
		 * Bumped on every optimistic local change (move / restore / flag) and again when its request settles.
		 * A background refresh that was requested *before* such a change carries a stale server snapshot and
		 * would resurrect an archived row or revert a flag, so its response is discarded.
		 */
		mutationSeq: 0,
	}),
	actions: {
		listKeyFor(mailboxId: string, folder?: string) {
			return listKeyOf(mailboxId, folder);
		},
		/** Mark that the visible list was changed locally (see `mutationSeq`). */
		noteMutation() {
			this.mutationSeq++;
		},
		/**
		 * Load (or background-refresh) the first page of a folder.
		 * On a refresh of the list already on screen, older pages that were loaded via infinite scroll are
		 * preserved instead of being truncated back to one page.
		 */
		async fetchEmails(mailboxId: string, params: { folder?: string; [k: string]: any } = {}) {
			const key = listKeyOf(mailboxId, params.folder);
			const isSameList = this.listKey === key;
			const seqAtRequest = this.mutationSeq;
			this.requestedKey = key;
			this.isRefreshing = true;
			try {
				const response = await api.listEmails(mailboxId, {
					limit: EMAIL_PAGE_SIZE,
					...params,
				});
				// A newer request for a different folder was issued while this one was in flight — drop it.
				if (this.requestedKey !== key) return;
				// Background refresh of the list on screen, but the user changed it meanwhile: this snapshot
				// predates that change. Keep the local state; the next refresh will reconcile.
				if (isSameList && this.listKey === key && this.mutationSeq !== seqAtRequest) return;
				const fresh: Email[] = Array.isArray(response.data) ? response.data : [];
				const limit = Number(params.limit) || EMAIL_PAGE_SIZE;

				if (isSameList && this.listKey === key && fresh.length >= limit && this.emails.length > fresh.length) {
					// Merge: newest page from the server + any older messages already loaded below it.
					const freshIds = new Set(fresh.map((e) => e.id));
					const oldestFresh = fresh[fresh.length - 1];
					const oldestTs = oldestFresh ? new Date(oldestFresh.date).getTime() : 0;
					const tail = this.emails.filter(
						(e) => !freshIds.has(e.id) && new Date(e.date).getTime() <= oldestTs,
					);
					this.emails = [...fresh, ...tail];
				} else {
					this.emails = fresh;
					this.hasMore = fresh.length >= limit;
					this.loadMoreFailed = false;
				}
				this.listKey = key;
				if (this.errorKey === key) this.errorKey = "";
			} catch (err) {
				if (this.requestedKey === key && this.listKey !== key) {
					this.errorKey = key;
				}
				throw err;
			} finally {
				if (this.requestedKey === key) this.isRefreshing = false;
			}
		},
		/** Infinite scroll: append the next page of older messages for the list on screen. */
		async fetchMoreEmails(mailboxId: string, folder?: string) {
			const key = listKeyOf(mailboxId, folder);
			if (this.listKey !== key || !this.hasMore || this.isLoadingMore) return;
			this.isLoadingMore = true;
			try {
				const response = await api.listEmails(mailboxId, {
					folder,
					limit: EMAIL_PAGE_SIZE,
					offset: this.emails.length,
				});
				if (this.listKey !== key) return;
				const page: Email[] = Array.isArray(response.data) ? response.data : [];
				const known = new Set(this.emails.map((e) => e.id));
				const additions = page.filter((e) => !known.has(e.id));
				this.emails = [...this.emails, ...additions];
				this.hasMore = page.length >= EMAIL_PAGE_SIZE;
				this.loadMoreFailed = false;
			} catch (err) {
				if (this.listKey === key) this.loadMoreFailed = true;
				throw err;
			} finally {
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
		/**
		 * Optimistic flag update (read / starred): flips the flag locally first so the UI reacts instantly,
		 * then persists; rolls back on failure.
		 */
		async patchFlags(mailboxId: string, id: string, data: { read?: boolean; starred?: boolean }) {
			const index = this.emails.findIndex((e) => e.id === id);
			const before = index !== -1 ? { ...this.emails[index] } : null;
			const beforeCurrent =
				this.currentEmail && this.currentEmail.id === id ? { ...this.currentEmail } : null;
			if (index !== -1) this.emails[index] = { ...this.emails[index], ...data };
			if (beforeCurrent) this.currentEmail = { ...(this.currentEmail as Email), ...data };
			this.mutationSeq++;
			try {
				await this.updateEmail(mailboxId, id, data);
			} catch (err) {
				const i = this.emails.findIndex((e) => e.id === id);
				if (before && i !== -1) this.emails[i] = before;
				if (beforeCurrent && this.currentEmail?.id === id) this.currentEmail = beforeCurrent;
				throw err;
			} finally {
				this.mutationSeq++;
			}
		},
		/** Permanently deletes a message (and its attachments). Only offered from Trash. */
		async deleteEmail(mailboxId: string, id: string) {
			await api.deleteEmail(mailboxId, id);
			this.emails = this.emails.filter((email) => email.id !== id);
		},
		async moveEmail(mailboxId: string, id: string, folderId: string) {
			await api.moveEmail(mailboxId, id, folderId);
			this.emails = this.emails.filter((email) => email.id !== id);
		},
		/** Remove messages from the visible list immediately (optimistic move). Returns the removed rows. */
		removeLocal(ids: string[]): Email[] {
			const idSet = new Set(ids);
			const removed = this.emails.filter((e) => idSet.has(e.id));
			this.emails = this.emails.filter((e) => !idSet.has(e.id));
			this.mutationSeq++;
			return removed;
		},
		/** Put previously removed rows back (undo / failed request), keeping date order. */
		restoreLocal(rows: Email[]) {
			if (rows.length === 0) return;
			const known = new Set(this.emails.map((e) => e.id));
			const merged = [...this.emails, ...rows.filter((r) => !known.has(r.id))];
			merged.sort(byDateDesc);
			this.emails = merged;
			this.mutationSeq++;
		},
	},
});
