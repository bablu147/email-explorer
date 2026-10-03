// Shared reply / pitch templates. Pure module (no relative imports) so node tests can load it.
//
// Merge fields are written {{field}}. They are filled in by the dashboard when a template is used:
//   pitch (Discover):  app_name, developer_name, platform, category, installs, traction
//   replies (threads): first_name
//   follow-ups (automatic): first_name, app_name, original_subject

export type TemplateKind = "reply" | "pitch";

export const PITCH_TEMPLATE_ID = "pitch";

export interface TemplateSeed {
	id: string;
	kind: TemplateKind;
	name: string;
	subject: string | null;
	body: string;
}

export const FOLLOWUP_TEMPLATE_ID = "followup_nudge";

/** Seeded separately from the rest so installs that already seeded the others still get it. */
export const DEFAULT_FOLLOWUP_TEMPLATE: TemplateSeed = {
	id: FOLLOWUP_TEMPLATE_ID,
	kind: "reply",
	name: "Follow-up nudge",
	subject: null,
	body: "Hi {{first_name}},\n\nJust following up on my earlier note about {{app_name}}. Reflect offers transparent, flat-priced attribution with no per-MAU fees, and I'd be glad to set up a sandbox so you can compare it with your current stack.\n\nWould a quick 10-minute walkthrough work this week?\n\nBest,\nThe Reflect Partnerships Team",
};

export const DEFAULT_TEMPLATES: TemplateSeed[] = [
	{
		id: PITCH_TEMPLATE_ID,
		kind: "pitch",
		name: "Discover pitch",
		subject:
			"Reflect MMP Partnership for {{app_name}} — High-Accuracy Attribution & Zero Hidden Fees",
		body: `<p>Hi {{developer_name}},</p>
<p>I came across <strong>{{app_name}}</strong> on the {{platform}} and was really impressed by your growth and traction{{traction}} in the {{category}} category.</p>
<p>I'm reaching out from <strong>Reflect</strong> (<a href="https://reflect.cloud" target="_blank">reflect.cloud</a>). We built Reflect as a next-generation Mobile Measurement Partner (MMP) designed specifically for performance-driven mobile studios looking to maximize ROAS without the exorbitant MAU taxes and data lock-in of legacy MMPs like AppsFlyer or Adjust.</p>
<p><strong>Why top studios are switching to Reflect:</strong></p>
<ul>
  <li><strong>Deterministic &amp; SKAdNetwork Attribution:</strong> Real-time ad spend attribution, sub-millisecond fraud verification, and multi-touch postbacks without sampling.</li>
  <li><strong>Predictable, Transparent Pricing:</strong> Zero per-MAU penalties when your game goes viral. Save 60%+ compared to standard enterprise MMP tiers.</li>
  <li><strong>Zero Data Leakage:</strong> Your install cohort analytics, conversion rates, and revenue postbacks remain strictly private to your team.</li>
  <li><strong>Ultra-Lightweight SDKs:</strong> Drop-in Unity, iOS, Android, Flutter, and React Native SDKs that take less than 30 minutes to integrate with zero ANR overhead.</li>
</ul>
<p>We'd love to set your team up with an enterprise sandbox test app so your growth marketers and UA managers can benchmark our attribution accuracy side-by-side with your existing stack.</p>
<p>Would you be open to a quick 10-minute demo or sandbox walkthrough next Tuesday or Thursday?</p>
<p>Best regards,<br>
<strong>The Reflect Partnerships Team</strong><br>
<a href="https://reflect.cloud">reflect.cloud</a></p>`,
	},
	{
		id: "sdk_setup",
		kind: "reply",
		name: "Unity SDK Setup Guide",
		subject: null,
		body: 'Hi {{first_name}},\n\nHere is the quick setup guide for Reflect Unity SDK:\n1. Import the reflect-sdk.unitypackage into your project.\n2. Ensure EDM4U resolves native dependencies.\n3. Initialize in your game bootstrap:\nReflect.Initialize("YOUR_APP_KEY");\n\nLet us know if you hit any build warnings!\n\nBest regards,\nReflect MMP Support',
	},
	{
		id: "postback_test",
		kind: "reply",
		name: "Attribution Postback Verification",
		subject: null,
		body: "Hi {{first_name}},\n\nWe verified your postback configuration. Raw installs and SAN attribution events are recording cleanly on api.reflect.cloud with valid signatures.\n\nCould you trigger a test purchase event to verify in-app event postbacks?\n\nThanks,\nReflect MMP Engineering",
	},
	{
		id: "outreach_pitch",
		kind: "reply",
		name: "MMP Switch & Lower Fee Pitch",
		subject: null,
		body: "Hi {{first_name}},\n\nI noticed your recent launch on the store! Reflect is a modern, transparent mobile measurement platform (MMP) built specifically for mobile game studios.\n\nWe offer zero-data sampling, real-time raw event streaming to your own S3/R2/BigQuery, and flat pricing without punitive MAU penalties.\n\nWould you have 10 minutes next week for a quick sandbox walkthrough?\n\nBest,\nReflect Growth Team",
	},
];

export const TEMPLATE_LIMITS = { name: 120, subject: 300, body: 20000, maxTemplates: 100 };

export interface TemplateInput {
	name?: unknown;
	subject?: unknown;
	body?: unknown;
}

/** Trims and bounds user input; returns an error string when it can't be saved. */
export function validateTemplateInput(
	input: TemplateInput,
	kind: TemplateKind,
): { ok: true; name: string; subject: string | null; body: string } | { ok: false; error: string } {
	const name = typeof input.name === "string" ? input.name.trim() : "";
	const body = typeof input.body === "string" ? input.body : "";
	const subject = typeof input.subject === "string" ? input.subject.trim() : "";
	if (!name) return { ok: false, error: "A template name is required" };
	if (name.length > TEMPLATE_LIMITS.name) return { ok: false, error: "Name is too long" };
	if (!body.trim()) return { ok: false, error: "The template body can't be empty" };
	if (body.length > TEMPLATE_LIMITS.body) return { ok: false, error: "Body is too long" };
	if (kind === "pitch" && !subject) return { ok: false, error: "The pitch needs a subject line" };
	if (subject.length > TEMPLATE_LIMITS.subject) return { ok: false, error: "Subject is too long" };
	return { ok: true, name, subject: kind === "pitch" ? subject : null, body };
}

/** Fills `{{field}}` placeholders; unknown fields are left as written. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
	return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
		key in vars ? vars[key] : match,
	);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Plain text to simple HTML: blank lines become paragraphs, single newlines become <br>. */
export function textToHtml(text: string): string {
	return text
		.replace(/\r\n/g, "\n")
		.split(/\n{2,}/)
		.map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, "<br>")}</p>`)
		.join("\n");
}
