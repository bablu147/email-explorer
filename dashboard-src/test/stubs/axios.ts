// Stands in for axios in the api tests: every POST is recorded and answered here. No request is made.
export const posted: { url: string; body: any }[] = [];

const client = {
	interceptors: { request: { use() {} }, response: { use() {} } },
	defaults: { headers: { common: {} as Record<string, string> } },
	post: async (url: string, body?: any) => {
		posted.push({ url, body });
		return { data: { id: "x" } };
	},
	get: async () => ({ data: null }),
	put: async () => ({ data: null }),
	delete: async () => ({ data: null }),
};

export default { create: () => client };
