import axios from "axios";

const apiClient = axios.create({
	baseURL: "",
	headers: {
		"Content-Type": "application/json",
	},
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
	(config) => {
		const session = localStorage.getItem("session");
		if (session) {
			try {
				const parsed = JSON.parse(session);
				config.headers.Authorization = `Bearer ${parsed.id}`;
			} catch (e) {
				// Invalid session, ignore
			}
		}
		return config;
	},
	(error) => Promise.reject(error),
);

// Response interceptor to handle 401
apiClient.interceptors.response.use(
	(response) => response,
	async (error) => {
		if (error.response?.status === 401) {
			// Clear auth and redirect to login
			localStorage.removeItem("session");
			if (window.location.pathname !== "/login") {
				window.location.href = "/login";
			}
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
	logout: () => apiClient.post("/api/v1/auth/logout"),
	getCurrentUser: () => apiClient.get("/api/v1/auth/me"),
	forgotPassword: (email: string) =>
		apiClient.post("/api/v1/auth/forgot-password", { email }),
	resetPassword: (token: string, newPassword: string) =>
		apiClient.post("/api/v1/auth/reset-password", { token, newPassword }),

	// Set/clear auth token manually
	setAuthToken: (token: string) => {
		apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
	},
	clearAuthToken: () => {
		delete apiClient.defaults.headers.common["Authorization"];
	},

	// Mailboxes
	listMailboxes: () => apiClient.get("/api/v1/mailboxes"),
	createMailbox: (email: string, name: string, settings?: any) =>
		apiClient.post("/api/v1/mailboxes", { email, name, settings }),
	getMailbox: (mailboxId: string) =>
		apiClient.get(`/api/v1/mailboxes/${mailboxId}`),
	updateMailbox: (mailboxId: string, settings: any) =>
		apiClient.put(`/api/v1/mailboxes/${mailboxId}`, { settings }),
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
		apiClient.post(`/api/v1/mailboxes/${mailboxId}/emails/${id}/send-now`),
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
	resetPitchTemplate: () => apiClient.post("/api/v1/templates/pitch/reset"),

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

