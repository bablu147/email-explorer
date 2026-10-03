import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import type { Env, Session } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

export const FolderSchema = z.object({
	id: z.string(),
	name: z.string(),
	unreadCount: z.number(),
});

export const CreateFolderRequestSchema = z.object({
	name: z.string(),
});

export const UpdateFolderRequestSchema = z.object({
	name: z.string(),
});

const ErrorResponseSchema = z.object({
	error: z.string(),
});

export function slugify(text: string) {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, "-") // Replace spaces with -
		.replace(/[^\w-]+/g, "") // Remove all non-word chars
		.replace(/--+/g, "-") // Replace multiple - with single -
		.replace(/^-+/, "") // Trim - from start of text
		.replace(/-+$/, ""); // Trim - from end of text
}

export class GetFolders extends OpenAPIRoute {
	schema = {
		summary: "List all folders",
		operationId: "listFolders",
		tags: ["Folders"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "List of folders",
				...contentJson(z.array(FolderSchema)),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);

		const folders = await stub.getFolders();

		return c.json(folders);
	}
}

export class PostFolder extends OpenAPIRoute {
	schema = {
		summary: "Create a folder",
		operationId: "createFolder",
		tags: ["Folders"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
			body: contentJson(CreateFolderRequestSchema),
		},
		responses: {
			"201": { description: "Folder created", ...contentJson(FolderSchema) },
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const { name } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const slug = slugify(name);
		const newFolder = await stub.createFolder(slug, name);

		if (!newFolder) {
			return c.json({ error: "Folder with this name already exists" }, 409);
		}

		return c.json(newFolder, 201);
	}
}

export class PutFolder extends OpenAPIRoute {
	schema = {
		summary: "Update a folder",
		operationId: "updateFolder",
		tags: ["Folders"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
			body: contentJson(UpdateFolderRequestSchema),
		},
		responses: {
			"200": { description: "Updated folder", ...contentJson(FolderSchema) },
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { name } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const updatedFolder = await stub.updateFolder(id, name);

		if (!updatedFolder) {
			return c.json({ error: "Folder not found" }, 404);
		}

		return c.json(updatedFolder);
	}
}

export class DeleteFolder extends OpenAPIRoute {
	schema = {
		summary: "Delete a folder",
		operationId: "deleteFolder",
		tags: ["Folders"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
		},
		responses: {
			"204": { description: "Deleted successfully" },
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const success = await stub.deleteFolder(id);

		if (!success) {
			return c.json({ error: "Folder not found or cannot be deleted" }, 400);
		}

		return c.body(null, 204);
	}
}
