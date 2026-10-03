import { defineStore } from "pinia";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";
export type SplitViewMode = "split" | "full";

export interface ComposeOptions {
	mode: ComposeMode;
	originalEmail?: any;
	initialBody?: string;
	initialTo?: string;
	initialSubject?: string;
	appBinding?: any;
}

export const useUIStore = defineStore("ui", {
	state: () => ({
		isComposeModalOpen: false,
		composeOptions: {
			mode: "new" as ComposeMode,
			originalEmail: null,
		} as ComposeOptions,
		isMobileSidebarOpen: false,
		splitViewMode: ((typeof localStorage !== "undefined" &&
			localStorage.getItem("reflect_split_view")) as SplitViewMode) || "split",
		sidebarCollapsed: typeof localStorage !== "undefined" &&
			localStorage.getItem("reflect_sidebar_collapsed") === "true",
	}),
	actions: {
		openComposeModal(options?: ComposeOptions) {
			this.composeOptions = options || { mode: "new", originalEmail: null };
			this.isComposeModalOpen = true;
		},
		closeComposeModal() {
			this.isComposeModalOpen = false;
			this.composeOptions = { mode: "new", originalEmail: null };
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
