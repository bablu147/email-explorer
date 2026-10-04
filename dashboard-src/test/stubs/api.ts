// Stands in for src/services/api.ts in the composer tests. Every call is recorded; a test answers
// it by setting `handlers.<name>`, and anything else resolves to an empty response. No request is made.
export const calls: { name: string; args: any[] }[] = [];
export const handlers: Record<string, (...args: any[]) => any> = {};

const api: any = new Proxy(
	{},
	{
		get(_target, name: string) {
			return (...args: any[]) => {
				calls.push({ name, args: JSON.parse(JSON.stringify(args)) });
				const handler = handlers[name];
				return handler ? handler(...args) : Promise.resolve({ data: {} });
			};
		},
	},
);
export default api;

export const apiErrorMessage = (err: any, fallback: string) => err?.response?.data?.error || fallback;
