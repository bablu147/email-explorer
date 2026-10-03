export interface EmailExplorerOptions {
	auth?: {
		enabled?: boolean;
		registerEnabled?: boolean;
	};
	accountRecovery?: {
		fromEmail: string;
	};
}

export interface Session {
	id: string;
	userId: string;
	email: string;
	isAdmin: boolean;
	expiresAt: number;
}

export interface User {
	id: string;
	email: string;
	isAdmin: boolean;
	createdAt: number;
	updatedAt: number;
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

export interface DiscoverLead {
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
	status?: "uncontacted" | "contacted" | "opened" | "bound";
	notes?: string | null;
	created_at: number;
	updated_at: number;
}

export interface PushSubscriptionRecord {
	id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	user_agent?: string | null;
	created_at: string;
}

export type Env = {
	MAILBOX: DurableObjectNamespace<import("./durableObject/index").MailboxDO>;
	BUCKET: R2Bucket;
	SEND_EMAIL: SendEmail;
	config?: EmailExplorerOptions;
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_KEY?: string;
	VAPID_SUBJECT?: string;
};

