import { defineStore } from "pinia";
import type { OutgoingAttachment } from "@/types";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward" | "draft";
export type SplitViewMode = "split" | "full";

export interface ComposeOptions {
	mode: ComposeMode;
	originalEmail?: any;
	/** HTML, placed above the signature (new) or the quote (reply). */
	initialBody?: string;
	/** initialBody is text the user typed that now exists only in the composer: closing asks first. */
	initialBodyUnsaved?: boolean;
	initialTo?: string;
	initialSubject?: string;
	appBinding?: any;
}

/** Everything needed to put the composer back exactly as it was (Undo, or a failed send). */
export interface ComposeSnapshot {
	options: ComposeOptions;
	to: string;
	cc: string;
	bcc: string;
	showCc: boolean;
	showBcc: boolean;
	subject: string;
	body: string;
	attachments: OutgoingAttachment[];
	inlineAttachments: any[];
	currentDraftId: string | null;
}

/** A message on its way back into the composer, and why (shown there) when a send failed. */
export interface ComposeRestore {
	snapshot: ComposeSnapshot;
	error?: string;
}

export const useUIStore = defineStore("ui", {
	state: () => ({
		isComposeModalOpen: false,
		composeOptions: {
			mode: "new" as ComposeMode,
			originalEmail: null,
		} as ComposeOptions,
		// Held here, not in the composer: that component is destroyed when it closes on Send, so a
		// send that fails afterwards can only hand the message back to the next instance through the store.
		composeRestore: null as ComposeRestore | null,
		isMobileSidebarOpen: false,
		isCommandPaletteOpen: false,
		splitViewMode: ((typeof localStorage !== "undefined" &&
			localStorage.getItem("reflect_split_view")) as SplitViewMode) || "split",
		splitPaneWidth:
			(typeof localStorage !== "undefined" &&
				parseInt(localStorage.getItem("reflect_split_pane_width") || "480", 10)) ||
			480,
		sidebarCollapsed: typeof localStorage !== "undefined" &&
			localStorage.getItem("reflect_sidebar_collapsed") === "true",
	}),
	actions: {
		openCommandPalette() {
			this.isCommandPaletteOpen = true;
		},
		closeCommandPalette() {
			this.isCommandPaletteOpen = false;
		},
		toggleCommandPalette() {
			this.isCommandPaletteOpen = !this.isCommandPaletteOpen;
		},
		openComposeModal(options?: ComposeOptions) {
			this.composeOptions = options || { mode: "new", originalEmail: null };
			this.isComposeModalOpen = true;
		},
		closeComposeModal() {
			this.isComposeModalOpen = false;
			this.composeOptions = { mode: "new", originalEmail: null };
		},
		/** Reopen the composer with a message that was not sent; the composer that opens applies it. */
		restoreComposeModal(restore: ComposeRestore) {
			this.composeRestore = restore;
			this.composeOptions = restore.snapshot.options;
			this.isComposeModalOpen = true;
		},
		/** Hands the waiting message to the composer that is opening (once). */
		takeComposeRestore(): ComposeRestore | null {
			const restore = this.composeRestore;
			this.composeRestore = null;
			return restore;
		},
		toggleMobileSidebar() {
			this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
		},
		openMobileSidebar() {
			this.isMobileSidebarOpen = true;
		},
		closeMobileSidebar() {
			this.isMobileSidebarOpen = false;
		},
		setSplitViewMode(mode: SplitViewMode) {
			this.splitViewMode = mode;
			if (typeof localStorage !== "undefined") {
				localStorage.setItem("reflect_split_view", mode);
			}
		},
		setSplitPaneWidth(width: number) {
			const clamped = Math.max(320, Math.min(width, 900));
			this.splitPaneWidth = clamped;
			if (typeof localStorage !== "undefined") {
				localStorage.setItem("reflect_split_pane_width", String(clamped));
			}
		},
		toggleSplitViewMode() {
			const nextMode = this.splitViewMode === "split" ? "full" : "split";
			this.setSplitViewMode(nextMode);
		},
		toggleSidebarCollapsed() {
			this.sidebarCollapsed = !this.sidebarCollapsed;
			if (typeof localStorage !== "undefined") {
				localStorage.setItem("reflect_sidebar_collapsed", String(this.sidebarCollapsed));
			}
		},
	},
});
