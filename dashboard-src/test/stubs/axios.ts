// Stands in for axios in the api tests: every POST is recorded and answered here. No request is made.
export const posted: { url: string; body: any }[] = [];

// What src/services/api.ts gave axios: the options of each client it made and the interceptors it
// registered. The session tests read these, and run the response interceptors through `fail`.
export const created: any[] = [];
export const requestInterceptors: ((config: any) => any)[] = [];
const responseErrorHandlers: ((error: any) => any)[] = [];

export const client = {
	interceptors: {
		request: {
			use(onFulfilled?: (config: any) => any) {
				if (onFulfilled) requestInterceptors.push(onFulfilled);
			},
		},
		response: {
			use(_onFulfilled?: unknown, onRejected?: (error: any) => any) {
				if (onRejected) responseErrorHandlers.push(onRejected);
			},
		},
	},
	defaults: { headers: { common: {} as Record<string, string> } },
	post: async (url: string, body?: any) => {
		posted.push({ url, body });
		return { data: { id: "x" } };
	},
	get: async () => ({ data: null }),
	put: async () => ({ data: null }),
	delete: async () => ({ data: null }),
};

export default {
	create: (options?: any) => {
		created.push(options);
		return client;
	},
};

/**
 * A request that failed, passed through the app's response interceptors as axios does it. `status`
 * null is a failure with no response at all (the network). Resolves to what the interceptors
 * rejected with: the caller of the request must still get its error.
 */
export const fail = async (status: number | null, data: any = {}, url = "/api/v1/mailboxes") => {
	const error = status === null ? { message: "Network Error", config: { url } } : { response: { status, data }, config: { url } };
	const rejections: unknown[] = [];
	for (const onRejected of responseErrorHandlers) {
		await Promise.resolve()
			.then(() => onRejected(error))
			.catch((rejection) => rejections.push(rejection));
	}
	return { error, rejections };
};
