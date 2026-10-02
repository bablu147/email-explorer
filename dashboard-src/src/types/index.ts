export interface SignatureSettings {
	enabled: boolean;
	text: string;
	html?: string;
}

export interface MailboxSettings {
	fromName?: string;
	forwarding?: { enabled: boolean; email: string };
	signature?: SignatureSettings;
	autoReply?: { enabled: boolean; subject: string; message: string };
}

export interface Mailbox {
	id: string;
	email: string;
	name: string;
	settings?: MailboxSettings;
}

export interface Email {
	id: string;
	subject: string;
	sender: string;
	recipient: string;
	cc?: string | null;
	bcc?: string | null;
	date: string;
	read: boolean;
	starred: boolean;
	body?: string | null;
	opened_at?: string | null;
	opened_count?: number;
	clicked_at?: string | null;
	clicked_count?: number;
	delivery_status?: string | null;
	spam_score?: number | null;
	attachments?: Attachment[];
}

export interface Attachment {
	id: string;
	filename: string;
	mimetype: string;
	size: number;
	content_id?: string;
	disposition?: string;
}

export interface OutgoingAttachment {
	filename: string;
	content: string; // base64
	type: string;
	size: number;
	disposition?: "attachment" | "inline";
	contentId?: string;
}

export interface Folder {
	id: string;
	name: string;
	unreadCount: number;
}

export interface Contact {
	id: string;
	name: string;
	email: string;
}

export type AppPlatform = "playstore" | "appstore" | "website";

export interface AppBinding {
	email: string;
	app_name: string;
	app_icon_url: string;
	app_url: string;
	platform: AppPlatform;
	developer_name?: string | null;
	created_at?: number;
	updated_at?: number;
}

export type DiscoverPlatform = "all" | "playstore" | "appstore";
export type DiscoverChart = "topgrossing" | "topfree" | "newfree" | "trending";
export type OutreachStatus = "uncontacted" | "contacted" | "opened" | "bound";

export interface DiscoveredApp {
	id: string;
	bundle_id: string;
	platform: "playstore" | "appstore";
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
	status?: OutreachStatus;
	is_saved?: boolean;
	opened_count?: number;
	notes?: string | null;
}

export interface DiscoverLead extends DiscoveredApp {
	created_at: number;
	updated_at: number;
}

export interface DiscoverStats {
	total_discovered: number;
	verified_emails: number;
	contacted: number;
	saved_targets: number;
}

