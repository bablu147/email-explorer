import axios from "axios";
import { useToast } from "@/composables/useToast";

// No request carries an Authorization header: the session is an HttpOnly cookie, which the browser
// attaches to these same-origin requests by itself and which page script cannot read.
const apiClient = axios.create({
	baseURL: "",
	headers: {
		"Content-Type": "application/json",
	},
});

// A 401 from sign-in is about the password that was typed, not about a session. (Changing a
// password answers a wrong current password with 400, so a 401 there is the session ending.)
const PASSWORD_CHECK_URLS = ["/api/v1/auth/login"];
/** Pages a signed-out visitor may be on. A 401 there must not send them to the sign-in page. */
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

let sessionEnded: () => void = () => {};
/** Registers what runs when the server says there is no session (the auth store forgets the user). */
export const onSessionEnded = (handler: () => void) => {
	sessionEnded = handler;
};

// A refusal for the caller's role on a mailbox. The server's sentence says what is not allowed.
const ROLE_REFUSALS = ["view_only", "mailbox_admin_required"];
let lastRefusal = { message: "", shownAt: 0, at: 0 };
const showRoleRefusal = (message: string) => {
	const now = Date.now();
	// One refused action can be many requests (a bulk move): the sentence is shown once for them,
	// and again only when the toast that carries it has had time to go.
	const stillShown = message === lastRefusal.message && now - lastRefusal.shownAt <= 3000;
	if (!stillShown) useToast().error(message);
	lastRefusal = { message, shownAt: stillShown ? lastRefusal.shownAt : now, at: now };
};
/** True when a role refusal was shown since `since` (ms): the caller's own failure toast would repeat it. */
export const roleRefusedSince = (since: number): boolean => lastRefusal.at >= since;

apiClient.interceptors.response.use(
	(response) => response,
	async (error) => {
		const status = error.response?.status;
		// Only a 401 means the session is gone. A 503 ("could not check the session"), any other
		// status and a network failure say nothing about it, so they sign nobody out.
		if (status === 401 && !PASSWORD_CHECK_URLS.includes(error.config?.url)) {
			sessionEnded();
			const { pathname, search, hash } = window.location;
			if (!PUBLIC_PATHS.includes(pathname.replace(/\/+$/, ""))) {
				// A full page load, so that nothing the ended session fetched stays in memory.
				// `redirect` brings the user back here after signing in; `ended` makes Login.vue say why.
				window.location.assign(`/login?redirect=${encodeURIComponent(pathname + search + hash)}&ended=1`);
			}
		}
		const data = error.response?.data;
		if (status === 403 && ROLE_REFUSALS.includes(data?.code) && typeof data.error === "string") {
			showRoleRefusal(data.error);
		}
		return Promise.reject(error);
	},
);

// The send endpoints reject any key they do not know (400) and take the sender from the mailbox in
// the URL, so only these are ever posted; in particular there is no `from`.
const REPLY_KEYS = [
	"to",
	"cc",
	"bcc",
	"subject",
	"html",
	"text",
	"attachments",
	"in_reply_to",
	"references",
	"thread_id",
	// The autosaved draft this message replaces; the server removes it once the message is out.
	"draft_id",
];
const SEND_KEYS = [...REPLY_KEYS, "is_draft", "send_at"];
const ATTACHMENT_KEYS = ["content", "filename", "type", "disposition", "contentId"];

/** Thrown before any request is made: the caller passed a field the endpoint does not take. */
class UnknownFieldError extends Error {}

const pick = (source: any, keys: string[]) => {
	const picked: Record<string, any> = {};
	for (const key of keys) {
		if (source?.[key] !== undefined) picked[key] = source[key];
	}
	return picked;
};

const outgoing = (email: any, keys: string[]) => {
	// A key outside the list is an error, not something to drop: dropped here, the server's strict
	// schema never sees it, and a caller that posted `scheduled_at` instead of `send_at` would get
	// an immediate send again instead of a failure someone notices.
	const unknown = Object.keys(email || {}).find((key) => !keys.includes(key));
	if (unknown) {
		throw new UnknownFieldError(
			`Not sent: "${unknown}" is not a field the mail server accepts. This is a bug in the app.`,
		);
	}
	const body = pick(email, keys);
	// The composer keeps client-only fields on attachments (size, the local preview URL). Those are
	// left out quietly: the server ignores extra attachment fields anyway.
	if (Array.isArray(body.attachments)) {
		body.attachments = body.attachments.map((att: any) => pick(att, ATTACHMENT_KEYS));
	}
	return body;
};

/** The server's own sentence for a failed request: `error` from a route, or the first schema issue. */
export const apiErrorMessage = (err: any, fallback: string): string => {
	if (err instanceof UnknownFieldError) return err.message;
	const data = err?.response?.data;
	if (typeof data?.error === "string" && data.error) return data.error;
	const issue = Array.isArray(data?.errors) ? data.errors[0]?.message : null;
	return typeof issue === "string" && issue ? issue : fallback;
};

export default {
	// Settings
	getAppSettings: () => apiClient.get("/api/v1/settings"),

	// Auth
	register: (email: string, password: string) =>
		apiClient.post("/api/v1/auth/register", { email, password }),
	login: (email: string, password: string) =>
		apiClient.post("/api/v1/auth/login", { email, password }),
	// `{}` here and on the other POSTs with nothing to say: without a body axios drops the
	// Content-Type header, and the server wants state-changing requests to declare JSON.
	logout: () => apiClient.post("/api/v1/auth/logout", {}),
	getCurrentUser: () => apiClient.get("/api/v1/auth/me"),
	changePassword: (currentPassword: string, newPassword: string) =>
		apiClient.post("/api/v1/auth/change-password", {
			current_password: currentPassword,
			new_password: newPassword,
		}),
	forgotPassword: (email: string) =>
		apiClient.post("/api/v1/auth/forgot-password", { email }),
	resetPassword: (token: string, newPassword: string) =>
		apiClient.post("/api/v1/auth/reset-password", { token, newPassword }),

	// Mailboxes
	listMailboxes: () => apiClient.get("/api/v1/mailboxes"),
	createMailbox: (email: string, name: string, settings?: any) =>
		apiClient.post("/api/v1/mailboxes", { email, name, settings }),
	getMailbox: (mailboxId: string) =>
		apiClient.get(`/api/v1/mailboxes/${mailboxId}`),
	updateMailbox: (mailboxId: string, settings: any, name?: string) =>
		apiClient.put(`/api/v1/mailboxes/${mailboxId}`, { settings, ...(name ? { name } : {}) }),
	deleteMailbox: (mailboxId: string) =>
		apiClient.delete(`/api/v1/mailboxes/${mailboxId}`),

	// Emails
	listEmails: (mailboxId: string, params: any) =>
		apiClient.get(`/api/v1/mailboxes/${mailboxId}/emails`, { params }),
	sendEmail: (mailboxId: string, email: any) =>
		apiClient.post(`/api/v1/mailboxes/${mailboxId}/emails`, outgoing(email, SEND_KEYS)),
	saveDraft: (mailboxId: string, email: any) =>
		apiClient.post(`/api/v1/mailboxes/${mailboxId}/emails`, {
			...outgoing(email, SEND_KEYS),
			is_draft: true,
		}),
	getEmail: (mailboxId: string, id: string) =>
		apiClient.get(`/api/v1/mailboxes/${mailboxId}/emails/${id}`),
	getThread: (mailboxId: string, threadId: string) =>
		apiClient.get(`/api/v1/mailboxes/${mailboxId}/threads/${threadId}`),
	updateEmail: (mailboxId: string, id: string, data: any) =>
		apiClient.put(`/api/v1/mailboxes/${mailboxId}/emails/${id}`, data),
	deleteEmail: (mailboxId: string, id: string) =>
		apiClient.delete(`/api/v1/mailboxes/${mailboxId}/emails/${id}`),
	moveEmail: (mailboxId: string, id: string, folderId: string) =>
		apiClient.post(`/api/v1/mailboxes/${mailboxId}/emails/${id}/move`, {
			folderId,
		}),
	getAttachment: (mailboxId: string, emailId: string, attachmentId: string) =>
		apiClient.get(
			`/api/v1/mailboxes/${mailboxId}/emails/${emailId}/attachments/${attachmentId}`,
			{ responseType: "blob" },
		),
	replyToEmail: (mailboxId: string, emailId: string, email: any) =>
		apiClient.post(
			`/api/v1/mailboxes/${mailboxId}/emails/${emailId}/reply`,
			outgoing(email, REPLY_KEYS),
		),
	forwardEmail: (mailboxId: string, emailId: string, email: any) =>
		apiClient.post(
			`/api/v1/mailboxes/${mailboxId}/emails/${emailId}/forward`,
			outgoing(email, REPLY_KEYS),
		),
	snoozeEmail: (mailboxId: string, id: string, until: string | null) =>
		apiClient.post(`/api/v1/mailboxes/${mailboxId}/emails/${id}/snooze`, { until }),
	scheduleEmail: (mailboxId: string, id: string, sendAt: string | null) =>
		apiClient.post(`/api/v1/mailboxes/${mailboxId}/emails/${id}/schedule`, { send_at: sendAt }),
	sendScheduledNow: (mailboxId: string, id: string) =>
		apiClient.post(`/api/v1/mailboxes/${mailboxId}/emails/${id}/send-now`, {}),
	getQueueSummary: (mailboxId: string) =>
		apiClient.get(`/api/v1/mailboxes/${mailboxId}/queue-summary`),

	// Folders
	listFolders: (mailboxId: string) =>
		apiClient.get(`/api/v1/mailboxes/${mailboxId}/folders`),
	createFolder: (mailboxId: string, name: string) =>
		apiClient.post(`/api/v1/mailboxes/${mailboxId}/folders`, { name }),
	updateFolder: (mailboxId: string, id: string, name: string) =>
		apiClient.put(`/api/v1/mailboxes/${mailboxId}/folders/${id}`, { name }),
	deleteFolder: (mailboxId: string, id: string) =>
		apiClient.delete(`/api/v1/mailboxes/${mailboxId}/folders/${id}`),

	// Contacts
	listContacts: (mailboxId: string) =>
		apiClient.get(`/api/v1/mailboxes/${mailboxId}/contacts`),
	createContact: (mailboxId: string, contact: any) =>
		apiClient.post(`/api/v1/mailboxes/${mailboxId}/contacts`, contact),
	updateContact: (mailboxId: string, id: string, contact: any) =>
		apiClient.put(`/api/v1/mailboxes/${mailboxId}/contacts/${id}`, contact),
	deleteContact: (mailboxId: string, id: string) =>
		apiClient.delete(`/api/v1/mailboxes/${mailboxId}/contacts/${id}`),

	// Search
	searchEmails: (mailboxId: string, params: any) =>
		apiClient.get(`/api/v1/mailboxes/${mailboxId}/search`, { params }),

	// Admin
	adminRegisterUser: (email: string, password: string) =>
		apiClient.post("/api/v1/auth/admin/register", { email, password }),
	adminListUsers: () => apiClient.get("/api/v1/auth/admin/users"),
	adminUpdateUser: (
		userId: string,
		patch: { isAdmin?: boolean; disabled?: boolean; password?: string },
	) => apiClient.put(`/api/v1/auth/admin/users/${encodeURIComponent(userId)}`, patch),
	adminDeleteUser: (userId: string) =>
		apiClient.delete(`/api/v1/auth/admin/users/${encodeURIComponent(userId)}`),
	adminRevokeUserSessions: (userId: string) =>
		apiClient.post(`/api/v1/auth/admin/users/${encodeURIComponent(userId)}/revoke-sessions`, {}),
	// Granting again changes the role: the server keeps one grant per user and mailbox.
	adminGrantAccess: (userId: string, mailboxId: string, role: string) =>
		apiClient.post("/api/v1/auth/admin/grant-access", {
			userId,
			mailboxId,
			role,
		}),
	adminRevokeAccess: (userId: string, mailboxId: string) =>
		apiClient.post("/api/v1/auth/admin/revoke-access", { userId, mailboxId }),

	// App Bindings
	listAppBindings: () => apiClient.get("/api/v1/app-bindings"),
	getAppBinding: (email: string) =>
		apiClient.get(`/api/v1/app-bindings/${encodeURIComponent(email)}`),
	saveAppBinding: (binding: {
		email: string;
		app_name: string;
		app_icon_url: string;
		app_url: string;
		platform: string;
		developer_name?: string | null;
	}) => apiClient.post("/api/v1/app-bindings", binding),
	deleteAppBinding: (email: string) =>
		apiClient.delete(`/api/v1/app-bindings/${encodeURIComponent(email)}`),
	lookupApp: (query: string, platform?: string) =>
		apiClient.get("/api/v1/app-lookup", { params: { query, platform } }),

	// App Discovery & MMP Outreach
	discoverApps: (params: {
		platform?: string;
		country?: string;
		chart?: string;
		category?: string;
		limit?: number;
		page?: number;
		query?: string;
	}) => apiClient.get("/api/v1/discover/apps", { params }),
	getDiscoverLeads: () => apiClient.get("/api/v1/discover/leads"),
	saveDiscoverLead: (lead: any) => apiClient.post("/api/v1/discover/leads", lead),
	deleteDiscoverLead: (id: string) =>
		apiClient.delete(`/api/v1/discover/leads/${encodeURIComponent(id)}`),

	// Shared templates (reply snippets and the Discover pitch)
	listTemplates: () => apiClient.get("/api/v1/templates"),
	createTemplate: (template: { name: string; body: string }) =>
		apiClient.post("/api/v1/templates", template),
	updateTemplate: (
		id: string,
		template: { name: string; body: string; subject?: string | null },
	) => apiClient.put(`/api/v1/templates/${encodeURIComponent(id)}`, template),
	deleteTemplate: (id: string) =>
		apiClient.delete(`/api/v1/templates/${encodeURIComponent(id)}`),
	resetPitchTemplate: () => apiClient.post("/api/v1/templates/pitch/reset", {}),

	// Follow-ups and the outreach pipeline
	getFollowUpConfig: () => apiClient.get("/api/v1/followups/config"),
	setFollowUpConfig: (patch: Record<string, unknown>) =>
		apiClient.put("/api/v1/followups/config", patch),
	runFollowUps: (dryRun: boolean) =>
		apiClient.post("/api/v1/followups/run", { dry_run: dryRun }),
	getPipeline: (mailboxId: string, days = 90) =>
		apiClient.get(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/pipeline`, {
			params: { days },
		}),

	// Suppression list (bounces, unsubscribes, manual entries)
	listSuppressions: () => apiClient.get("/api/v1/suppressions"),
	addSuppression: (email: string, detail?: string) =>
		apiClient.post("/api/v1/suppressions", { email, detail }),
	removeSuppression: (email: string) =>
		apiClient.delete(`/api/v1/suppressions/${encodeURIComponent(email)}`),
	checkSuppressions: (emails: string[]) =>
		apiClient.post("/api/v1/suppressions/check", { emails }),
};

