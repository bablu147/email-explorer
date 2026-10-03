import { defineStore } from "pinia";
import api from "@/services/api";
import { useAppBindingsStore } from "./appBindings";
import { renderTemplate, useTemplatesStore } from "./templates";
import { useUIStore } from "./ui";
import type {
	DiscoveredApp,
	DiscoverChart,
	DiscoverLead,
	DiscoverPlatform,
	DiscoverStats,
} from "@/types";

export const useDiscoverStore = defineStore("discover", {
	state: () => ({
		apps: [] as DiscoveredApp[],
		leads: [] as DiscoverLead[],
		savedLeadIds: {} as Record<string, boolean>,
		loading: false,
		leadsLoading: false,
		loadingMore: false,
		hasMore: true,
		savingLeadIds: {} as Record<string, boolean>,
		error: null as string | null,
		total: 0,
		stats: {
			total_discovered: 0,
			verified_emails: 0,
			contacted: 0,
			saved_targets: 0,
		} as DiscoverStats,

		// Filters
		filters: {
			platform: "all" as DiscoverPlatform,
			country: "US",
			chart: "topgrossing" as DiscoverChart,
			category: "all",
			query: "",
			limit: 24,
			page: 1,
			activeTab: "discover" as "discover" | "leads",
			viewMode: "grid" as "grid" | "table",
		},
	}),

	getters: {
		isSaved: (state) => (id: string, bundleId?: string, platform?: string): boolean => {
			if (state.savedLeadIds[id]) return true;
			if (bundleId && platform && state.savedLeadIds[`${platform}_${bundleId}`]) return true;
			return false;
		},

		displayedApps: (state): DiscoveredApp[] => {
			if (state.filters.activeTab === "leads") {
				let list = [...state.leads];
				if (state.filters.platform !== "all") {
					list = list.filter((a) => a.platform === state.filters.platform);
				}
				if (state.filters.category !== "all") {
					const cat = state.filters.category.toLowerCase().trim();
					list = list.filter((a) => a.category && a.category.toLowerCase().includes(cat));
				}
				if (state.filters.query.trim()) {
					const q = state.filters.query.toLowerCase().trim();
					list = list.filter(
						(a) =>
							a.app_name.toLowerCase().includes(q) ||
							(a.developer_name && a.developer_name.toLowerCase().includes(q)) ||
							a.bundle_id.toLowerCase().includes(q) ||
							(a.developer_email && a.developer_email.toLowerCase().includes(q)),
					);
				}
				return list;
			}
			return state.apps;
		},

		totalCount: (state): number => {
			if (state.filters.activeTab === "leads") {
				return state.leads.length;
			}
			return state.apps.length;
		},

		hasVerifiedEmail: () => (app: DiscoveredApp): boolean => {
			return Boolean(app.developer_email && app.developer_email.includes("@"));
		},
	},

	actions: {
		async fetchApps() {
			this.loading = true;
			this.error = null;
			this.filters.page = 1;
			this.hasMore = true;
			try {
				const params: any = {
					platform: this.filters.platform,
					country: this.filters.country,
					chart: this.filters.chart,
					category: this.filters.category,
					limit: this.filters.limit,
					page: 1,
				};
				if (this.filters.query.trim()) {
					params.query = this.filters.query.trim();
				}

				const res = await api.discoverApps(params);
				const data = res.data;

				this.apps = data.apps || [];
				this.total = data.total || this.apps.length;
				this.hasMore = data.has_more !== false && this.apps.length >= Math.min(this.filters.limit, 10);

				// Synchronize saved leads map with returned apps
				for (const app of this.apps) {
					if (app.is_saved) {
						this.savedLeadIds[app.id] = true;
						this.savedLeadIds[`${app.platform}_${app.bundle_id}`] = true;
					}
				}

				const verifiedEmails = this.apps.filter((a) => a.developer_email && a.developer_email.includes("@")).length;
				const contacted = this.apps.filter((a) => a.status === "contacted" || a.status === "opened" || a.status === "bound").length;

				this.stats = {
					total_discovered: this.apps.length,
					verified_emails: verifiedEmails,
					contacted,
					saved_targets: this.leads.length || (data.stats ? data.stats.saved_targets : 0),
				};
			} catch (err: any) {
				console.error("Failed to discover apps", err);
				this.error = err.response?.data?.error || err.message || "Failed to fetch apps";
			} finally {
				this.loading = false;
			}
		},

		async loadMoreApps() {
			if (this.loading || this.loadingMore || !this.hasMore || this.filters.activeTab !== "discover") {
				return;
			}

			this.loadingMore = true;
			try {
				const nextPage = this.filters.page + 1;
				const params: any = {
					platform: this.filters.platform,
					country: this.filters.country,
					chart: this.filters.chart,
					category: this.filters.category,
					limit: this.filters.limit,
					page: nextPage,
				};
				if (this.filters.query.trim()) {
					params.query = this.filters.query.trim();
				}

				const res = await api.discoverApps(params);
				const data = res.data;
				const newApps: DiscoveredApp[] = data.apps || [];

				if (newApps.length === 0) {
					this.hasMore = false;
					return;
				}

				this.filters.page = nextPage;

				// Deduplicate incoming apps against already collected apps
				const existingIds = new Set(this.apps.map((a) => a.id));
				const existingKeys = new Set(this.apps.map((a) => `${a.platform}_${a.bundle_id}`));

				const filteredNew = newApps.filter((a) => {
					const key = `${a.platform}_${a.bundle_id}`;
					if (existingIds.has(a.id) || existingKeys.has(key)) {
						return false;
					}
					existingIds.add(a.id);
					existingKeys.add(key);
					return true;
				});

				this.apps.push(...filteredNew);
				this.hasMore = data.has_more !== false && newApps.length >= Math.min(this.filters.limit, 8);

				// Synchronize saved leads map for new arrivals
				for (const app of filteredNew) {
					if (app.is_saved) {
						this.savedLeadIds[app.id] = true;
						this.savedLeadIds[`${app.platform}_${app.bundle_id}`] = true;
					}
				}

				// Dynamically compute cumulative metric strip numbers
				const verifiedEmails = this.apps.filter((a) => a.developer_email && a.developer_email.includes("@")).length;
				const contacted = this.apps.filter((a) => a.status === "contacted" || a.status === "opened" || a.status === "bound").length;

				this.stats.total_discovered = this.apps.length;
				this.stats.verified_emails = verifiedEmails;
				this.stats.contacted = contacted;
				this.stats.saved_targets = this.leads.length;
			} catch (err: any) {
				console.error("Failed to load more apps", err);
			} finally {
				this.loadingMore = false;
			}
		},

		async fetchLeads() {
			this.leadsLoading = true;
			try {
				const res = await api.getDiscoverLeads();
				const data = res.data;
				this.leads = data.leads || [];

				const savedMap: Record<string, boolean> = {};
				for (const lead of this.leads) {
					savedMap[lead.id] = true;
					if (lead.bundle_id) {
						savedMap[`${lead.platform}_${lead.bundle_id}`] = true;
					}
				}
				this.savedLeadIds = savedMap;
				this.stats.saved_targets = this.leads.length;
			} catch (err: any) {
				console.error("Failed to fetch discover leads", err);
			} finally {
				this.leadsLoading = false;
			}
		},

		async toggleSaveLead(app: DiscoveredApp): Promise<boolean> {
			const id = app.id || `${app.platform}_${app.bundle_id}`;
			const isCurrentlySaved = this.isSaved(id, app.bundle_id, app.platform);

			this.savingLeadIds[id] = true;
			try {
				if (isCurrentlySaved) {
					await api.deleteDiscoverLead(id);
					delete this.savedLeadIds[id];
					delete this.savedLeadIds[`${app.platform}_${app.bundle_id}`];
					this.leads = this.leads.filter((l) => l.id !== id && `${l.platform}_${l.bundle_id}` !== id);

					// Update in current apps list
					const target = this.apps.find((a) => a.id === id || `${a.platform}_${a.bundle_id}` === id);
					if (target) target.is_saved = false;

					this.stats.saved_targets = Math.max(0, this.stats.saved_targets - 1);
					return false;
				} else {
					const payload = {
						id,
						bundle_id: app.bundle_id,
						platform: app.platform,
						app_name: app.app_name,
						app_icon_url: app.app_icon_url,
						app_url: app.app_url,
						developer_name: app.developer_name,
						developer_email: app.developer_email,
						developer_website: app.developer_website,
						installs_bracket: app.installs_bracket,
						rating: app.rating,
						reviews_count: app.reviews_count,
						category: app.category,
						country: app.country || this.filters.country,
						has_iap: app.has_iap,
						has_ads: app.has_ads,
						release_date: app.release_date,
						updated_date: app.updated_date,
						status: app.status || "uncontacted",
						notes: app.notes,
					};

					const res = await api.saveDiscoverLead(payload);
					const savedLead = res.data;

					this.savedLeadIds[id] = true;
					this.savedLeadIds[`${app.platform}_${app.bundle_id}`] = true;

					// Add to leads list if not present
					const existingIdx = this.leads.findIndex((l) => l.id === id);
					if (existingIdx >= 0) {
						this.leads[existingIdx] = savedLead;
					} else {
						this.leads.unshift(savedLead);
					}

					// Update in current apps list
					const target = this.apps.find((a) => a.id === id || `${a.platform}_${a.bundle_id}` === id);
					if (target) target.is_saved = true;

					this.stats.saved_targets = this.leads.length;
					return true;
				}
			} catch (err: any) {
				console.error("Failed to toggle save lead", err);
				throw err;
			} finally {
				delete this.savingLeadIds[id];
			}
		},

		async pitchMMP(app: DiscoveredApp) {
			const uiStore = useUIStore();
			const appBindingsStore = useAppBindingsStore();

			const devEmail = app.developer_email?.trim() || "";
			const devName = app.developer_name?.trim() || `Team ${app.app_name}`;
			const platformName = app.platform === "playstore" ? "Google Play" : "App Store";
			const tractionStr = app.installs_bracket ? ` (${app.installs_bracket} installs)` : "";
			const categoryStr = app.category || "mobile";

			// 1. Automatically bind app to developer email if email exists
			if (devEmail) {
				try {
					await appBindingsStore.saveBinding({
						email: devEmail,
						app_name: app.app_name,
						app_icon_url: app.app_icon_url,
						app_url: app.app_url,
						platform: app.platform,
						developer_name: app.developer_name,
					});
				} catch (e) {
					console.warn("Could not pre-save app binding before pitch", e);
				}
			}

			// 2. Fill the team's pitch template (editable in Settings) with this app's details
			const templatesStore = useTemplatesStore();
			try {
				await templatesStore.load();
			} catch (e) {
				console.warn("Could not load the pitch template", e);
			}
			const pitch = templatesStore.pitch;
			const vars = {
				app_name: app.app_name,
				developer_name: devName,
				platform: platformName,
				category: categoryStr,
				installs: app.installs_bracket || "",
				traction: tractionStr,
			};
			const subject = pitch?.subject ? renderTemplate(pitch.subject, vars) : "";
			const pitchHtml = pitch ? renderTemplate(pitch.body, vars, { html: true }) : "";

			// 3. Open Compose modal pre-populated
			uiStore.openComposeModal({
				mode: "new",
				initialTo: devEmail,
				initialSubject: subject,
				initialBody: pitchHtml,
			});
		},

		exportCsv() {
			const list = this.displayedApps;
			if (list.length === 0) return;

			const headers = [
				"App Name",
				"Platform",
				"Bundle ID",
				"Developer Name",
				"Developer Email",
				"Developer Website",
				"Category",
				"Installs Bracket",
				"Rating",
				"Reviews Count",
				"In-App Purchases",
				"Contains Ads",
				"Release Date",
				"Updated Date",
				"Outreach Status",
				"Store URL",
			];

			const escapeCell = (val: any): string => {
				if (val === null || val === undefined) return '""';
				const str = String(val).replace(/"/g, '""');
				return `"${str}"`;
			};

			const rows = list.map((a) => [
				escapeCell(a.app_name),
				escapeCell(a.platform === "playstore" ? "Google Play" : "App Store"),
				escapeCell(a.bundle_id),
				escapeCell(a.developer_name || ""),
				escapeCell(a.developer_email || ""),
				escapeCell(a.developer_website || ""),
				escapeCell(a.category || ""),
				escapeCell(a.installs_bracket || ""),
				escapeCell(a.rating !== null && a.rating !== undefined ? a.rating : ""),
				escapeCell(a.reviews_count || ""),
				escapeCell(a.has_iap ? "Yes" : "No"),
				escapeCell(a.has_ads ? "Yes" : "No"),
				escapeCell(a.release_date || ""),
				escapeCell(a.updated_date || ""),
				escapeCell(a.status || "uncontacted"),
				escapeCell(a.app_url),
			]);

			const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
			const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			const filename = `reflect-mmp-leads-${this.filters.country}-${this.filters.platform}-${Date.now()}.csv`;
			link.setAttribute("href", url);
			link.setAttribute("download", filename);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		},
	},
});
