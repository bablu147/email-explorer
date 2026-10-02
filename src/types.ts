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

export type Env = {
	MAILBOX: DurableObjectNamespace<import("./durableObject/index").MailboxDO>;
	BUCKET: R2Bucket;
	SEND_EMAIL: SendEmail;
	config?: EmailExplorerOptions;
};

