import { defineStore } from "pinia";
import api from "@/services/api";

export interface MailTemplate {
	id: string;
	kind: "reply" | "pitch";
	name: string;
	subject: string | null;
	body: string;
	updated_by: string | null;
	updated_at: string;
}

const escapeHtml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Fills `{{field}}` placeholders. Unknown fields are left untouched so a typo stays visible in the
 * draft instead of silently vanishing. Pass `html: true` to escape values (they go into markup).
 */
export function renderTemplate(
	template: string,
	vars: Record<string, string>,
	opts: { html?: boolean } = {},
): string {
	return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
		if (!(key in vars)) return match;
		return opts.html ? escapeHtml(vars[key]) : vars[key];
	});
}

/** "Jane Doe <jane@x.com>" -> "Jane"; falls back to "there" when there is no display name. */
export function firstNameFromSender(raw?: string | null): string {
	const m = (raw || "").match(/^\s*"?([^"<@]+?)"?\s*<[^>]+>/);
	const first = m?.[1]?.trim().split(/\s+/)[0];
	return first || "there";
}

export const useTemplatesStore = defineStore("templates", {
	state: () => ({
		templates: [] as MailTemplate[],
		loaded: false,
		loading: false,
	}),

	getters: {
		pitch: (state): MailTemplate | null =>
			state.templates.find((t) => t.kind === "pitch") || null,
		replies: (state): MailTemplate[] => state.templates.filter((t) => t.kind === "reply"),
	},

	actions: {
		async load(force = false) {
			if (this.loading || (this.loaded && !force)) return;
			this.loading = true;
			try {
				const res = await api.listTemplates();
				this.templates = res.data?.templates || [];
				this.loaded = true;
			} finally {
				this.loading = false;
			}
		},

		async createReply(name: string, body: string) {
			const res = await api.createTemplate({ name, body });
			await this.load(true);
			return res.data.template as MailTemplate;
		},

		async update(id: string, fields: { name: string; body: string; subject?: string | null }) {
			const res = await api.updateTemplate(id, fields);
			await this.load(true);
			return res.data.template as MailTemplate;
		},

		async remove(id: string) {
			await api.deleteTemplate(id);
			this.templates = this.templates.filter((t) => t.id !== id);
		},

		async resetPitch() {
			await api.resetPitchTemplate();
			await this.load(true);
		},
	},
});
