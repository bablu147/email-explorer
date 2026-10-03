/**
 * Reflect Mail — Progressive Web App Service Worker
 * Handles app shell precaching, stale-while-revalidate asset caching,
 * Web Push events, and interactive notification actions.
 */

const CACHE_NAME = "reflect-mail-v1";

const PRECACHE_ASSETS = [
	"/",
	"/index.html",
	"/favicon.svg",
	"/manifest.webmanifest",
	"/icons/icon-192.png",
	"/icons/icon-512.png",
	"/icons/badge-72.png",
];

// Installation: Precache core app shell with resilient error handling
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then(async (cache) => {
				for (const asset of PRECACHE_ASSETS) {
					try {
						await cache.add(asset);
					} catch (err) {
						console.warn("Failed to precache asset:", asset, err);
					}
				}
			})
			.then(() => self.skipWaiting()),
	);
});

// Activation: Clean up stale caches and claim clients immediately
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((name) => {
						if (name !== CACHE_NAME) {
							return caches.delete(name);
						}
					}),
				);
			})
			.then(() => self.clients.claim()),
	);
});

// Fetch: Strategy depending on request type
self.addEventListener("fetch", (event) => {
	const request = event.request;
	const url = new URL(request.url);

	// Never intercept non-GET requests or browser extension schemes
	if (request.method !== "GET" || !url.protocol.startsWith("http")) {
		return;
	}

	// 1. API calls & auth: Always network-only
	if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/docs")) {
		return;
	}

	// 2. Navigation requests: Network-first, fallback to cached index.html
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request).catch(async () => {
				const cached = (await caches.match("/index.html")) || (await caches.match("/"));
				if (cached) return cached;
				return new Response("Offline - Reflect Mail", {
					status: 503,
					headers: { "Content-Type": "text/html" },
				});
			}),
		);
		return;
	}

	// 3. Static assets (/assets/*, fonts, icons, manifest): Stale-While-Revalidate
	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			const fetchPromise = fetch(request)
				.then((networkResponse) => {
					if (networkResponse && networkResponse.status === 200) {
						const responseToCache = networkResponse.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(request, responseToCache);
						});
					}
					return networkResponse;
				})
				.catch((err) => {
					if (cachedResponse) return cachedResponse;
					throw err;
				});

			return cachedResponse || fetchPromise;
		}),
	);
});

// Push Notifications: Listen for encrypted Web Push alerts
self.addEventListener("push", (event) => {
	let data = {};
	if (event.data) {
		try {
			data = event.data.json();
		} catch {
			data = { title: "Reflect Mail", body: event.data.text() };
		}
	}

	const title = data.title || "Reflect Mail";
	const options = {
		body: data.body || "You have a new message",
		icon: data.icon || "/icons/icon-192.png",
		badge: data.badge || "/icons/badge-72.png",
		tag: data.tag || `reflect-mail-${Date.now()}`,
		data: data.data || { url: "/" },
		renotify: true,
		vibrate: [100, 50, 100],
		actions: data.actions || [
			{ action: "open", title: "Open" },
			{ action: "mark_read", title: "Mark as Read" },
		],
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click: Handle action buttons and window focusing
self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const action = event.action;
	const notifData = event.notification.data || {};
	const targetUrl = notifData.url || "/";

	// Action: Mark as Read in background
	if (action === "mark_read" && notifData.mailboxId && notifData.emailId) {
		const putUrl = `/api/v1/mailboxes/${encodeURIComponent(notifData.mailboxId)}/emails/${encodeURIComponent(notifData.emailId)}`;
		event.waitUntil(
			fetch(putUrl, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ read: true }),
				credentials: "include",
			}).catch((err) => console.error("Error marking read from notification:", err)),
		);
		return;
	}

	// Action: Open or click on notification card -> focus or open client window
	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clientList) => {
				for (const client of clientList) {
					if ("focus" in client) {
						client.focus();
						if ("navigate" in client && targetUrl) {
							client.navigate(targetUrl);
						}
						return;
					}
				}
				if (self.clients.openWindow) {
					return self.clients.openWindow(targetUrl);
				}
			}),
	);
});
