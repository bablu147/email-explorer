import { defineStore } from "pinia";
import api from "@/services/api";
import type { AppBinding } from "@/types";

export function extractCleanEmail(raw?: string | null): string {
	if (!raw) return "";
	const match = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
	if (match) {
		return match[0].toLowerCase();
	}
	const first = raw.split(",")[0].trim();
	return first.replace(/^["']|["']$/g, "").trim().toLowerCase();
}

export const useAppBindingsStore = defineStore("appBindings", {
	state: () => ({
		bindings: [] as AppBinding[],
		bindingsMap: {} as Record<string, AppBinding>,
		loaded: false,
		loading: false,

		// Modal state
		isModalOpen: false,
		modalEmail: "",
		modalBinding: null as AppBinding | null,
	}),

	getters: {
		getBinding: (state) => (rawEmail?: string | null): AppBinding | null => {
			if (!rawEmail) return null;
			const clean = extractCleanEmail(rawEmail);
			return state.bindingsMap[clean] || null;
		},
	},

	actions: {
		openLinkModal(email: string, binding?: AppBinding | null) {
			const clean = extractCleanEmail(email);
			this.modalEmail = clean;
			this.modalBinding = binding ?? this.bindingsMap[clean] ?? null;
			this.isModalOpen = true;
		},

		closeLinkModal() {
			this.isModalOpen = false;
			this.modalEmail = "";
			this.modalBinding = null;
		},

		async fetchBindings(force = false) {
			if (this.loaded && !force) return;
			this.loading = true;
			try {
				const response = await api.listAppBindings();
				const list: AppBinding[] = response.data?.bindings || response.data || [];
				this.bindings = list;
				const map: Record<string, AppBinding> = {};
				for (const item of list) {
					if (item.email) {
						const clean = extractCleanEmail(item.email);
						if (clean) map[clean] = item;
					}
				}
				this.bindingsMap = map;
				this.loaded = true;
			} catch (e) {
				console.error("Failed to load app bindings", e);
			} finally {
				this.loading = false;
			}
		},

		async saveBinding(binding: {
			email: string;
			app_name: string;
			app_icon_url: string;
			app_url: string;
			platform: AppBinding["platform"];
			developer_name?: string | null;
		}) {
			const clean = extractCleanEmail(binding.email);
			const payload = {
				...binding,
				email: clean,
			};
			const response = await api.saveAppBinding(payload);
			const saved: AppBinding = response.data?.binding || response.data || payload;
			const savedEmail = extractCleanEmail(saved.email);

			this.bindingsMap = {
				...this.bindingsMap,
				[savedEmail]: saved,
			};

			const idx = this.bindings.findIndex(
				(b) => extractCleanEmail(b.email) === savedEmail,
			);
			if (idx >= 0) {
				this.bindings[idx] = saved;
			} else {
				this.bindings.unshift(saved);
			}

			// If modal was open for this email, update modal binding
			if (this.modalEmail === savedEmail) {
				this.modalBinding = saved;
			}

			return saved;
		},

		async deleteBinding(email: string) {
			const clean = extractCleanEmail(email);
			await api.deleteAppBinding(clean);

			const updated = { ...this.bindingsMap };
			delete updated[clean];
			this.bindingsMap = updated;

			this.bindings = this.bindings.filter(
				(b) => extractCleanEmail(b.email) !== clean,
			);

			if (this.modalEmail === clean) {
				this.modalBinding = null;
			}
		},
	},
});
