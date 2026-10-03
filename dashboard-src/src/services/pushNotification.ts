import axios from "axios";
import { ref } from "vue";

/** Push endpoints require a signed-in user; send the same session token the rest of the app uses. */
function authConfig() {
	try {
		const stored = JSON.parse(localStorage.getItem("session") || "null");
		if (stored?.id) return { headers: { Authorization: `Bearer ${stored.id}` } };
	} catch {
		/* fall back to the session cookie */
	}
	return {};
}

export interface PushStatus {
	isSupported: boolean;
	permission: NotificationPermission;
	isSubscribed: boolean;
	loading: boolean;
}

const isSupported =
	typeof window !== "undefined" &&
	"serviceWorker" in navigator &&
	"PushManager" in window &&
	"Notification" in window;

const permission = ref<NotificationPermission>(
	typeof window !== "undefined" && "Notification" in window
		? Notification.permission
		: "denied",
);

const isSubscribed = ref<boolean>(false);
const loading = ref<boolean>(false);
let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Convert base64url string to Uint8Array for PushManager applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * Initialize Service Worker and retrieve current push subscription state
 */
export async function initPushNotifications(): Promise<void> {
	if (!isSupported) return;

	try {
		swRegistration = await navigator.serviceWorker.register("/sw.js");
		const existingSub = await swRegistration.pushManager.getSubscription();
		isSubscribed.value = !!existingSub;
		permission.value = Notification.permission;
	} catch (err) {
		console.error("Failed to initialize Service Worker / Push:", err);
	}
}

/**
 * Request notification permission and subscribe to Web Push
 */
export async function subscribeToPush(mailboxId?: string): Promise<boolean> {
	if (!isSupported) {
		throw new Error("Push notifications are not supported on this browser or platform.");
	}

	loading.value = true;
	try {
		// 1. Request user permission
		const perm = await Notification.requestPermission();
		permission.value = perm;

		if (perm !== "granted") {
			isSubscribed.value = false;
			return false;
		}

		// 2. Ensure Service Worker registration is ready
		if (!swRegistration) {
			swRegistration = await navigator.serviceWorker.ready;
		}

		// 3. Fetch VAPID public key from backend
		const keyRes = await axios.get<{ publicKey: string }>("/api/v1/push/vapid-public-key", authConfig());
		const publicKey = keyRes.data.publicKey;
		if (!publicKey) {
			throw new Error("Unable to retrieve VAPID public key from server.");
		}

		const applicationServerKey = urlBase64ToUint8Array(publicKey);

		// 4. Subscribe via PushManager (with automatic key-rotation recovery)
		let sub: PushSubscription;
		try {
			sub = await swRegistration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: applicationServerKey as any,
			});
		} catch (subErr) {
			// If subscription failed (e.g. existing subscription with rotated VAPID key), clean up and retry
			const existing = await swRegistration.pushManager.getSubscription();
			if (existing) {
				await existing.unsubscribe();
				sub = await swRegistration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: applicationServerKey as any,
				});
			} else {
				throw subErr;
			}
		}

		const subJson = sub.toJSON();

		// 5. Send subscription keys to backend
		await axios.post("/api/v1/push/subscribe", {
			endpoint: sub.endpoint,
			keys: {
				p256dh: subJson.keys?.p256dh,
				auth: subJson.keys?.auth,
			},
			mailboxId: mailboxId || undefined,
			userAgent: navigator.userAgent,
		}, authConfig());

		isSubscribed.value = true;
		return true;
	} catch (err: any) {
		console.error("Failed to subscribe to Web Push:", err);
		throw err;
	} finally {
		loading.value = false;
	}
}

/**
 * Unsubscribe from Web Push notifications
 */
export async function unsubscribeFromPush(mailboxId?: string): Promise<boolean> {
	if (!isSupported) return false;

	loading.value = true;
	try {
		if (!swRegistration) {
			swRegistration = await navigator.serviceWorker.ready;
		}

		const sub = await swRegistration.pushManager.getSubscription();
		if (sub) {
			const endpoint = sub.endpoint;
			await sub.unsubscribe();

			// Inform backend to remove subscription
			await axios.post("/api/v1/push/unsubscribe", {
				endpoint,
				mailboxId: mailboxId || undefined,
			}, authConfig());
		}

		isSubscribed.value = false;
		return true;
	} catch (err) {
		console.error("Failed to unsubscribe from Web Push:", err);
		throw err;
	} finally {
		loading.value = false;
	}
}

/**
 * Send an immediate test Web Push notification to current device
 */
export async function sendTestPush(mailboxId?: string): Promise<{ success: boolean; message?: string }> {
	if (!isSupported) {
		throw new Error("Push notifications are not supported on this browser.");
	}

	loading.value = true;
	try {
		if (!swRegistration) {
			swRegistration = await navigator.serviceWorker.ready;
		}
		const sub = await swRegistration.pushManager.getSubscription();

		const res = await axios.post<{ success: boolean; message?: string; sentCount?: number }>(
			"/api/v1/push/test",
			{
				endpoint: sub?.endpoint || undefined,
				mailboxId: mailboxId || undefined,
			},
			authConfig(),
		);

		return res.data;
	} catch (err: any) {
		console.error("Failed to send test push notification:", err);
		throw err;
	} finally {
		loading.value = false;
	}
}

export function usePushNotification() {
	return {
		isSupported,
		permission,
		isSubscribed,
		loading,
		init: initPushNotifications,
		subscribe: subscribeToPush,
		unsubscribe: unsubscribeFromPush,
		sendTestNotification: sendTestPush,
	};
}
