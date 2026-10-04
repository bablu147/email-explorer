import type { Migration } from "workers-qb";

export const mailboxMigrations: Migration[] = [
	{
		name: "1_initial_setup",
		sql: `
            CREATE TABLE folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                is_deletable INTEGER NOT NULL DEFAULT 1
            );

            INSERT INTO folders (id, name, is_deletable) VALUES
                ('inbox', 'Inbox', 0),
                ('sent', 'Sent', 0),
                ('trash', 'Trash', 0),
                ('archive', 'Archive', 0),
                ('spam', 'Spam', 0);

            CREATE TABLE emails (
                id TEXT PRIMARY KEY,
                folder_id TEXT NOT NULL,
                subject TEXT,
                sender TEXT,
                recipient TEXT,
                date TEXT,
                read INTEGER DEFAULT 0,
                starred INTEGER DEFAULT 0,
                body TEXT,
                FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
            );

            CREATE TABLE contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT NOT NULL UNIQUE
            );

            CREATE TABLE attachments (
                id TEXT PRIMARY KEY,
                email_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                mimetype TEXT NOT NULL,
                size INTEGER NOT NULL,
                content_id TEXT,
                disposition TEXT,
                FOREIGN KEY(email_id) REFERENCES emails(id) ON DELETE CASCADE
            );
        `,
	},
	{
		name: "2_add_email_threading",
		sql: `
            ALTER TABLE emails ADD COLUMN in_reply_to TEXT;
            ALTER TABLE emails ADD COLUMN email_references TEXT;
            ALTER TABLE emails ADD COLUMN thread_id TEXT;
            
            CREATE INDEX idx_emails_thread_id ON emails(thread_id);
            CREATE INDEX idx_emails_in_reply_to ON emails(in_reply_to);
        `,
	},
	{
		name: "3_add_cc_bcc_and_drafts",
		sql: `
            ALTER TABLE emails ADD COLUMN cc TEXT;
            ALTER TABLE emails ADD COLUMN bcc TEXT;

            INSERT OR IGNORE INTO folders (id, name, is_deletable) VALUES
                ('drafts', 'Drafts', 0);
        `,
	},
	{
		name: "4_add_tracking_columns",
		sql: `
            ALTER TABLE emails ADD COLUMN opened_at TEXT;
            ALTER TABLE emails ADD COLUMN opened_count INTEGER DEFAULT 0;
            ALTER TABLE emails ADD COLUMN clicked_at TEXT;
            ALTER TABLE emails ADD COLUMN clicked_count INTEGER DEFAULT 0;
        `,
	},
	{
		name: "5_add_delivery_status",
		sql: `
            ALTER TABLE emails ADD COLUMN delivery_status TEXT DEFAULT 'inbox';
            ALTER TABLE emails ADD COLUMN spam_score REAL DEFAULT 0.0;
        `,
	},
	{
		name: "8_add_push_subscriptions",
		sql: `
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id TEXT PRIMARY KEY,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                user_agent TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_push_endpoint ON push_subscriptions(endpoint);
        `,
	},
	{
		// Push subscriptions now live only in the AUTH registry, tied to a user. Rows in mailbox DOs were
		// written by unauthenticated callers and are never read any more.
		name: "9_drop_push_subscriptions",
		sql: `
            DROP TABLE IF EXISTS push_subscriptions;
        `,
	},
	{
		// Follow-up drafts created automatically; used to tell which are still unsent.
		name: "10_followups",
		sql: `
            CREATE TABLE IF NOT EXISTS followups (
                draft_id TEXT PRIMARY KEY,
                recipient TEXT NOT NULL,
                original_email_id TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_followups_recipient ON followups(recipient);
        `,
	},
	{
		// Snooze (hide an email until a time) and scheduled send (a draft that sends itself).
		name: "11_snooze_and_scheduled_send",
		sql: `
            ALTER TABLE emails ADD COLUMN snoozed_until TEXT;
            ALTER TABLE emails ADD COLUMN scheduled_at TEXT;
            ALTER TABLE emails ADD COLUMN send_error TEXT;
            CREATE INDEX IF NOT EXISTS idx_emails_snoozed ON emails(snoozed_until) WHERE snoozed_until IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_emails_scheduled ON emails(scheduled_at) WHERE scheduled_at IS NOT NULL;
        `,
	},
];

export const authMigrations: Migration[] = [
	{
		name: "1_auth_setup",
		sql: `
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE user_mailboxes (
                user_id TEXT NOT NULL,
                mailbox_id TEXT NOT NULL,
                role TEXT NOT NULL,
                PRIMARY KEY (user_id, mailbox_id)
            );

            CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
            CREATE INDEX idx_user_mailboxes_user_id ON user_mailboxes(user_id);
            CREATE INDEX idx_user_mailboxes_mailbox_id ON user_mailboxes(mailbox_id);
        `,
	},
	{
		name: "2_app_bindings",
		sql: `
            CREATE TABLE IF NOT EXISTS app_bindings (
                email TEXT PRIMARY KEY,
                app_name TEXT NOT NULL,
                app_icon_url TEXT NOT NULL,
                app_url TEXT NOT NULL,
                platform TEXT NOT NULL,
                developer_name TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_app_bindings_platform ON app_bindings(platform);
        `,
	},
	{
		name: "3_discover_leads",
		sql: `
            CREATE TABLE IF NOT EXISTS discover_leads (
                id TEXT PRIMARY KEY,
                bundle_id TEXT NOT NULL,
                platform TEXT NOT NULL,
                app_name TEXT NOT NULL,
                app_icon_url TEXT NOT NULL,
                app_url TEXT NOT NULL,
                developer_name TEXT,
                developer_email TEXT,
                developer_website TEXT,
                installs_bracket TEXT,
                rating REAL,
                reviews_count INTEGER,
                category TEXT,
                country TEXT,
                has_iap INTEGER DEFAULT 0,
                has_ads INTEGER DEFAULT 0,
                release_date TEXT,
                updated_date TEXT,
                status TEXT DEFAULT 'uncontacted',
                notes TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_discover_leads_bundle ON discover_leads(bundle_id, platform);
            CREATE INDEX IF NOT EXISTS idx_discover_leads_email ON discover_leads(developer_email);
        `,
	},
	{
		name: "4_add_push_subscriptions",
		sql: `
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id TEXT PRIMARY KEY,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                user_agent TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_push_endpoint ON push_subscriptions(endpoint);
        `,
	},
	{
		// Subscriptions used to be accepted from anyone and shared across all mailboxes. Unowned rows
		// can't be trusted, so they are dropped (a device just re-enables notifications once).
		name: "5_push_subscriptions_owner",
		sql: `
            DELETE FROM push_subscriptions;
            ALTER TABLE push_subscriptions ADD COLUMN user_id TEXT;
            CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id);
        `,
	},
	{
		// Org-wide "do not contact" list: hard bounces, unsubscribes and manual entries.
		name: "6_suppressions",
		sql: `
            CREATE TABLE IF NOT EXISTS suppressions (
                email TEXT PRIMARY KEY,
                reason TEXT NOT NULL,
                detail TEXT,
                source_mailbox TEXT,
                created_at TEXT NOT NULL
            );
        `,
	},
	{
		// Org-wide reply snippets and the Discover pitch, editable from Settings.
		name: "7_templates",
		sql: `
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                name TEXT NOT NULL,
                subject TEXT,
                body TEXT NOT NULL,
                updated_by TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        `,
	},
	{
		// Accounts and access: accounts can be disabled, wrong passwords are counted, and the roles
		// on mailbox grants start to be enforced.
		//
		// The UPDATE is a one-time correction of existing grants. The admin screen has always offered
		// "read" first and the role was never checked, so today's "read" users are in fact working
		// with full access. Enforcement must not take sending away from them overnight: they become
		// "write", and an admin sets the people who really are view-only back to "read".
		//
		// Statement order matters. A migration is recorded only after its last statement, so one that
		// stopped half-way runs again from the top. Everything before the ALTER can run twice without
		// harm; the ALTER cannot ("duplicate column"), so it is last and the only one of its kind here.
		name: "8_accounts_and_access",
		sql: `
            UPDATE user_mailboxes SET role = 'write' WHERE role = 'read';

            CREATE TABLE IF NOT EXISTS login_attempts (
                attempt_key TEXT PRIMARY KEY,
                failures INTEGER NOT NULL,
                first_failure_at INTEGER NOT NULL,
                last_failure_at INTEGER NOT NULL,
                locked_until INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_login_attempts_last_failure ON login_attempts(last_failure_at);

            ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
        `,
	},
	{
		// When a session was last used, for the idle timeout. NULL on sessions that already exist:
		// those count as used at the moment they are next seen, so the release signs nobody out.
		// Its own migration for the reason given above: one ALTER, and nothing after it.
		name: "9_session_last_used",
		sql: `
            ALTER TABLE sessions ADD COLUMN last_used_at INTEGER;
        `,
	},
	{
		// Browsers that have signed in to an account, stored by the hash of the token in their
		// device cookie. Such a browser is let past the account-wide sign-in lock for that account.
		name: "10_known_devices",
		sql: `
            CREATE TABLE IF NOT EXISTS known_devices (
                device_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_used_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_known_devices_user ON known_devices(user_id);
        `,
	},
];
