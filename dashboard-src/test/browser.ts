// The two browser globals the session code uses, localStorage and window.location, for the tests
// that need them. A test installs them and removes them again: every suite runs in the same Node
// process, and a `window` left behind would change what the other suites' code believes about
// where it is running.
export const storage = new Map<string, string>();
/** Every address the page was sent to with window.location.assign. */
export const assigned: string[] = [];

const localStorageStub = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => void storage.set(key, String(value)),
	removeItem: (key: string) => void storage.delete(key),
};

export const browser = {
	/** A fresh browser, empty storage, at `href`. */
	install(href = "https://mail.test/") {
		storage.clear();
		assigned.length = 0;
		const url = new URL(href);
		const location = {
			origin: url.origin,
			pathname: url.pathname,
			search: url.search,
			hash: url.hash,
			assign: (to: string) => void assigned.push(to),
		};
		Object.defineProperty(globalThis, "localStorage", { value: localStorageStub, configurable: true });
		Object.defineProperty(globalThis, "window", { value: { location }, configurable: true });
	},
	remove() {
		delete (globalThis as any).localStorage;
		delete (globalThis as any).window;
	},
};
