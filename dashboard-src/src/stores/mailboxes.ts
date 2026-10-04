import { defineStore } from "pinia";
import api from "@/services/api";
import type { Mailbox, MailboxRole } from "@/types";

/** The server's sentence for a refused write, used where the app stops one before asking. */
export const VIEW_ONLY_MESSAGE = "Your access to this mailbox is view-only.";

// The list request in flight, so that everything waiting for the roles waits for the same one.
let listRequest: Promise<void> | null = null;

export const useMailboxStore = defineStore("mailboxes", {
	state: () => ({
		mailboxes: [] as Mailbox[],
		/** The list has been loaded at least once: the roles in it are known. */
		mailboxesLoaded: false,
		currentMailbox: null as Mailbox | null,
		/** The mailbox being opened, set before its details arrive: the role is never the last mailbox's. */
		currentMailboxId: "",
	}),
	getters: {
		/** The signed-in user's role on the current mailbox; null until the mailbox list has it. */
		currentRole(state): MailboxRole | null {
			const id = (state.currentMailboxId || state.currentMailbox?.id || "").toLowerCase();
			if (!id) return null;
			return state.mailboxes.find((mailbox) => mailbox.id.toLowerCase() === id)?.role ?? null;
		},
		/**
		 * False only for a role known to be view-only. An unknown role counts as able to write: the
		 * server enforces the role either way, and this flag only decides which controls are offered.
		 */
		canWrite(): boolean {
			return this.currentRole !== "read";
		},
		/** May change the mailbox's settings. Unknown counts as able, for the same reason as canWrite. */
		canManage(): boolean {
			const role = this.currentRole;
			return role === null || role === "admin" || role === "owner";
		},
	},
	actions: {
		async fetchMailboxes() {
			const response = await api.listMailboxes();
			this.mailboxes = response.data;
			this.mailboxesLoaded = true;
		},
		/** Resolves once the mailbox list has been loaded (it carries the roles). Never rejects. */
		async rolesLoaded() {
			if (this.mailboxesLoaded) return;
			listRequest ??= this.fetchMailboxes()
				.catch(() => {})
				.finally(() => {
					listRequest = null;
				});
			await listRequest;
		},
		async fetchMailbox(id: string) {
			this.currentMailboxId = id;
			const response = await api.getMailbox(id);
			this.currentMailbox = response.data;
		},
		async updateMailbox(id: string, settings: any) {
			const response = await api.updateMailbox(id, settings);
			this.currentMailbox = response.data;
		},
		async deleteMailbox(id: string) {
			await api.deleteMailbox(id);
			this.mailboxes = this.mailboxes.filter((mailbox) => mailbox.id !== id);
		},
	},
});
