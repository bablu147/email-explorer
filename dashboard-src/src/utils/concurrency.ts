/**
 * Like `Promise.allSettled(items.map(fn))`, but with at most `limit` calls in flight.
 * Bulk actions on hundreds of rows would otherwise open hundreds of simultaneous requests,
 * which browsers queue anyway (6 per origin on HTTP/1.1) and which can trip rate limits.
 * Results keep the order of `items`.
 */
export async function settleAll<T>(
	items: T[],
	fn: (item: T) => Promise<unknown>,
	limit = 6,
): Promise<PromiseSettledResult<unknown>[]> {
	const results: PromiseSettledResult<unknown>[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			try {
				results[i] = { status: "fulfilled", value: await fn(items[i]) };
			} catch (reason) {
				results[i] = { status: "rejected", reason };
			}
		}
	};
	await Promise.all(Array.from({ length: Math.max(0, Math.min(limit, items.length)) }, worker));
	return results;
}
