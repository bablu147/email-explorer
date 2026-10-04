import type { DOQB } from "workers-qb";

export class FolderHandler {
	#sql: SqlStorage;
	#qb: DOQB;

	constructor(sql: SqlStorage, qb: DOQB) {
		this.#sql = sql;
		this.#qb = qb;
	}

	async getFolders(): Promise<Array<{ id: string; name: string; unreadCount: number }>> {
		const rows = this.#sql
			.exec(
				`SELECT f.id, f.name, COUNT(CASE WHEN e.read = 0 THEN 1 END) as unreadCount
				 FROM folders f
				 LEFT JOIN emails e ON f.id = e.folder_id AND e.snoozed_until IS NULL AND e.scheduled_at IS NULL
				 GROUP BY f.id, f.name`,
			)
			.toArray();
		const list = rows.map((r: any) => ({
			id: String(r.id),
			name: String(r.name),
			unreadCount: Number(r.unreadCount || 0),
		}));
		const snoozedCount = (this.#sql
			.exec("SELECT COUNT(*) AS c FROM emails WHERE snoozed_until IS NOT NULL AND folder_id = 'inbox'")
			.toArray()[0] as any)?.c || 0;
		const scheduledCount = (this.#sql
			.exec("SELECT COUNT(*) AS c FROM emails WHERE scheduled_at IS NOT NULL AND folder_id = 'drafts'")
			.toArray()[0] as any)?.c || 0;
		list.push(
			{ id: "snoozed", name: "Snoozed", unreadCount: Number(snoozedCount) },
			{ id: "scheduled", name: "Scheduled", unreadCount: Number(scheduledCount) },
		);
		return list;
	}

	async createFolder(
		id: string,
		name: string,
	): Promise<{ id: string; name: string; unreadCount: number } | null> {
		try {
			const result = this.#qb
				.insert({
					tableName: "folders",
					data: { id, name },
					returning: ["id", "name"],
				})
				.execute();
			const newFolder = result.results as any;
			return { id: String(newFolder.id), name: String(newFolder.name), unreadCount: 0 };
		} catch (e: any) {
			if (e.message.includes("UNIQUE constraint failed")) {
				return null;
			}
			throw e;
		}
	}

	async updateFolder(
		id: string,
		name: string,
	): Promise<{ id: string; name: string; unreadCount: number } | null> {
		this.#qb
			.update({
				tableName: "folders",
				data: { name },
				where: {
					conditions: "id = ?",
					params: [id],
				},
			})
			.execute();
		const rows = this.#sql
			.exec(
				`SELECT f.id, f.name, COUNT(CASE WHEN e.read = 0 THEN 1 END) as unreadCount
				 FROM folders f
				 LEFT JOIN emails e ON f.id = e.folder_id AND e.snoozed_until IS NULL AND e.scheduled_at IS NULL
				 WHERE f.id = ?
				 GROUP BY f.id, f.name`,
				id,
			)
			.toArray();
		if (rows.length > 0) {
			const r: any = rows[0];
			return {
				id: String(r.id),
				name: String(r.name),
				unreadCount: Number(r.unreadCount || 0),
			};
		}
		return null;
	}

	async deleteFolder(id: string): Promise<boolean> {
		const folder = this.#qb
			.select<{ is_deletable: number }>("folders")
			.fields(["is_deletable"])
			.where("id = ?", id)
			.one();

		if (!folder.results || folder.results.is_deletable === 0) {
			return false;
		}

		// emails.folder_id is ON DELETE CASCADE, so deleting the folder row would delete its mail.
		// Move the mail to Archive first ('archive' is seeded as a non-deletable folder, so it always
		// exists). Both statements are synchronous with no await between them, so the Durable Object
		// commits them together: the folder can never be gone while its mail is still in it.
		this.#qb
			.update({
				tableName: "emails",
				data: { folder_id: "archive" },
				where: {
					conditions: "folder_id = ?",
					params: [id],
				},
			})
			.execute();

		this.#qb
			.delete({
				tableName: "folders",
				where: {
					conditions: "id = ?",
					params: [id],
				},
			})
			.execute();

		return true;
	}
}
