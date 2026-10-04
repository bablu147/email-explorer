import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMailboxId } from "../src/inbound.ts";

/** An R2 bucket reduced to what resolveMailboxId uses, with a log of the keys it looked up. */
function fakeEnv(mailboxIds: string[], pageSize = 1000) {
	const keys = mailboxIds.map((id) => `mailboxes/${id}.json`);
	const heads: string[] = [];
	const env = {
		BUCKET: {
			head: async (key: string) => {
				heads.push(key);
				return keys.includes(key) ? {} : null;
			},
			list: async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
				const all = keys.filter((k) => k.startsWith(prefix));
				const start = cursor ? Number(cursor) : 0;
				const end = start + pageSize;
				return {
					objects: all.slice(start, end).map((key) => ({ key })),
					truncated: end < all.length,
					cursor: String(end),
				};
			},
			put: async (key: string) => {
				keys.push(key);
			},
		},
		// biome-ignore lint/suspicious/noExplicitAny: a fake of the Worker bindings
	} as any;
	return { env, keys, heads };
}

test("the lower-cased mailbox wins over a capital-letter ghost, whatever case the mail used", async () => {
	const { env } = fakeEnv(["Support@Reflect.cloud", "support@reflect.cloud"]);
	assert.equal(await resolveMailboxId(env, "Support@Reflect.cloud"), "support@reflect.cloud");
	assert.equal(await resolveMailboxId(env, "support@reflect.cloud"), "support@reflect.cloud");
	assert.equal(await resolveMailboxId(env, "SUPPORT@REFLECT.CLOUD"), "support@reflect.cloud");
});

test("the lower-cased key is the first one looked up", async () => {
	const { env, heads } = fakeEnv(["Support@Reflect.cloud", "support@reflect.cloud"]);
	await resolveMailboxId(env, "Support@Reflect.cloud");
	assert.deepEqual(heads, ["mailboxes/support@reflect.cloud.json"]);
});

test("a mailbox that only exists with capitals is still found: exact key, then any letter case", async () => {
	const { env, keys } = fakeEnv(["Legacy@Reflect.cloud"]);
	assert.equal(await resolveMailboxId(env, "Legacy@Reflect.cloud"), "Legacy@Reflect.cloud");
	assert.equal(await resolveMailboxId(env, "legacy@reflect.cloud"), "Legacy@Reflect.cloud");
	assert.equal(await resolveMailboxId(env, "LEGACY@reflect.cloud"), "Legacy@Reflect.cloud");
	assert.equal(keys.length, 1, "no mailbox was created");
});

test("the any-letter-case scan reads every page of the listing", async () => {
	const { env, keys } = fakeEnv(["a@reflect.cloud", "b@reflect.cloud", "Legacy@Reflect.cloud"], 1);
	assert.equal(await resolveMailboxId(env, "legacy@reflect.cloud"), "Legacy@Reflect.cloud");
	assert.equal(keys.length, 3);
});

test("an address with no mailbox gets one under the lower-cased address", async () => {
	const { env, keys } = fakeEnv(["other@reflect.cloud"]);
	assert.equal(await resolveMailboxId(env, "New.Arrival@Reflect.Cloud"), "new.arrival@reflect.cloud");
	assert.ok(keys.includes("mailboxes/new.arrival@reflect.cloud.json"));
	assert.ok(!keys.includes("mailboxes/New.Arrival@Reflect.Cloud.json"));
});
