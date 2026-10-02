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
];
