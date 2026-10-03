import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import type { Env, Session } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

export const ContactSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
});

export const CreateContactRequestSchema = z.object({
	name: z.string().optional(),
	email: z.string(),
});

export const UpdateContactRequestSchema = z.object({
	name: z.string().optional(),
	email: z.string().optional(),
});

const ErrorResponseSchema = z.object({
	error: z.string(),
});

export class GetContacts extends OpenAPIRoute {
	schema = {
		summary: "List all contacts",
		operationId: "listContacts",
		tags: ["Contacts"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "List of contacts",
				...contentJson(z.array(ContactSchema)),
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

		const contacts = await stub.getContacts();

		return c.json(contacts);
	}
}

export class PostContact extends OpenAPIRoute {
	schema = {
		summary: "Create a contact",
		operationId: "createContact",
		tags: ["Contacts"],
		request: {
			params: z.object({
				mailboxId: z.string(),
			}),
			body: contentJson(CreateContactRequestSchema),
		},
		responses: {
			"201": { description: "Contact created", ...contentJson(ContactSchema) },
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId } = data.params;
		const { name, email } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const id = ns.idFromName(mailboxId);
		const stub = ns.get(id);

		const newContact = await stub.createContact({ name, email });

		return c.json(newContact, 201);
	}
}

export class PutContact extends OpenAPIRoute {
	schema = {
		summary: "Update a contact",
		operationId: "updateContact",
		tags: ["Contacts"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
			body: contentJson(UpdateContactRequestSchema),
		},
		responses: {
			"200": { description: "Updated contact", ...contentJson(ContactSchema) },
			"404": { description: "Not found", ...contentJson(ErrorResponseSchema) },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { mailboxId, id } = data.params;
		const { name, email } = data.body;

		const key = `mailboxes/${mailboxId}.json`;
		const obj = await c.env.BUCKET.head(key);
		if (!obj) {
			return c.json({ error: "Not found" }, 404);
		}

		const ns = c.env.MAILBOX;
		const doId = ns.idFromName(mailboxId);
		const stub = ns.get(doId);

		const updatedContact = await stub.updateContact(Number.parseInt(id, 10), {
			name,
			email,
		});

		if (!updatedContact) {
			return c.json({ error: "Contact not found" }, 404);
		}

		return c.json(updatedContact);
	}
}

export class DeleteContact extends OpenAPIRoute {
	schema = {
		summary: "Delete a contact",
		operationId: "deleteContact",
		tags: ["Contacts"],
		request: {
			params: z.object({
				mailboxId: z.string(),
				id: z.string(),
			}),
		},
		responses: {
			"204": { description: "Deleted successfully" },
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

		stub.deleteContact(Number.parseInt(id, 10));

		return c.body(null, 204);
	}
}
