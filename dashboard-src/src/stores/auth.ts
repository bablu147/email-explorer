import { defineStore } from "pinia";
import { computed, ref } from "vue";
import api, { apiErrorMessage, onSessionEnded } from "@/services/api";
import { unsubscribeFromPush } from "@/services/pushNotification";

export interface User {
	id: string;
	email: string;
	isAdmin: boolean;
}

/**
 * What this browser keeps about the signed-in user. There is no token in it: the session is an
 * HttpOnly cookie that page script cannot read, and the server decides from that cookie alone.
 * These facts only let the router choose a page without waiting for a request.
 */
export interface Session {
	userId: string;
	email: string;
	isAdmin: boolean;
	expiresAt: number;
}

const STORAGE_KEY = "reflect_user";
/** The previous release kept the whole sign-in response under this key, session token included. */
const LEGACY_KEY = "session";

/** Only these four fields are ever kept, whatever else a response carries. */
const factsOf = (data: any): Session | null => {
	if (!data || typeof data.userId !== "string" || typeof data.email !== "string") return null;
	return {
		userId: data.userId,
		email: data.email,
		isAdmin: data.isAdmin === true,
		expiresAt: Number(data.expiresAt) || 0,
	};
};

// Storage can be unavailable (private mode, blocked site data). The cookie still works then; the
// user is only asked to sign in again after a reload.
const readStored = (): Session | null => {
	try {
		const legacy = localStorage.getItem(LEGACY_KEY);
		// Removed first, whatever it holds: it is where the token was readable by page script.
		if (legacy !== null) localStorage.removeItem(LEGACY_KEY);
		const facts = factsOf(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? legacy ?? "null"));
		if (facts) localStorage.setItem(STORAGE_KEY, JSON.stringify(facts));
		return facts;
	} catch {
		return null;
	}
};

const writeStored = (facts: Session | null) => {
	try {
		if (facts) localStorage.setItem(STORAGE_KEY, JSON.stringify(facts));
		else localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem(LEGACY_KEY);
	} catch {
		// see readStored
	}
};

export const useAuthStore = defineStore("auth", () => {
	const session = ref<Session | null>(readStored());
	const loading = ref(false);
	const error = ref<string | null>(null);

	const isAuthenticated = computed(() => session.value !== null);
	const isAdmin = computed(() => session.value?.isAdmin ?? false);
	const currentUser = computed(() =>
		session.value
			? {
					id: session.value.userId,
					email: session.value.email,
					isAdmin: session.value.isAdmin,
				}
			: null,
	);

	const remember = (facts: Session) => {
		session.value = facts;
		writeStored(facts);
	};
	const forget = () => {
		session.value = null;
		writeStored(null);
	};
	// A 401 on any request: the cookie is no longer a session (api.ts also leads to the sign-in page).
	onSessionEnded(forget);

	async function register(email: string, password: string) {
		loading.value = true;
		error.value = null;
		try {
			const response = await api.register(email, password);
			// After registration, login
			await login(email, password);
			return response.data;
		} catch (err: any) {
			error.value = err.response?.data?.error || "Registration failed";
			throw err;
		} finally {
			loading.value = false;
		}
	}

	async function login(email: string, password: string) {
		loading.value = true;
		error.value = null;
		try {
			const response = await api.login(email, password);
			const facts = factsOf(response.data);
			if (!facts) throw new Error("The sign-in response did not name a user");
			remember(facts);
			return facts;
		} catch (err: any) {
			// The server's own sentence: wrong password, disabled account, or too many attempts
			// (which says how long to wait).
			error.value = apiErrorMessage(
				err,
				err?.response?.status === 429
					? "Too many attempts. Try again in a few minutes."
					: err?.response
						? "Login failed"
						: "Could not reach the server. Check your connection and try again.",
			);
			throw err;
		} finally {
			loading.value = false;
		}
	}

	async function logout() {
		loading.value = true;
		try {
			if (session.value) {
				// Stop this device receiving the account's mail previews once signed out (shared devices).
				// Best-effort and time-boxed: it must never block signing out.
				await Promise.race([
					unsubscribeFromPush().catch(() => false),
					new Promise((resolve) => setTimeout(resolve, 2500)),
				]);
				await api.logout();
			}
		} catch (err) {
			console.error("Logout error:", err);
		} finally {
			forget();
			loading.value = false;
		}
	}

	/**
	 * Asks the server whose session the cookie is and refreshes what is kept. Only a 401 signs the
	 * user out, and api.ts does that; a 503, a network failure or an answer that names no user
	 * leaves everything as it was.
	 */
	async function checkAuth() {
		try {
			const facts = factsOf((await api.getCurrentUser()).data);
			// Not when the user signed out while the request was on its way.
			if (facts && session.value) remember(facts);
		} catch {
			// 401: already forgotten through onSessionEnded. Anything else: not a verdict.
		}
		return session.value !== null;
	}

	// What was read from storage is a hint from the last visit, so it is checked once per page
	// load. This is also what keeps a user of the previous release signed in: their stored token
	// object is gone (readStored), the cookie that sign-in set is still valid, and the server
	// answers from the cookie.
	if (session.value) void checkAuth();

	return {
		session,
		loading,
		error,
		isAuthenticated,
		isAdmin,
		currentUser,
		register,
		login,
		logout,
		checkAuth,
	};
});
