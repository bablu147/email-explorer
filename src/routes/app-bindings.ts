import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import type { AppBinding, Env, Session } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

// Schemas
export const AppPlatformEnum = z.enum(["playstore", "appstore", "website"]);

export const AppBindingSchema = z.object({
	email: z.string(),
	app_name: z.string(),
	app_icon_url: z.string(),
	app_url: z.string(),
	platform: AppPlatformEnum,
	developer_name: z.string().nullable().optional(),
	created_at: z.number().optional(),
	updated_at: z.number().optional(),
});

export const AppMetadataItemSchema = z.object({
	app_name: z.string(),
	app_icon_url: z.string(),
	app_url: z.string(),
	platform: AppPlatformEnum,
	developer_name: z.string().nullable().optional(),
});

export const UpsertAppBindingRequestSchema = z.object({
	email: z.string().min(1, "Email is required"),
	app_name: z.string().min(1, "App name is required"),
	app_icon_url: z.string().url("Valid icon URL is required"),
	app_url: z.string().url("Valid app URL is required"),
	platform: AppPlatformEnum,
	developer_name: z.string().nullable().optional(),
});

export const ErrorResponseSchema = z.object({
	error: z.string(),
});

export const SuccessResponseSchema = z.object({
	status: z.string(),
});

// Helper function to get auth DO singleton
function getAuthDO(env: Env) {
	const authId = env.MAILBOX.idFromName("AUTH");
	return env.MAILBOX.get(authId);
}

// -------------------------------------------------------------
// Lookup Engine
// -------------------------------------------------------------

interface AppMetadataItem {
	app_name: string;
	app_icon_url: string;
	app_url: string;
	platform: "playstore" | "appstore" | "website";
	developer_name?: string | null;
}

const COMMON_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.9",
};

/**
 * Lookup software in Apple iTunes API
 */
async function searchItunes(query: string, limit = 8): Promise<AppMetadataItem[]> {
	try {
		const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&limit=${limit}`;
		const res = await fetch(url, {
			signal: AbortSignal.timeout(6000),
		});
		if (!res.ok) return [];
		const data = (await res.json()) as any;
		if (!data.results || !Array.isArray(data.results)) return [];

		return data.results.map((item: any) => {
			let icon = item.artworkUrl512 || item.artworkUrl100 || item.artworkUrl60;
			if (icon && icon.includes("100x100bb")) {
				icon = icon.replace("100x100bb", "512x512bb");
			}
			return {
				app_name: item.trackName || item.trackCensoredName || query,
				app_icon_url: icon,
				app_url: item.trackViewUrl,
				platform: "appstore",
				developer_name: item.artistName || item.sellerName || null,
			};
		});
	} catch {
		return [];
	}
}

/**
 * Lookup single iOS app by iTunes Track ID or Bundle ID
 */
async function lookupItunesById(id: string, isBundleId = false): Promise<AppMetadataItem | null> {
	try {
		const param = isBundleId ? `bundleId=${encodeURIComponent(id)}` : `id=${encodeURIComponent(id)}`;
		const url = `https://itunes.apple.com/lookup?${param}`;
		const res = await fetch(url, {
			signal: AbortSignal.timeout(6000),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as any;
		if (!data.results || data.results.length === 0) return null;
		const item = data.results[0];
		let icon = item.artworkUrl512 || item.artworkUrl100 || item.artworkUrl60;
		if (icon && icon.includes("100x100bb")) {
			icon = icon.replace("100x100bb", "512x512bb");
		}
		return {
			app_name: item.trackName || item.trackCensoredName,
			app_icon_url: icon,
			app_url: item.trackViewUrl,
			platform: "appstore",
			developer_name: item.artistName || item.sellerName || null,
		};
	} catch {
		return null;
	}
}

/**
 * Fetch Google Play Store app details by Package ID
 */
async function lookupPlayStoreDetails(packageId: string): Promise<AppMetadataItem | null> {
	try {
		const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=en&gl=US`;
		const res = await fetch(url, {
			headers: COMMON_HEADERS,
			signal: AbortSignal.timeout(6000),
		});
		if (!res.ok) return null;
		const html = await res.text();

		const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1]
			|| html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i)?.[1]
			|| "";
		let name = ogTitle.replace(/\s*-\s*Apps on Google Play$/i, "").replace(/&amp;/g, "&").trim();
		if (!name) {
			const h1 = html.match(/<h1[^>]*itemprop=["']name["'][^>]*>(?:<span[^>]*>)?([^<]+)/i)?.[1];
			name = h1 ? h1.trim() : packageId;
		}

		let icon = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1]
			|| html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1]
			|| "";
		if (icon) {
			icon = icon.replace(/=s\d+(-rw)?/, "=s256");
		}

		const devMatch = html.match(/\/store\/apps\/developer\?id=([^"&'\s]+)/i)
			|| html.match(/\/store\/apps\/dev\?id=([^"&'\s]+)/i);
		let devName: string | null = null;
		if (devMatch && devMatch[1]) {
			devName = decodeURIComponent(devMatch[1].replace(/\+/g, " "));
		}

		if (!icon) {
			// Fallback icon via google service
			icon = `https://www.google.com/s2/favicons?domain=play.google.com&sz=128`;
		}

		return {
			app_name: name,
			app_icon_url: icon,
			app_url: `https://play.google.com/store/apps/details?id=${packageId}`,
			platform: "playstore",
			developer_name: devName,
		};
	} catch {
		return null;
	}
}

/**
 * Search Google Play Store and retrieve top results
 */
async function searchPlayStore(query: string, limit = 5): Promise<AppMetadataItem[]> {
	try {
		const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps&hl=en&gl=US`;
		const res = await fetch(searchUrl, {
			headers: COMMON_HEADERS,
			signal: AbortSignal.timeout(6000),
		});
		if (!res.ok) return [];
		const html = await res.text();

		const pkgMatches = [...html.matchAll(/\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g)];
		const uniquePkgs = Array.from(new Set(pkgMatches.map((m) => m[1])))
			.filter((id) => !id.includes("search") && id.includes("."))
			.slice(0, limit);

		if (uniquePkgs.length === 0) return [];

		const results = await Promise.all(
			uniquePkgs.map((pkg) => lookupPlayStoreDetails(pkg)),
		);

		return results.filter((item): item is AppMetadataItem => item !== null);
	} catch {
		return [];
	}
}

/**
 * Fetch website metadata (title, icon, developer/domain)
 */
async function lookupWebsite(inputUrl: string): Promise<AppMetadataItem | null> {
	let targetUrl = inputUrl.trim();
	if (!/^https?:\/\//i.test(targetUrl)) {
		targetUrl = "https://" + targetUrl;
	}

	let parsed: URL;
	try {
		parsed = new URL(targetUrl);
	} catch {
		return null;
	}

	const fallbackIcon = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`;

	try {
		const res = await fetch(targetUrl, {
			headers: COMMON_HEADERS,
			signal: AbortSignal.timeout(6000),
			redirect: "follow",
		});

		const html = await res.text();

		// Title extraction
		const ogSiteName = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]
			|| html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1];
		const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
			|| html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
		const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

		let appName = ogSiteName || ogTitle || htmlTitle || parsed.hostname;
		appName = appName.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

		// Icon extraction: apple-touch-icon preferred for high res, then standard icon/favicon
		const touchIcon = html.match(/<link[^>]+rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["'][^>]+href=["']([^"']+)["']/i)?.[1]
			|| html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["']/i)?.[1];
		const favicon = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i)?.[1]
			|| html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i)?.[1];

		let iconUrl = touchIcon || favicon;
		if (iconUrl) {
			try {
				iconUrl = new URL(iconUrl, targetUrl).toString();
			} catch {
				iconUrl = fallbackIcon;
			}
		} else {
			iconUrl = fallbackIcon;
		}

		return {
			app_name: appName,
			app_icon_url: iconUrl,
			app_url: targetUrl,
			platform: "website",
			developer_name: parsed.hostname,
		};
	} catch {
		// Even if direct fetch fails, return domain with fallback icon
		return {
			app_name: parsed.hostname,
			app_icon_url: fallbackIcon,
			app_url: targetUrl,
			platform: "website",
			developer_name: parsed.hostname,
		};
	}
}

/**
 * Core lookup orchestrator
 */
export async function performAppLookup(
	rawQuery: string,
	platformFilter: "all" | "playstore" | "appstore" | "website" = "all",
): Promise<AppMetadataItem[]> {
	const query = rawQuery.trim();
	if (!query) return [];

	// 1. Direct App Store URL check
	const appStoreUrlMatch = query.match(/apps\.apple\.com\/[^/]*\/(?:app\/[^/]*\/)?id(\d+)/i)
		|| query.match(/itunes\.apple\.com\/[^/]*\/(?:app\/[^/]*\/)?id(\d+)/i);
	if (appStoreUrlMatch && appStoreUrlMatch[1]) {
		const item = await lookupItunesById(appStoreUrlMatch[1]);
		return item ? [item] : [];
	}

	// 2. Direct Play Store URL check
	const playStoreUrlMatch = query.match(/play\.google\.com\/store\/apps\/details\?(?:[^&]*&)*id=([a-zA-Z0-9._]+)/i);
	if (playStoreUrlMatch && playStoreUrlMatch[1]) {
		const item = await lookupPlayStoreDetails(playStoreUrlMatch[1]);
		return item ? [item] : [];
	}

	// 3. Platform specific handling
	if (platformFilter === "appstore") {
		const idMatch = query.match(/^id(\d+)$/i) || query.match(/^(\d{7,})$/);
		if (idMatch && idMatch[1]) {
			const item = await lookupItunesById(idMatch[1]);
			if (item) return [item];
		}
		return searchItunes(query, 10);
	}

	if (platformFilter === "playstore") {
		// If query looks like an android package ID
		if (/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+){2,}$/.test(query)) {
			const item = await lookupPlayStoreDetails(query);
			if (item) return [item];
		}
		return searchPlayStore(query, 6);
	}

	if (platformFilter === "website") {
		const site = await lookupWebsite(query);
		return site ? [site] : [];
	}

	// 4. Default / "all": Check if input is a direct URL or domain
	if (/^https?:\/\//i.test(query)) {
		const site = await lookupWebsite(query);
		return site ? [site] : [];
	}

	// Check if package name format
	if (/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+){2,}$/.test(query)) {
		const playItem = await lookupPlayStoreDetails(query);
		if (playItem) return [playItem];
		const itunesItem = await lookupItunesById(query, true);
		if (itunesItem) return [itunesItem];
	}

	// Check if domain name format (e.g. stripe.com, getreflect.com)
	if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(query) && !query.includes(" ")) {
		const site = await lookupWebsite(query);
		if (site) return [site];
	}

	// 5. Query is an app name: search both stores in parallel
	const [itunesRes, playRes] = await Promise.allSettled([
		searchItunes(query, 6),
		searchPlayStore(query, 4),
	]);

	const itunesList = itunesRes.status === "fulfilled" ? itunesRes.value : [];
	const playList = playRes.status === "fulfilled" ? playRes.value : [];

	// Interleave results for balanced display
	const combined: AppMetadataItem[] = [];
	const maxLen = Math.max(itunesList.length, playList.length);
	for (let i = 0; i < maxLen; i++) {
		if (i < itunesList.length) combined.push(itunesList[i]);
		if (i < playList.length) combined.push(playList[i]);
	}

	return combined;
}

// -------------------------------------------------------------
// Route Handlers
// -------------------------------------------------------------

export class GetAppBindings extends OpenAPIRoute {
	schema = {
		summary: "List all email-to-app bindings",
		operationId: "getAppBindings",
		tags: ["App Bindings"],
		responses: {
			"200": {
				description: "List of all app bindings",
				...contentJson(z.object({ bindings: z.array(AppBindingSchema) })),
			},
		},
	};

	async handle(c: AppContext) {
		const authDO = getAuthDO(c.env);
		const bindings = await authDO.getAllAppBindings();
		return c.json({ bindings });
	}
}

export class GetAppBindingByEmail extends OpenAPIRoute {
	schema = {
		summary: "Get app binding for an email address",
		operationId: "getAppBindingByEmail",
		tags: ["App Bindings"],
		request: {
			params: z.object({
				email: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "App binding details",
				...contentJson(AppBindingSchema),
			},
			"404": {
				description: "Binding not found",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const email = decodeURIComponent(data.params.email);
		const authDO = getAuthDO(c.env);
		const binding = await authDO.getAppBinding(email);

		if (!binding) {
			return c.json({ error: "Binding not found" }, 404);
		}

		return c.json(binding);
	}
}

export class PostAppBinding extends OpenAPIRoute {
	schema = {
		summary: "Create or update an email-to-app binding",
		operationId: "postAppBinding",
		tags: ["App Bindings"],
		request: {
			body: contentJson(UpsertAppBindingRequestSchema),
		},
		responses: {
			"200": {
				description: "Binding saved successfully",
				...contentJson(AppBindingSchema),
			},
			"400": {
				description: "Invalid input",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const body = data.body;
		if (!body.email || !body.app_name || !body.app_icon_url || !body.app_url || !body.platform) {
			return c.json({ error: "Missing required fields" }, 400);
		}
		const authDO = getAuthDO(c.env);
		const saved = await authDO.setAppBinding({
			email: body.email,
			app_name: body.app_name,
			app_icon_url: body.app_icon_url,
			app_url: body.app_url,
			platform: body.platform,
			developer_name: body.developer_name,
		});
		return c.json(saved);
	}
}

export class DeleteAppBinding extends OpenAPIRoute {
	schema = {
		summary: "Delete an email-to-app binding",
		operationId: "deleteAppBinding",
		tags: ["App Bindings"],
		request: {
			params: z.object({
				email: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "Binding deleted successfully",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Error deleting binding",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const email = decodeURIComponent(data.params.email);
		const authDO = getAuthDO(c.env);
		await authDO.deleteAppBinding(email);
		return c.json({ status: "success" });
	}
}

export class GetAppLookup extends OpenAPIRoute {
	schema = {
		summary: "Lookup app metadata by search query or URL",
		operationId: "getAppLookup",
		tags: ["App Bindings"],
		request: {
			query: z.object({
				query: z.string().min(1, "Search query is required"),
				platform: z.enum(["all", "playstore", "appstore", "website"]).optional(),
			}),
		},
		responses: {
			"200": {
				description: "Matching app search results or metadata",
				...contentJson(z.object({ results: z.array(AppMetadataItemSchema) })),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const query = data.query.query;
		const platform = data.query.platform || "all";
		const results = await performAppLookup(query, platform);
		return c.json({ results });
	}
}
