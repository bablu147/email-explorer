import type { AppBinding, DiscoverLead } from "../types";

export class BindingsLeadsHandler {
	#sql: SqlStorage;
	#isAuthDO: boolean;

	constructor(sql: SqlStorage, isAuthDO: boolean) {
		this.#sql = sql;
		this.#isAuthDO = isAuthDO;
	}

	async getAllAppBindings(): Promise<AppBinding[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const rows = this.#sql
			.exec(
				"SELECT email, app_name, app_icon_url, app_url, platform, developer_name, created_at, updated_at FROM app_bindings ORDER BY updated_at DESC",
			)
			.toArray();
		return rows.map((r: any) => ({
			email: String(r.email),
			app_name: String(r.app_name),
			app_icon_url: String(r.app_icon_url),
			app_url: String(r.app_url),
			platform: String(r.platform) as any,
			developer_name: r.developer_name ? String(r.developer_name) : null,
			created_at: Number(r.created_at),
			updated_at: Number(r.updated_at),
		}));
	}

	async getAppBinding(email: string): Promise<AppBinding | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const match = email.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
		const cleanEmail = match
			? match[0].toLowerCase()
			: email.split(",")[0].replace(/^["']|["']$/g, "").trim().toLowerCase();
		const rows = this.#sql
			.exec(
				"SELECT email, app_name, app_icon_url, app_url, platform, developer_name, created_at, updated_at FROM app_bindings WHERE email = ?",
				cleanEmail,
			)
			.toArray();
		if (rows.length === 0) return null;
		const r: any = rows[0];
		return {
			email: String(r.email),
			app_name: String(r.app_name),
			app_icon_url: String(r.app_icon_url),
			app_url: String(r.app_url),
			platform: String(r.platform) as any,
			developer_name: r.developer_name ? String(r.developer_name) : null,
			created_at: Number(r.created_at),
			updated_at: Number(r.updated_at),
		};
	}

	async setAppBinding(binding: {
		email: string;
		app_name: string;
		app_icon_url: string;
		app_url: string;
		platform: string;
		developer_name?: string | null;
	}): Promise<AppBinding> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const match = binding.email.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
		const cleanEmail = match
			? match[0].toLowerCase()
			: binding.email.split(",")[0].replace(/^["']|["']$/g, "").trim().toLowerCase();
		const now = Date.now();
		const devName = binding.developer_name?.trim() || null;

		const existing = this.#sql
			.exec("SELECT created_at FROM app_bindings WHERE email = ?", cleanEmail)
			.toArray();
		const createdAt = existing.length > 0 ? Number(existing[0].created_at) : now;

		this.#sql.exec(
			`INSERT INTO app_bindings (email, app_name, app_icon_url, app_url, platform, developer_name, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(email) DO UPDATE SET
			   app_name = excluded.app_name,
			   app_icon_url = excluded.app_icon_url,
			   app_url = excluded.app_url,
			   platform = excluded.platform,
			   developer_name = excluded.developer_name,
			   updated_at = excluded.updated_at`,
			cleanEmail,
			binding.app_name.trim(),
			binding.app_icon_url.trim(),
			binding.app_url.trim(),
			binding.platform,
			devName,
			createdAt,
			now,
		);

		return {
			email: cleanEmail,
			app_name: binding.app_name.trim(),
			app_icon_url: binding.app_icon_url.trim(),
			app_url: binding.app_url.trim(),
			platform: binding.platform as any,
			developer_name: devName,
			created_at: createdAt,
			updated_at: now,
		};
	}

	async deleteAppBinding(email: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const match = email.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
		const cleanEmail = match
			? match[0].toLowerCase()
			: email.split(",")[0].replace(/^["']|["']$/g, "").trim().toLowerCase();
		this.#sql.exec(
			"DELETE FROM app_bindings WHERE email = ?",
			cleanEmail,
		);
		return true;
	}

	async getAllDiscoverLeads(): Promise<DiscoverLead[]> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const rows = this.#sql
			.exec(
				"SELECT id, bundle_id, platform, app_name, app_icon_url, app_url, developer_name, developer_email, developer_website, installs_bracket, rating, reviews_count, category, country, has_iap, has_ads, release_date, updated_date, status, notes, created_at, updated_at FROM discover_leads ORDER BY updated_at DESC",
			)
			.toArray();
		return rows.map((r: any) => ({
			id: String(r.id),
			bundle_id: String(r.bundle_id),
			platform: String(r.platform) as any,
			app_name: String(r.app_name),
			app_icon_url: String(r.app_icon_url),
			app_url: String(r.app_url),
			developer_name: r.developer_name ? String(r.developer_name) : null,
			developer_email: r.developer_email ? String(r.developer_email) : null,
			developer_website: r.developer_website ? String(r.developer_website) : null,
			installs_bracket: r.installs_bracket ? String(r.installs_bracket) : null,
			rating: r.rating !== null && r.rating !== undefined ? Number(r.rating) : null,
			reviews_count: r.reviews_count !== null && r.reviews_count !== undefined ? Number(r.reviews_count) : null,
			category: r.category ? String(r.category) : null,
			country: r.country ? String(r.country) : null,
			has_iap: Boolean(r.has_iap),
			has_ads: Boolean(r.has_ads),
			release_date: r.release_date ? String(r.release_date) : null,
			updated_date: r.updated_date ? String(r.updated_date) : null,
			status: (r.status as any) || "uncontacted",
			notes: r.notes ? String(r.notes) : null,
			created_at: Number(r.created_at),
			updated_at: Number(r.updated_at),
		}));
	}

	async getDiscoverLead(id: string): Promise<DiscoverLead | null> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const rows = this.#sql
			.exec(
				"SELECT id, bundle_id, platform, app_name, app_icon_url, app_url, developer_name, developer_email, developer_website, installs_bracket, rating, reviews_count, category, country, has_iap, has_ads, release_date, updated_date, status, notes, created_at, updated_at FROM discover_leads WHERE id = ?",
				id,
			)
			.toArray();
		if (rows.length === 0) return null;
		const r: any = rows[0];
		return {
			id: String(r.id),
			bundle_id: String(r.bundle_id),
			platform: String(r.platform) as any,
			app_name: String(r.app_name),
			app_icon_url: String(r.app_icon_url),
			app_url: String(r.app_url),
			developer_name: r.developer_name ? String(r.developer_name) : null,
			developer_email: r.developer_email ? String(r.developer_email) : null,
			developer_website: r.developer_website ? String(r.developer_website) : null,
			installs_bracket: r.installs_bracket ? String(r.installs_bracket) : null,
			rating: r.rating !== null && r.rating !== undefined ? Number(r.rating) : null,
			reviews_count: r.reviews_count !== null && r.reviews_count !== undefined ? Number(r.reviews_count) : null,
			category: r.category ? String(r.category) : null,
			country: r.country ? String(r.country) : null,
			has_iap: Boolean(r.has_iap),
			has_ads: Boolean(r.has_ads),
			release_date: r.release_date ? String(r.release_date) : null,
			updated_date: r.updated_date ? String(r.updated_date) : null,
			status: (r.status as any) || "uncontacted",
			notes: r.notes ? String(r.notes) : null,
			created_at: Number(r.created_at),
			updated_at: Number(r.updated_at),
		};
	}

	async setDiscoverLead(lead: {
		id?: string;
		bundle_id: string;
		platform: string;
		app_name: string;
		app_icon_url: string;
		app_url: string;
		developer_name?: string | null;
		developer_email?: string | null;
		developer_website?: string | null;
		installs_bracket?: string | null;
		rating?: number | null;
		reviews_count?: number | null;
		category?: string | null;
		country?: string | null;
		has_iap?: boolean;
		has_ads?: boolean;
		release_date?: string | null;
		updated_date?: string | null;
		status?: string;
		notes?: string | null;
	}): Promise<DiscoverLead> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		const id = lead.id || `${lead.platform}_${lead.bundle_id}`;
		const now = Date.now();
		const existing = this.#sql
			.exec("SELECT created_at FROM discover_leads WHERE id = ?", id)
			.toArray();
		const createdAt = existing.length > 0 ? Number(existing[0].created_at) : now;

		this.#sql.exec(
			`INSERT INTO discover_leads (
				id, bundle_id, platform, app_name, app_icon_url, app_url,
				developer_name, developer_email, developer_website, installs_bracket,
				rating, reviews_count, category, country, has_iap, has_ads,
				release_date, updated_date, status, notes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				app_name = excluded.app_name,
				app_icon_url = excluded.app_icon_url,
				app_url = excluded.app_url,
				developer_name = excluded.developer_name,
				developer_email = excluded.developer_email,
				developer_website = excluded.developer_website,
				installs_bracket = excluded.installs_bracket,
				rating = excluded.rating,
				reviews_count = excluded.reviews_count,
				category = excluded.category,
				country = excluded.country,
				has_iap = excluded.has_iap,
				has_ads = excluded.has_ads,
				release_date = excluded.release_date,
				updated_date = excluded.updated_date,
				status = excluded.status,
				notes = excluded.notes,
				updated_at = excluded.updated_at`,
			id,
			lead.bundle_id,
			lead.platform,
			lead.app_name,
			lead.app_icon_url,
			lead.app_url,
			lead.developer_name || null,
			lead.developer_email || null,
			lead.developer_website || null,
			lead.installs_bracket || null,
			lead.rating !== undefined ? lead.rating : null,
			lead.reviews_count !== undefined ? lead.reviews_count : null,
			lead.category || null,
			lead.country || null,
			lead.has_iap ? 1 : 0,
			lead.has_ads ? 1 : 0,
			lead.release_date || null,
			lead.updated_date || null,
			lead.status || "uncontacted",
			lead.notes || null,
			createdAt,
			now,
		);

		return {
			id,
			bundle_id: lead.bundle_id,
			platform: lead.platform as any,
			app_name: lead.app_name,
			app_icon_url: lead.app_icon_url,
			app_url: lead.app_url,
			developer_name: lead.developer_name || null,
			developer_email: lead.developer_email || null,
			developer_website: lead.developer_website || null,
			installs_bracket: lead.installs_bracket || null,
			rating: lead.rating !== undefined ? lead.rating : null,
			reviews_count: lead.reviews_count !== undefined ? lead.reviews_count : null,
			category: lead.category || null,
			country: lead.country || null,
			has_iap: Boolean(lead.has_iap),
			has_ads: Boolean(lead.has_ads),
			release_date: lead.release_date || null,
			updated_date: lead.updated_date || null,
			status: (lead.status as any) || "uncontacted",
			notes: lead.notes || null,
			created_at: createdAt,
			updated_at: now,
		};
	}

	async deleteDiscoverLead(id: string): Promise<boolean> {
		if (!this.#isAuthDO) throw new Error("Not an auth DO");
		this.#sql.exec(
			"DELETE FROM discover_leads WHERE id = ? OR bundle_id = ? OR id = ? OR id = ?",
			id,
			id,
			`playstore_${id}`,
			`appstore_${id}`,
		);
		return true;
	}

	async getSentEmailRecipients(emails: string[]): Promise<Record<string, { sent: boolean; opened_count: number }>> {
		if (emails.length === 0) return {};
		const result: Record<string, { sent: boolean; opened_count: number }> = {};
		for (const rawEmail of emails) {
			const clean = rawEmail.trim().toLowerCase();
			if (!clean) continue;
			try {
				const rows = this.#sql
					.exec(
						"SELECT opened_count, opened_at FROM emails WHERE LOWER(recipient) LIKE ? OR LOWER(recipient) = ? ORDER BY opened_count DESC LIMIT 1",
						`%${clean}%`,
						clean,
					)
					.toArray();
				if (rows.length > 0) {
					const r: any = rows[0];
					const opened = Number(r.opened_count || 0) > 0 ? Number(r.opened_count) : (r.opened_at ? 1 : 0);
					result[clean] = {
						sent: true,
						opened_count: opened,
					};
				}
			} catch {
				// Table might not exist or error, ignore
			}
		}
		return result;
	}
}
