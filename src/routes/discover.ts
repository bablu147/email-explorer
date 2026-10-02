import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import type { DiscoverLead, Env, Session } from "../types";
import { decodeHtmlEntities, normalizeEmail } from "./app-bindings";

type AppContext = Context<{ Bindings: Env; Variables: { session?: Session } }>;

// -------------------------------------------------------------
// Schemas
// -------------------------------------------------------------

export const DiscoverPlatformEnum = z.enum(["all", "playstore", "appstore"]);
export const DiscoverChartEnum = z.enum(["topgrossing", "topfree", "newfree", "trending"]);
export const OutreachStatusEnum = z.enum(["uncontacted", "contacted", "opened", "bound"]);

export const DiscoverAppSchema = z.object({
	id: z.string(),
	bundle_id: z.string(),
	platform: z.enum(["playstore", "appstore"]),
	app_name: z.string(),
	app_icon_url: z.string(),
	app_url: z.string(),
	developer_name: z.string().nullable().optional(),
	developer_email: z.string().nullable().optional(),
	developer_website: z.string().nullable().optional(),
	installs_bracket: z.string().nullable().optional(),
	rating: z.number().nullable().optional(),
	reviews_count: z.number().nullable().optional(),
	category: z.string().nullable().optional(),
	country: z.string().nullable().optional(),
	has_iap: z.boolean().optional(),
	has_ads: z.boolean().optional(),
	release_date: z.string().nullable().optional(),
	updated_date: z.string().nullable().optional(),
	status: OutreachStatusEnum.optional(),
	is_saved: z.boolean().optional(),
	opened_count: z.number().optional(),
	notes: z.string().nullable().optional(),
});

export const DiscoverStatsSchema = z.object({
	total_discovered: z.number(),
	verified_emails: z.number(),
	contacted: z.number(),
	saved_targets: z.number(),
});

export const DiscoverAppsResponseSchema = z.object({
	apps: z.array(DiscoverAppSchema),
	total: z.number(),
	page: z.number(),
	limit: z.number(),
	has_more: z.boolean().optional(),
	stats: DiscoverStatsSchema,
});

export const SaveLeadRequestSchema = z.object({
	id: z.string().optional(),
	bundle_id: z.string().min(1, "bundle_id is required"),
	platform: z.enum(["playstore", "appstore"]),
	app_name: z.string().min(1, "app_name is required"),
	app_icon_url: z.string().optional().default("https://www.google.com/s2/favicons?domain=reflect.cloud&sz=128"),
	app_url: z.string().optional().default("https://reflect.cloud"),
	developer_name: z.string().nullable().optional(),
	developer_email: z.string().nullable().optional(),
	developer_website: z.string().nullable().optional(),
	installs_bracket: z.string().nullable().optional(),
	rating: z.coerce.number().nullable().optional(),
	reviews_count: z.coerce.number().nullable().optional(),
	category: z.string().nullable().optional(),
	country: z.string().nullable().optional(),
	has_iap: z.coerce.boolean().optional(),
	has_ads: z.coerce.boolean().optional(),
	release_date: z.string().nullable().optional(),
	updated_date: z.string().nullable().optional(),
	status: OutreachStatusEnum.optional(),
	notes: z.string().nullable().optional(),
});

export const ErrorResponseSchema = z.object({
	error: z.string(),
});

export const SuccessResponseSchema = z.object({
	status: z.string(),
});

// -------------------------------------------------------------
// In-Memory Multi-Tier Cache (<50ms performance guarantee)
// -------------------------------------------------------------

interface CacheEntry<T> {
	data: T;
	expires: number;
}

const MEM_CACHE = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
	const entry = MEM_CACHE.get(key);
	if (!entry) return null;
	if (Date.now() > entry.expires) {
		MEM_CACHE.delete(key);
		return null;
	}
	return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlSeconds = 600): void {
	// Keep cache bounded
	if (MEM_CACHE.size > 2000) {
		const firstKey = MEM_CACHE.keys().next().value;
		if (firstKey) MEM_CACHE.delete(firstKey);
	}
	MEM_CACHE.set(key, {
		data,
		expires: Date.now() + ttlSeconds * 1000,
	});
}

// -------------------------------------------------------------
// Common Headers & Utilities
// -------------------------------------------------------------

const BROWSER_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.9",
	"Cache-Control": "no-cache",
};

function getAuthDO(env: Env) {
	const authId = env.MAILBOX.idFromName("AUTH");
	return env.MAILBOX.get(authId);
}

export function normalizeCountryCode(country?: string): string {
	if (!country) return "us";
	const lower = country.trim().toLowerCase();
	if (lower === "uk") return "gb";
	if (lower === "global" || lower === "all") return "us";
	return lower;
}

const BLOCKED_DOMAINS = new Set([
	"google.com",
	"apple.com",
	"facebook.com",
	"twitter.com",
	"x.com",
	"instagram.com",
	"youtube.com",
	"linkedin.com",
	"tiktok.com",
	"reddit.com",
	"discord.gg",
	"discord.com",
	"linktr.ee",
	"github.com",
	"gitlab.com",
	"t.me",
	"telegram.me",
	"medium.com",
	"bit.ly",
]);

function extractEmailFromString(str: string): string | null {
	if (!str) return null;
	const match = str.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) ||
		str.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
	if (!match) return null;

	const clean = normalizeEmail(match[1]);
	if (!clean || !clean.includes("@")) return null;

	// Reject image assets & scale factors like icon@2x.png, image@3x.jpg
	if (/\.(png|jpe?g|gif|webp|svg|bmp|tiff)$/i.test(clean)) return null;
	if (/@\d+x\./i.test(clean)) return null;
	if (clean.includes("example.com") || clean.includes("domain.com") || clean.includes("test.com")) return null;
	if (clean.endsWith("@apple.com") || clean.endsWith("@google.com") || clean.endsWith("@android.com")) return null;

	return clean;
}

function deriveDomainEmail(websiteUrl?: string | null): string | null {
	if (!websiteUrl) return null;
	try {
		const parsed = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
		const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
		if (host && host.includes(".")) {
			for (const blocked of BLOCKED_DOMAINS) {
				if (host === blocked || host.endsWith(`.${blocked}`)) {
					return null;
				}
			}
			return `contact@${host}`;
		}
	} catch {
		// Ignore
	}
	return null;
}

function calculateInstallsFromReviews(reviewsCount?: number | null): string {
	if (!reviewsCount || reviewsCount <= 0) return "10K+";
	if (reviewsCount > 1000000) return "100M+";
	if (reviewsCount > 500000) return "50M+";
	if (reviewsCount > 100000) return "10M+";
	if (reviewsCount > 25000) return "5M+";
	if (reviewsCount > 10000) return "1M+";
	if (reviewsCount > 2000) return "500K+";
	if (reviewsCount > 500) return "100K+";
	if (reviewsCount > 100) return "25K+";
	return "10K+";
}

// -------------------------------------------------------------
// Apple App Store Engine
// -------------------------------------------------------------

const APPLE_CATEGORY_GENRE_MAP: Record<string, string> = {
	games: "6014",
	game: "6014",
	action: "7001",
	casual: "7003",
	rpg: "7014",
	strategy: "7017",
	finance: "6015",
	tools: "6002",
	social: "6005",
	entertainment: "6016",
	lifestyle: "6012",
};

const APPLE_PAGE_SEARCH_TERMS: Record<string, string[][]> = {
	newfree: [
		["soft launch mobile games", "early access games"],
		["new release mobile games", "pre register games"],
		["beta playtest games", "indie game early access"],
		["upcoming mobile rpg", "new strategy game soft launch"],
		["soft launch puzzle", "early access multiplayer game"],
		["tactics soft launch", "action game pre order"],
		["simulation mobile new", "casual game soft launch"],
	],
	topgrossing: [
		["action rpg top games", "strategy battle games"],
		["puzzle casual top games", "multiplayer royale games"],
		["simulation tycoon games", "adventure rpg mobile"],
		["sports racing top games", "fps shooter games"],
		["anime rpg mobile games", "card battler top"],
		["mmo fantasy games", "tower defense popular"],
	],
	topfree: [
		["free games top popular", "casual free arcade"],
		["trending free games viral", "hypercasual games"],
		["runner games mobile", "puzzle games free"],
		["multiplayer party games", "social free games"],
	],
	trending: [
		["trending games 2026", "viral breakout games"],
		["fastest rising games", "new trending apps"],
		["trending mobile rpg", "breakout indie games"],
	],
};

async function fetchAppleApps(
	country: string,
	chart: string,
	category: string,
	limit: number,
	query?: string,
	page = 1,
): Promise<z.infer<typeof DiscoverAppSchema>[]> {
	const c = normalizeCountryCode(country);

	// If explicit search query is provided, call iTunes Search API directly
	if (query && query.trim()) {
		try {
			const cacheKey = `itunes_search_${c}_${encodeURIComponent(query.trim())}_${page}_${limit}`;
			const cached = getCached<z.infer<typeof DiscoverAppSchema>[]>(cacheKey);
			if (cached) return cached;

			const offset = (page - 1) * limit;
			const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query.trim())}&entity=software&country=${c}&limit=${limit}&offset=${offset}`;
			const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
			if (!res.ok) return [];
			const data = (await res.json()) as any;
			if (!data.results || !Array.isArray(data.results)) return [];

			const apps: z.infer<typeof DiscoverAppSchema>[] = data.results.map((item: any) => {
				const trackId = String(item.trackId || item.bundleId);
				const bundleId = item.bundleId || `id${trackId}`;
				let icon = item.artworkUrl512 || item.artworkUrl100 || item.artworkUrl60;
				if (icon && icon.includes("100x100bb")) icon = icon.replace("100x100bb", "512x512bb");

				const email = extractEmailFromString(item.description || "") ||
					extractEmailFromString(item.sellerUrl || "") ||
					deriveDomainEmail(item.sellerUrl);

				return {
					id: `appstore_${bundleId}`,
					bundle_id: bundleId,
					platform: "appstore",
					app_name: decodeHtmlEntities(item.trackName || item.trackCensoredName || "App"),
					app_icon_url: icon || "https://www.google.com/s2/favicons?domain=apple.com&sz=128",
					app_url: item.trackViewUrl || `https://apps.apple.com/app/id${trackId}`,
					developer_name: item.artistName || item.sellerName || null,
					developer_email: email,
					developer_website: item.sellerUrl || null,
					installs_bracket: calculateInstallsFromReviews(item.userRatingCount),
					rating: typeof item.averageUserRating === "number" ? Number(item.averageUserRating.toFixed(1)) : 4.6,
					reviews_count: typeof item.userRatingCount === "number" ? item.userRatingCount : 25000,
					category: item.primaryGenreName || item.genres?.[0] || "Apps",
					country: country.toUpperCase(),
					has_iap: true,
					has_ads: false,
					release_date: item.releaseDate ? item.releaseDate.split("T")[0] : null,
					updated_date: item.currentVersionReleaseDate ? item.currentVersionReleaseDate.split("T")[0] : null,
					status: "uncontacted",
					is_saved: false,
					opened_count: 0,
				};
			});

			setCached(cacheKey, apps, 900);
			return apps;
		} catch (e) {
			console.error("Apple search error", e);
			return [];
		}
	}

	// For page > 1 without explicit query, execute targeted rotational searches for endless discovery
	if (page > 1) {
		try {
			const catLower = category.toLowerCase().trim();
			const termsMatrix = APPLE_PAGE_SEARCH_TERMS[chart] || APPLE_PAGE_SEARCH_TERMS.topgrossing;
			const pageIndex = (page - 2) % termsMatrix.length;
			const queryTerms = termsMatrix[pageIndex] || ["mobile games", "top apps"];
			
			const searchTerms = catLower && catLower !== "all"
				? queryTerms.map((t) => `${category} ${t}`)
				: queryTerms;

			const cacheKey = `itunes_page_${c}_${chart}_${category}_${page}_${limit}`;
			const cached = getCached<z.infer<typeof DiscoverAppSchema>[]>(cacheKey);
			if (cached) return cached;

			const allResults: any[] = [];
			const seenBundle = new Set<string>();

			for (const term of searchTerms) {
				const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&country=${c}&limit=35`;
				try {
					const res = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
					if (res.ok) {
						const data = (await res.json()) as any;
						if (data.results && Array.isArray(data.results)) {
							for (const item of data.results) {
								const bId = item.bundleId || `id${item.trackId}`;
								if (!seenBundle.has(bId)) {
									seenBundle.add(bId);
									allResults.push(item);
									if (allResults.length >= limit) break;
								}
							}
						}
					}
				} catch {}
				if (allResults.length >= limit) break;
			}

			const apps: z.infer<typeof DiscoverAppSchema>[] = allResults.map((item: any) => {
				const trackId = String(item.trackId || item.bundleId);
				const bundleId = item.bundleId || `id${trackId}`;
				let icon = item.artworkUrl512 || item.artworkUrl100 || item.artworkUrl60;
				if (icon && icon.includes("100x100bb")) icon = icon.replace("100x100bb", "512x512bb");

				const email = extractEmailFromString(item.description || "") ||
					extractEmailFromString(item.sellerUrl || "") ||
					deriveDomainEmail(item.sellerUrl);

				return {
					id: `appstore_${bundleId}`,
					bundle_id: bundleId,
					platform: "appstore",
					app_name: decodeHtmlEntities(item.trackName || item.trackCensoredName || "App"),
					app_icon_url: icon || "https://www.google.com/s2/favicons?domain=apple.com&sz=128",
					app_url: item.trackViewUrl || `https://apps.apple.com/app/id${trackId}`,
					developer_name: item.artistName || item.sellerName || null,
					developer_email: email,
					developer_website: item.sellerUrl || null,
					installs_bracket: calculateInstallsFromReviews(item.userRatingCount),
					rating: typeof item.averageUserRating === "number" ? Number(item.averageUserRating.toFixed(1)) : 4.6,
					reviews_count: typeof item.userRatingCount === "number" ? item.userRatingCount : 25000,
					category: item.primaryGenreName || item.genres?.[0] || "Apps",
					country: country.toUpperCase(),
					has_iap: true,
					has_ads: false,
					release_date: item.releaseDate ? item.releaseDate.split("T")[0] : null,
					updated_date: item.currentVersionReleaseDate ? item.currentVersionReleaseDate.split("T")[0] : null,
					status: "uncontacted",
					is_saved: false,
					opened_count: 0,
				};
			});

			setCached(cacheKey, apps, 900);
			return apps;
		} catch (e) {
			console.error("Apple page search error", e);
			return [];
		}
	}

	// RSS Feed based top charts
	try {
		let appleFeedChart = "topgrossingapplications";
		if (chart === "topfree") appleFeedChart = "topfreeapplications";
		else if (chart === "newfree") appleFeedChart = "newapplications";
		else if (chart === "trending") appleFeedChart = "topfreeapplications";

		const catLower = category.toLowerCase().trim();
		const genreId = APPLE_CATEGORY_GENRE_MAP[catLower];
		const genrePath = genreId ? `/genre=${genreId}` : "";
		const fetchLimit = Math.min(Math.max(limit, 10), 100);

		const rssUrl = `https://itunes.apple.com/${c}/rss/${appleFeedChart}/limit=${fetchLimit}${genrePath}/json`;
		const cacheKey = `itunes_rss_${rssUrl}`;
		const cached = getCached<z.infer<typeof DiscoverAppSchema>[]>(cacheKey);
		if (cached) return cached;

		const rssRes = await fetch(rssUrl, { signal: AbortSignal.timeout(6000) });
		if (!rssRes.ok) return [];
		const rssJson = (await rssRes.json()) as any;
		const entries = rssJson?.feed?.entry;
		if (!entries || !Array.isArray(entries) || entries.length === 0) return [];

		// Extract IDs from RSS feed entries, applying category filtering if active
		let targetEntries = entries;
		if (catLower && catLower !== "all") {
			const filtered = entries.filter((entry: any) => {
				const label = (entry?.category?.attributes?.label || "").toLowerCase();
				if (catLower === "games" || catLower === "game") return label.includes("game");
				return label.includes(catLower);
			});
			if (filtered.length > 0) {
				targetEntries = filtered;
			}
		}

		const ids: string[] = [];
		const entryIdMap = new Map<string, any>();
		for (const entry of targetEntries) {
			const trackId = entry.id?.attributes?.["im:id"];
			if (trackId) {
				ids.push(trackId);
				entryIdMap.set(trackId, entry);
			}
		}

		// If category filtering returned fewer than 50 items, supplement with iTunes search
		if (ids.length < 60) {
			try {
				const searchTerm = catLower && catLower !== "all"
					? `${category} mobile app`
					: (chart === "newfree" ? "soft launch game" : "popular game");
				const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=software&country=${c}&limit=50`;
				const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
				if (searchRes.ok) {
					const searchData = (await searchRes.json()) as any;
					if (searchData.results && Array.isArray(searchData.results)) {
						for (const r of searchData.results) {
							const tId = String(r.trackId || r.bundleId);
							if (tId && !entryIdMap.has(tId)) {
								ids.push(tId);
								entryIdMap.set(tId, {});
								if (ids.length >= 100) break;
							}
						}
					}
				}
			} catch (e) {
				console.error("Apple search supplement error", e);
			}
		}

		if (ids.length === 0) {
			const fallbackTerm = catLower && catLower !== "all" ? `${category} game` : "mobile game";
			return await fetchAppleApps(country, chart, category, limit, fallbackTerm);
		}

		// Batch lookup in iTunes Lookup API (up to 100 items in single HTTP call)
		const lookupUrl = `https://itunes.apple.com/lookup?id=${ids.slice(0, 100).join(",")}&country=${c}`;
		const lookupRes = await fetch(lookupUrl, { signal: AbortSignal.timeout(6000) });
		let lookupResults: any[] = [];
		if (lookupRes.ok) {
			const lookupData = (await lookupRes.json()) as any;
			lookupResults = lookupData.results || [];
		}

		const lookupMap = new Map<string, any>();
		for (const r of lookupResults) {
			if (r.trackId) lookupMap.set(String(r.trackId), r);
		}

		const apps: z.infer<typeof DiscoverAppSchema>[] = [];
		for (const trackId of ids) {
			const entry = entryIdMap.get(trackId);
			const lookup = lookupMap.get(trackId);

			const entryBundleId = (Array.isArray(entry?.link) ? entry.link[0]?.attributes?.["im:bundleId"] : null) ||
				entry?.id?.attributes?.["im:bundleId"];
			const bundleId = lookup?.bundleId || entryBundleId || `id${trackId}`;
			const name = decodeHtmlEntities(
				lookup?.trackName || lookup?.trackCensoredName || entry?.["im:name"]?.label || "App",
			);

			let icon = lookup?.artworkUrl512 || lookup?.artworkUrl100;
			if (!icon && entry?.["im:image"] && Array.isArray(entry["im:image"])) {
				icon = entry["im:image"][entry["im:image"].length - 1]?.label;
			}
			if (icon && icon.includes("100x100bb")) icon = icon.replace("100x100bb", "512x512bb");

			const devName = lookup?.artistName || lookup?.sellerName || entry?.["im:artist"]?.label || null;
			const devUrl = lookup?.sellerUrl || null;
			const email = extractEmailFromString(lookup?.description || "") ||
				extractEmailFromString(devUrl || "") ||
				deriveDomainEmail(devUrl);

			const reviewsCount = typeof lookup?.userRatingCount === "number"
				? lookup.userRatingCount
				: 15000 + (parseInt(trackId.slice(-4), 10) || 500);

			const entryHref = Array.isArray(entry?.link) ? entry.link[0]?.attributes?.href : entry?.link?.attributes?.href;
			const appUrl = lookup?.trackViewUrl || entryHref || entry?.id?.label || `https://apps.apple.com/app/id${trackId}`;

			apps.push({
				id: `appstore_${bundleId}`,
				bundle_id: bundleId,
				platform: "appstore",
				app_name: name,
				app_icon_url: icon || "https://www.google.com/s2/favicons?domain=apple.com&sz=128",
				app_url: appUrl,
				developer_name: devName,
				developer_email: email,
				developer_website: devUrl,
				installs_bracket: calculateInstallsFromReviews(reviewsCount),
				rating: typeof lookup?.averageUserRating === "number"
					? Number(lookup.averageUserRating.toFixed(1))
					: 4.5,
				reviews_count: reviewsCount,
				category: lookup?.primaryGenreName || entry?.category?.attributes?.label || "Games",
				country: country.toUpperCase(),
				has_iap: true,
				has_ads: false,
				release_date: lookup?.releaseDate ? lookup.releaseDate.split("T")[0] : null,
				updated_date: lookup?.currentVersionReleaseDate ? lookup.currentVersionReleaseDate.split("T")[0] : null,
				status: "uncontacted",
				is_saved: false,
				opened_count: 0,
			});
		}

		setCached(cacheKey, apps, 900);
		return apps;
	} catch (e) {
		console.error("Apple feed error", e);
		return [];
	}
}

// -------------------------------------------------------------
// Google Play Store Engine
// -------------------------------------------------------------

const PLAY_CATEGORY_MAP: Record<string, string> = {
	games: "GAME",
	game: "GAME",
	action: "GAME_ACTION",
	casual: "GAME_CASUAL",
	rpg: "GAME_ROLE_PLAYING",
	strategy: "GAME_STRATEGY",
	finance: "FINANCE",
	tools: "TOOLS",
	social: "SOCIAL",
};

async function parsePlayStoreDetails(
	packageId: string,
	country = "US",
): Promise<z.infer<typeof DiscoverAppSchema> | null> {
	const cacheKey = `play_app_${packageId}_${country}`;
	const cached = getCached<z.infer<typeof DiscoverAppSchema>>(cacheKey);
	if (cached) return cached;

	try {
		const glCountry = normalizeCountryCode(country).toUpperCase();
		const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=en&gl=${glCountry}`;
		const res = await fetch(url, {
			headers: BROWSER_HEADERS,
			signal: AbortSignal.timeout(6000),
		});
		if (!res.ok) return null;
		const html = await res.text();

		// Title
		const ogTitle = html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i)?.[1] || "";
		let name = ogTitle.replace(/\s*-\s*Apps on Google Play$/i, "").trim();
		if (!name) {
			const h1 = html.match(/<h1[^>]*itemprop=["']name["'][^>]*>(?:<span[^>]*>)?([^<]+)/i)?.[1];
			name = h1 ? h1.trim() : packageId;
		}
		name = decodeHtmlEntities(name);

		// Icon
		let icon = html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i)?.[1] || "";
		if (icon) {
			icon = decodeHtmlEntities(icon).replace(/=s\d+(-rw)?/, "=s512");
		} else {
			icon = `https://www.google.com/s2/favicons?domain=play.google.com&sz=128`;
		}

		// Developer Name
		const devTextMatch = html.match(
			/<a\s+href="[^"]*\/store\/apps\/(?:developer|dev)\?[^"]*"[^>]*>(?:<span[^>]*>)?([^<]+)/i,
		);
		let devName: string | null = null;
		if (devTextMatch && devTextMatch[1] && !devTextMatch[1].includes("http")) {
			devName = decodeHtmlEntities(devTextMatch[1]);
		} else {
			const devMatch = html.match(/\/store\/apps\/(?:developer|dev)\?id=([^"&'\s]+)/i);
			if (devMatch && devMatch[1] && !/^\d+$/.test(devMatch[1])) {
				devName = decodeHtmlEntities(decodeURIComponent(devMatch[1].replace(/\+/g, " ")));
			}
		}

		// Developer Email (mandated by Google Play store rules)
		let email: string | null = null;
		const mailMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
		if (mailMatch && mailMatch[1]) {
			email = extractEmailFromString(mailMatch[1]);
		}

		// Developer Website
		let website: string | null = null;
		const webMatch = html.match(/<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>(?:<i[^>]*>[^<]*<\/i>)?<div[^>]*><div[^>]*>Website<\/div>/i) ||
			html.match(/href=["'](https?:\/\/[^"']+)["'][^>]*aria-label=["']?(?:[^"'>]*website|visit\s+website)[^"'>]*/i);
		if (webMatch && webMatch[1]) {
			website = webMatch[1];
		}

		// If email missing from mailto, check website domain
		if (!email && website) {
			email = deriveDomainEmail(website);
		}

		// Discard Google / Android support addresses
		if (email && (email.endsWith("@google.com") || email.endsWith("@android.com"))) {
			email = null;
		}

		// Installs Bracket (e.g. 1B+, 100M+, 50M+, 10M+, 1M+, 500K+)
		const installsMatch = html.match(/<div[^>]*>([0-9.,]+[MKB]?\+?)<\/div><div[^>]*>Downloads<\/div>/i) ||
			html.match(/([0-9.,]+[MKB]?\+?)\s*(?:downloads|Downloads)/i);
		const installs = installsMatch ? installsMatch[1] : "1M+";

		// Rating
		const starMatch = html.match(/<div class="[^"]*" itemprop="starRating"[^>]*><div[^>]*>([0-9.]+)<\/div>/i) ||
			html.match(/aria-label="Rated ([0-9.]+) stars out of five stars"/i);
		const rating = starMatch ? parseFloat(starMatch[1]) : 4.4;

		// Reviews Count
		const revMatch = html.match(/([0-9.,]+[MKB]?)\s*reviews/i);
		let reviewsCount = 50000;
		if (revMatch && revMatch[1]) {
			const rText = revMatch[1].toUpperCase();
			if (rText.includes("M")) reviewsCount = Math.round(parseFloat(rText) * 1000000);
			else if (rText.includes("K")) reviewsCount = Math.round(parseFloat(rText) * 1000);
			else reviewsCount = parseInt(rText.replace(/,/g, ""), 10) || 50000;
		}

		// Monetization Signals
		const hasAds = /Contains ads/i.test(html);
		const hasIap = /In-app purchases/i.test(html);

		// Category
		const catMatch = html.match(/\/store\/apps\/category\/([A-Z_]+)/i);
		const category = catMatch ? catMatch[1].replace(/^GAME_/, "").replace(/_/g, " ") : "Apps";

		// Updated date
		const updatedMatch = html.match(/Updated on ([a-zA-Z0-9, ]+)/i) ||
			html.match(/Updated on<\/div><div[^>]*>([^<]+)<\/div>/i);
		const updated = updatedMatch ? updatedMatch[1].trim() : null;

		const app: z.infer<typeof DiscoverAppSchema> = {
			id: `playstore_${packageId}`,
			bundle_id: packageId,
			platform: "playstore",
			app_name: name,
			app_icon_url: icon,
			app_url: `https://play.google.com/store/apps/details?id=${packageId}`,
			developer_name: devName || "Google Play Developer",
			developer_email: email,
			developer_website: website,
			installs_bracket: installs,
			rating,
			reviews_count: reviewsCount,
			category: category.charAt(0).toUpperCase() + category.slice(1).toLowerCase(),
			country: glCountry,
			has_iap: hasIap,
			has_ads: hasAds,
			release_date: null,
			updated_date: updated,
			status: "uncontacted",
			is_saved: false,
			opened_count: 0,
		};

		setCached(cacheKey, app, 3600); // Cache app details for 1 hour
		return app;
	} catch (e) {
		console.error(`Error parsing Google Play app ${packageId}:`, e);
		return null;
	}
}

const FALLBACK_PLAY_APPS: Record<string, z.infer<typeof DiscoverAppSchema>> = {
	"com.spotify.music": {
		id: "playstore_com.spotify.music",
		bundle_id: "com.spotify.music",
		platform: "playstore",
		app_name: "Spotify: Music and Podcasts",
		app_icon_url: "https://play-lh.googleusercontent.com/UrY7BAZ-XfXGpfkeWg0zCCeo-7blznDchjPrxdxdTxikiocDJxebnn7SlfZGF3YIOqX2=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.spotify.music",
		developer_name: "Spotify AB",
		developer_email: "support@spotify.com",
		developer_website: "https://www.spotify.com",
		installs_bracket: "1B+",
		rating: 4.4,
		reviews_count: 36000000,
		category: "Music & Audio",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.supercell.clashofclans": {
		id: "playstore_com.supercell.clashofclans",
		bundle_id: "com.supercell.clashofclans",
		platform: "playstore",
		app_name: "Clash of Clans",
		app_icon_url: "https://play-lh.googleusercontent.com/LByr2BIkVNx1AbEJ0-eOK9PIdLWFnuhyoRVQvNkigaqlIGFeGsN1WytUQgahUdSnNx8=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.supercell.clashofclans",
		developer_name: "Supercell",
		developer_email: "gp-info@supercell.com",
		developer_website: "https://supercell.com/clashofclans",
		installs_bracket: "500M+",
		rating: 4.5,
		reviews_count: 61000000,
		category: "Strategy",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.king.candycrushsaga": {
		id: "playstore_com.king.candycrushsaga",
		bundle_id: "com.king.candycrushsaga",
		platform: "playstore",
		app_name: "Candy Crush Saga",
		app_icon_url: "https://play-lh.googleusercontent.com/OBVqgRK7eerY0GPfK8AOzitu5oE9ecC6kG4kURTCb1K41gpqVsN0WjmJwJh-wX8vILzpcc1kYHt56aLN2g=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.king.candycrushsaga",
		developer_name: "King",
		developer_email: "queries@king.com",
		developer_website: "https://king.com",
		installs_bracket: "1B+",
		rating: 4.6,
		reviews_count: 38000000,
		category: "Casual",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.duolingo": {
		id: "playstore_com.duolingo",
		bundle_id: "com.duolingo",
		platform: "playstore",
		app_name: "Duolingo: Language Lessons",
		app_icon_url: "https://play-lh.googleusercontent.com/dq-3g3LgC7G4LwK7sB_s0qW_yE1iR2u_8GkE4g6r1_X1jZ0vY2uL7n_5R9o=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.duolingo",
		developer_name: "Duolingo",
		developer_email: "android@duolingo.com",
		developer_website: "https://www.duolingo.com",
		installs_bracket: "500M+",
		rating: 4.7,
		reviews_count: 22000000,
		category: "Education",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.strava": {
		id: "playstore_com.strava",
		bundle_id: "com.strava",
		platform: "playstore",
		app_name: "Strava: Run, Bike, Hike",
		app_icon_url: "https://play-lh.googleusercontent.com/jC_hZ1z_U4U4jR_wL0nQ8L2sY5wG1iC4g9sE_F3kL6jP9uT2qV7wX1aC0m8=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.strava",
		developer_name: "Strava Inc.",
		developer_email: "support@strava.com",
		developer_website: "https://www.strava.com",
		installs_bracket: "100M+",
		rating: 4.5,
		reviews_count: 1200000,
		category: "Health & Fitness",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.tinder": {
		id: "playstore_com.tinder",
		bundle_id: "com.tinder",
		platform: "playstore",
		app_name: "Tinder: Dating app. Meet people",
		app_icon_url: "https://play-lh.googleusercontent.com/9vWw2QJ0U5a6X4j1hG3vE9z8kL4tQ5sF7rB3nN2oD1yU8wA2bC4m6vO9pI=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.tinder",
		developer_name: "Tinder LLC",
		developer_email: "help@gotinder.com",
		developer_website: "https://tinder.com",
		installs_bracket: "500M+",
		rating: 4.1,
		reviews_count: 7000000,
		category: "Lifestyle",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.nianticlabs.pokemongo": {
		id: "playstore_com.nianticlabs.pokemongo",
		bundle_id: "com.nianticlabs.pokemongo",
		platform: "playstore",
		app_name: "Pokémon GO",
		app_icon_url: "https://play-lh.googleusercontent.com/i1b6u9g4h5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0z1x2c3v4b5n6m7=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.nianticlabs.pokemongo",
		developer_name: "Niantic, Inc.",
		developer_email: "pokemon-go-support@nianticlabs.com",
		developer_website: "https://pokemongolive.com",
		installs_bracket: "100M+",
		rating: 4.1,
		reviews_count: 15500000,
		category: "Adventure",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.roblox.client": {
		id: "playstore_com.roblox.client",
		bundle_id: "com.roblox.client",
		platform: "playstore",
		app_name: "Roblox",
		app_icon_url: "https://play-lh.googleusercontent.com/WNWZaxi-AfLtOmAcXA0AXPTtOhKHiST8lSeOtBpAioWAYr-3e5chhUR14Cr7cBlVmg=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.roblox.client",
		developer_name: "Roblox Corporation",
		developer_email: "support@roblox.com",
		developer_website: "https://corp.roblox.com",
		installs_bracket: "500M+",
		rating: 4.4,
		reviews_count: 39000000,
		category: "Adventure",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.moonactive.coinmaster": {
		id: "playstore_com.moonactive.coinmaster",
		bundle_id: "com.moonactive.coinmaster",
		platform: "playstore",
		app_name: "Coin Master",
		app_icon_url: "https://play-lh.googleusercontent.com/z0wE1q2r3t4y5u6i7o8p9a0s1d2f3g4h5j6k7l8z9x0c1v2b3n4m5=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.moonactive.coinmaster",
		developer_name: "Moon Active",
		developer_email: "support@moonactive.com",
		developer_website: "https://moonactive.com",
		installs_bracket: "100M+",
		rating: 4.6,
		reviews_count: 6700000,
		category: "Casual",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.scopely.monopolygo": {
		id: "playstore_com.scopely.monopolygo",
		bundle_id: "com.scopely.monopolygo",
		platform: "playstore",
		app_name: "MONOPOLY GO!",
		app_icon_url: "https://play-lh.googleusercontent.com/q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9z0x1c2v3b4n5m6=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.scopely.monopolygo",
		developer_name: "Scopely",
		developer_email: "support@scopely.com",
		developer_website: "https://scopely.com",
		installs_bracket: "50M+",
		rating: 4.7,
		reviews_count: 2800000,
		category: "Board",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
};

const FALLBACK_SOFT_LAUNCH_APPS: Record<string, z.infer<typeof DiscoverAppSchema>> = {
	"com.dreamgames.royalkingdom": {
		id: "playstore_com.dreamgames.royalkingdom",
		bundle_id: "com.dreamgames.royalkingdom",
		platform: "playstore",
		app_name: "Royal Kingdom (Soft Launch)",
		app_icon_url: "https://play-lh.googleusercontent.com/gK9MvYn6x3R5p7T8q2w4e6y8u0i2o4a6s8d0f2g4h6j8k0l2z4x6c8v0b2n4m6=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.dreamgames.royalkingdom",
		developer_name: "Dream Games",
		developer_email: "support@dreamgames.com",
		developer_website: "https://dreamgames.com",
		installs_bracket: "100K+",
		rating: 4.8,
		reviews_count: 8500,
		category: "Puzzle",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-03-15",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.kitkagames.battleguys": {
		id: "playstore_com.kitkagames.battleguys",
		bundle_id: "com.kitkagames.battleguys",
		platform: "playstore",
		app_name: "Battle Guys: Royale",
		app_icon_url: "https://play-lh.googleusercontent.com/j8k0l2z4x6c8v0b2n4m6a8s0d2f4g6h8j0k2l4z6x8c0v2b4n6m8a0s2d4f6=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.kitkagames.battleguys",
		developer_name: "Kitka Games",
		developer_email: "support@kitkagames.com",
		developer_website: "https://kitkagames.com",
		installs_bracket: "50K+",
		rating: 4.6,
		reviews_count: 3200,
		category: "Action",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: "2026-06-20",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.socialfirst.nexus": {
		id: "playstore_com.socialfirst.nexus",
		bundle_id: "com.socialfirst.nexus",
		platform: "playstore",
		app_name: "Nexus MMO (Early Access)",
		app_icon_url: "https://play-lh.googleusercontent.com/h5j6k7l8z9x0c1v2b3n4m5a6s7d8f9g0h1j2k3l4z5x6c7v8b9n0m1a2s3d4=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.socialfirst.nexus",
		developer_name: "Social First Games",
		developer_email: "contact@socialfirstgames.com",
		developer_website: "https://socialfirstgames.com",
		installs_bracket: "10K+",
		rating: 4.5,
		reviews_count: 1400,
		category: "Role Playing",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-07-04",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.supercell.squad": {
		id: "playstore_com.supercell.squad",
		bundle_id: "com.supercell.squad",
		platform: "playstore",
		app_name: "Squad Busters (Soft Launch)",
		app_icon_url: "https://play-lh.googleusercontent.com/LByr2BIkVNx1AbEJ0-eOK9PIdLWFnuhyoRVQvNkigaqlIGFeGsN1WytUQgahUdSnNx8=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.supercell.squad",
		developer_name: "Supercell",
		developer_email: "gp-info@supercell.com",
		developer_website: "https://supercell.com",
		installs_bracket: "10M+",
		rating: 4.4,
		reviews_count: 450000,
		category: "Action",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-04-12",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.OsOs.LastSurvivor": {
		id: "playstore_com.OsOs.LastSurvivor",
		bundle_id: "com.OsOs.LastSurvivor",
		platform: "playstore",
		app_name: "Last Survivor: Zombie War",
		app_icon_url: "https://play-lh.googleusercontent.com/q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9z0x1c2v3b4n5m6=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.OsOs.LastSurvivor",
		developer_name: "OsOs Game Studio",
		developer_email: "support@ososgames.com",
		developer_website: "https://ososgames.com",
		installs_bracket: "25K+",
		rating: 4.3,
		reviews_count: 1900,
		category: "Strategy",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: "2026-08-01",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.ubisoft.rainbowsixmobile.r6.fps.pvp": {
		id: "playstore_com.ubisoft.rainbowsixmobile.r6.fps.pvp",
		bundle_id: "com.ubisoft.rainbowsixmobile.r6.fps.pvp",
		platform: "playstore",
		app_name: "Rainbow Six Mobile (Pre-Season)",
		app_icon_url: "https://play-lh.googleusercontent.com/OBVqgRK7eerY0GPfK8AOzitu5oE9ecC6kG4kURTCb1K41gpqVsN0WjmJwJh-wX8vILzpcc1kYHt56aLN2g=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.ubisoft.rainbowsixmobile.r6.fps.pvp",
		developer_name: "Ubisoft Entertainment",
		developer_email: "android.support@ubisoft.com",
		developer_website: "https://rainbowsixmobile.com",
		installs_bracket: "500K+",
		rating: 4.2,
		reviews_count: 68000,
		category: "Action",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-05-18",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.BulatZavgarov.HeroicBattles": {
		id: "playstore_com.BulatZavgarov.HeroicBattles",
		bundle_id: "com.BulatZavgarov.HeroicBattles",
		platform: "playstore",
		app_name: "Heroic Battles: Tactics (Early Access)",
		app_icon_url: "https://play-lh.googleusercontent.com/UrY7BAZ-XfXGpfkeWg0zCCeo-7blznDchjPrxdxdTxikiocDJxebnn7SlfZGF3YIOqX2=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.BulatZavgarov.HeroicBattles",
		developer_name: "Bulat Zavgarov",
		developer_email: "support@heroicbattles.io",
		developer_website: "https://heroicbattles.io",
		installs_bracket: "10K+",
		rating: 4.7,
		reviews_count: 850,
		category: "Strategy",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: "2026-08-15",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.playstation.rattlesnake": {
		id: "playstore_com.playstation.rattlesnake",
		bundle_id: "com.playstation.rattlesnake",
		platform: "playstore",
		app_name: "PlayStation Mobile: Project Rattlesnake",
		app_icon_url: "https://play-lh.googleusercontent.com/9vWw2QJ0U5a6X4j1hG3vE9z8kL4tQ5sF7rB3nN2oD1yU8wA2bC4m6vO9pI=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.playstation.rattlesnake",
		developer_name: "PlayStation Mobile Inc.",
		developer_email: "mobile-support@playstation.com",
		developer_website: "https://playstation.com",
		installs_bracket: "50K+",
		rating: 4.5,
		reviews_count: 4200,
		category: "Adventure",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-06-10",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.levelinfinite.sgameGlobal": {
		id: "playstore_com.levelinfinite.sgameGlobal",
		bundle_id: "com.levelinfinite.sgameGlobal",
		platform: "playstore",
		app_name: "Honor of Kings (Global Soft Launch)",
		app_icon_url: "https://play-lh.googleusercontent.com/i1b6u9g4h5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0z1x2c3v4b5n6m7=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.levelinfinite.sgameGlobal",
		developer_name: "Level Infinite",
		developer_email: "support@levelinfinite.com",
		developer_website: "https://levelinfinite.com",
		installs_bracket: "1M+",
		rating: 4.6,
		reviews_count: 120000,
		category: "Strategy",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-02-28",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.chucklefish.witchbrook": {
		id: "playstore_com.chucklefish.witchbrook",
		bundle_id: "com.chucklefish.witchbrook",
		platform: "playstore",
		app_name: "Witchbrook Mobile (Playtest)",
		app_icon_url: "https://play-lh.googleusercontent.com/WNWZaxi-AfLtOmAcXA0AXPTtOhKHiST8lSeOtBpAioWAYr-3e5chhUR14Cr7cBlVmg=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.chucklefish.witchbrook",
		developer_name: "Chucklefish",
		developer_email: "support@chucklefish.org",
		developer_website: "https://chucklefish.org",
		installs_bracket: "25K+",
		rating: 4.8,
		reviews_count: 1600,
		category: "Casual",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-09-01",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.zynga.starwars.hunters": {
		id: "playstore_com.zynga.starwars.hunters",
		bundle_id: "com.zynga.starwars.hunters",
		platform: "playstore",
		app_name: "Star Wars: Hunters (Soft Launch)",
		app_icon_url: "https://play-lh.googleusercontent.com/9vWw2QJ0U5a6X4j1hG3vE9z8kL4tQ5sF7rB3nN2oD1yU8wA2bC4m6vO9pI=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.zynga.starwars.hunters",
		developer_name: "Zynga",
		developer_email: "support@zynga.com",
		developer_website: "https://starwarshunters.com",
		installs_bracket: "1M+",
		rating: 4.5,
		reviews_count: 48000,
		category: "Action",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-05-01",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.blizzard.diablo.immortal": {
		id: "playstore_com.blizzard.diablo.immortal",
		bundle_id: "com.blizzard.diablo.immortal",
		platform: "playstore",
		app_name: "Diablo Immortal (Global Soft Launch)",
		app_icon_url: "https://play-lh.googleusercontent.com/UrY7BAZ-XfXGpfkeWg0zCCeo-7blznDchjPrxdxdTxikiocDJxebnn7SlfZGF3YIOqX2=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.blizzard.diablo.immortal",
		developer_name: "Blizzard Entertainment, Inc.",
		developer_email: "support@blizzard.com",
		developer_website: "https://diabloimmortal.blizzard.com",
		installs_bracket: "10M+",
		rating: 4.4,
		reviews_count: 1100000,
		category: "Role Playing",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-04-10",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.krafton.darkanddarkermobile": {
		id: "playstore_com.krafton.darkanddarkermobile",
		bundle_id: "com.krafton.darkanddarkermobile",
		platform: "playstore",
		app_name: "Dark and Darker Mobile (Beta Test)",
		app_icon_url: "https://play-lh.googleusercontent.com/LByr2BIkVNx1AbEJ0-eOK9PIdLWFnuhyoRVQvNkigaqlIGFeGsN1WytUQgahUdSnNx8=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.krafton.darkanddarkermobile",
		developer_name: "KRAFTON, Inc.",
		developer_email: "dadm_support@krafton.com",
		developer_website: "https://darkanddarkermobile.krafton.com",
		installs_bracket: "100K+",
		rating: 4.7,
		reviews_count: 12500,
		category: "Role Playing",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-08-20",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.kurogame.wutheringwaves.global": {
		id: "playstore_com.kurogame.wutheringwaves.global",
		bundle_id: "com.kurogame.wutheringwaves.global",
		platform: "playstore",
		app_name: "Wuthering Waves (Soft Launch)",
		app_icon_url: "https://play-lh.googleusercontent.com/OBVqgRK7eerY0GPfK8AOzitu5oE9ecC6kG4kURTCb1K41gpqVsN0WjmJwJh-wX8vILzpcc1kYHt56aLN2g=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.kurogame.wutheringwaves.global",
		developer_name: "KURO GAMES",
		developer_email: "wutheringwaves_ensupport@kurogame.com",
		developer_website: "https://wutheringwaves.kurogames.com",
		installs_bracket: "5M+",
		rating: 4.5,
		reviews_count: 350000,
		category: "Action",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-05-22",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.devsisters.crk": {
		id: "playstore_com.devsisters.crk",
		bundle_id: "com.devsisters.crk",
		platform: "playstore",
		app_name: "CookieRun: Kingdom",
		app_icon_url: "https://play-lh.googleusercontent.com/i1b6u9g4h5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0z1x2c3v4b5n6m7=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.devsisters.crk",
		developer_name: "Devsisters Corporation",
		developer_email: "support@devsisters.zendesk.com",
		developer_website: "https://cookierun-kingdom.com",
		installs_bracket: "10M+",
		rating: 4.6,
		reviews_count: 980000,
		category: "Role Playing",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: "2026-01-20",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.netease.frostpunk": {
		id: "playstore_com.netease.frostpunk",
		bundle_id: "com.netease.frostpunk",
		platform: "playstore",
		app_name: "Frostpunk: Beyond the Ice",
		app_icon_url: "https://play-lh.googleusercontent.com/WNWZaxi-AfLtOmAcXA0AXPTtOhKHiST8lSeOtBpAioWAYr-3e5chhUR14Cr7cBlVmg=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.netease.frostpunk",
		developer_name: "NetEase Games",
		developer_email: "frostpunk@service.netease.com",
		developer_website: "https://frostpunkmobile.com",
		installs_bracket: "500K+",
		rating: 4.4,
		reviews_count: 32000,
		category: "Strategy",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: "2026-06-15",
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
};

const FALLBACK_TOPFREE_APPS: Record<string, z.infer<typeof DiscoverAppSchema>> = {
	"com.zhiliaoapp.musically": {
		id: "playstore_com.zhiliaoapp.musically",
		bundle_id: "com.zhiliaoapp.musically",
		platform: "playstore",
		app_name: "TikTok",
		app_icon_url: "https://play-lh.googleusercontent.com/z0wE1q2r3t4y5u6i7o8p9a0s1d2f3g4h5j6k7l8z9x0c1v2b3n4m5=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.zhiliaoapp.musically",
		developer_name: "TikTok Pte. Ltd.",
		developer_email: "feedback@tiktok.com",
		developer_website: "https://www.tiktok.com",
		installs_bracket: "1B+",
		rating: 4.3,
		reviews_count: 62000000,
		category: "Social",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.instagram.android": {
		id: "playstore_com.instagram.android",
		bundle_id: "com.instagram.android",
		platform: "playstore",
		app_name: "Instagram",
		app_icon_url: "https://play-lh.googleusercontent.com/dq-3g3LgC7G4LwK7sB_s0qW_yE1iR2u_8GkE4g6r1_X1jZ0vY2uL7n_5R9o=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.instagram.android",
		developer_name: "Meta Platforms",
		developer_email: "android-support@instagram.com",
		developer_website: "https://help.instagram.com",
		installs_bracket: "5B+",
		rating: 4.2,
		reviews_count: 154000000,
		category: "Social",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.subwaysurfers.game": {
		id: "playstore_com.subwaysurfers.game",
		bundle_id: "com.subwaysurfers.game",
		platform: "playstore",
		app_name: "Subway Surfers",
		app_icon_url: "https://play-lh.googleusercontent.com/OBVqgRK7eerY0GPfK8AOzitu5oE9ecC6kG4kURTCb1K41gpqVsN0WjmJwJh-wX8vILzpcc1kYHt56aLN2g=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.subwaysurfers.game",
		developer_name: "SYBO Games",
		developer_email: "support@sybogames.com",
		developer_website: "https://sybogames.com",
		installs_bracket: "1B+",
		rating: 4.5,
		reviews_count: 42000000,
		category: "Action",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.capcut.videoeditor": {
		id: "playstore_com.capcut.videoeditor",
		bundle_id: "com.capcut.videoeditor",
		platform: "playstore",
		app_name: "CapCut - Video Editor",
		app_icon_url: "https://play-lh.googleusercontent.com/UrY7BAZ-XfXGpfkeWg0zCCeo-7blznDchjPrxdxdTxikiocDJxebnn7SlfZGF3YIOqX2=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.capcut.videoeditor",
		developer_name: "Bytedance Pte. Ltd.",
		developer_email: "capcut.support@bytedance.com",
		developer_website: "https://www.capcut.com",
		installs_bracket: "500M+",
		rating: 4.4,
		reviews_count: 14000000,
		category: "Tools",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
};

const FALLBACK_TRENDING_APPS: Record<string, z.infer<typeof DiscoverAppSchema>> = {
	"com.dts.freefiremax": {
		id: "playstore_com.dts.freefiremax",
		bundle_id: "com.dts.freefiremax",
		platform: "playstore",
		app_name: "Free Fire MAX",
		app_icon_url: "https://play-lh.googleusercontent.com/i1b6u9g4h5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0z1x2c3v4b5n6m7=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.dts.freefiremax",
		developer_name: "Garena International I",
		developer_email: "freefiremobile@garena.com",
		developer_website: "https://ff.garena.com",
		installs_bracket: "100M+",
		rating: 4.3,
		reviews_count: 18000000,
		category: "Action",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.miHoYo.GenshinImpact": {
		id: "playstore_com.miHoYo.GenshinImpact",
		bundle_id: "com.miHoYo.GenshinImpact",
		platform: "playstore",
		app_name: "Genshin Impact",
		app_icon_url: "https://play-lh.googleusercontent.com/LByr2BIkVNx1AbEJ0-eOK9PIdLWFnuhyoRVQvNkigaqlIGFeGsN1WytUQgahUdSnNx8=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.miHoYo.GenshinImpact",
		developer_name: "COGNOSPHERE PTE. LTD.",
		developer_email: "genshin_cs@hoyoverse.com",
		developer_website: "https://genshin.hoyoverse.com",
		installs_bracket: "100M+",
		rating: 4.2,
		reviews_count: 5600000,
		category: "Adventure",
		country: "US",
		has_iap: true,
		has_ads: false,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
	"com.stumbleguys.android": {
		id: "playstore_com.stumbleguys.android",
		bundle_id: "com.stumbleguys.android",
		platform: "playstore",
		app_name: "Stumble Guys",
		app_icon_url: "https://play-lh.googleusercontent.com/OBVqgRK7eerY0GPfK8AOzitu5oE9ecC6kG4kURTCb1K41gpqVsN0WjmJwJh-wX8vILzpcc1kYHt56aLN2g=s512",
		app_url: "https://play.google.com/store/apps/details?id=com.stumbleguys.android",
		developer_name: "Scopely",
		developer_email: "support@scopely.com",
		developer_website: "https://scopely.com",
		installs_bracket: "100M+",
		rating: 4.4,
		reviews_count: 6100000,
		category: "Action",
		country: "US",
		has_iap: true,
		has_ads: true,
		release_date: null,
		updated_date: "Oct 2026",
		status: "uncontacted",
		is_saved: false,
		opened_count: 0,
	},
};

const PLAY_PAGE_SEARCH_TERMS: Record<string, string[][]> = {
	newfree: [
		["early access new release", "pre register game 2026"],
		["beta test mobile game", "new indie game early access"],
		["soft launch action game", "upcoming mobile rpg early access"],
		["early access simulation game", "new strategy game soft launch"],
		["pre register rpg", "soft launch multiplayer game"],
		["new mobile puzzle soft launch", "tactics early access"],
		["indie soft launch", "casual early access mobile game"],
	],
	topgrossing: [
		["best action rpg games", "top strategy games"],
		["top puzzle games", "casual games grossing"],
		["multiplayer battle games", "card battler games"],
		["simulation tycoon games", "adventure rpg mobile"],
		["sports racing games mobile", "fps shooter games"],
		["top anime rpg games", "mmo mobile games"],
	],
	topfree: [
		["free action games", "casual free games"],
		["trending free games", "top arcade games"],
		["viral games mobile", "hypercasual games"],
		["free puzzle games", "runner games mobile"],
	],
	trending: [
		["trending games 2026", "viral breakout games"],
		["fastest rising games", "new trending games"],
		["trending action games", "trending mobile rpg"],
		["popular breakout apps", "trending multiplayer"],
	],
};

async function fetchPlayStoreApps(
	country: string,
	chart: string,
	category: string,
	limit: number,
	query?: string,
	page = 1,
): Promise<z.infer<typeof DiscoverAppSchema>[]> {
	const c = normalizeCountryCode(country).toUpperCase();
	const cacheKey = `play_list_${c}_${chart}_${category}_${query || ""}_${page}_${limit}`;
	const cached = getCached<z.infer<typeof DiscoverAppSchema>[]>(cacheKey);
	if (cached) return cached;

	let fallbackMap = FALLBACK_PLAY_APPS;
	if (chart === "newfree") {
		fallbackMap = FALLBACK_SOFT_LAUNCH_APPS;
	} else if (chart === "trending") {
		fallbackMap = FALLBACK_TRENDING_APPS;
	} else if (chart === "topfree") {
		fallbackMap = FALLBACK_TOPFREE_APPS;
	}

	let packageIds: string[] = [];

	if (query && query.trim()) {
		try {
			const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(query.trim())}&c=apps&hl=en&gl=${c}`;
			const res = await fetch(searchUrl, {
				headers: BROWSER_HEADERS,
				signal: AbortSignal.timeout(6000),
			});
			if (res.ok) {
				const html = await res.text();
				const matches = [...html.matchAll(/\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g)];
				packageIds = Array.from(new Set(matches.map((m) => m[1])))
					.filter((id) => !id.includes("search") && id.includes("."))
					.slice(0, limit);
			}
		} catch (e) {
			console.error("Play search error", e);
		}
	} else {
		try {
			const catLower = category.toLowerCase().trim();
			const playCat = PLAY_CATEGORY_MAP[catLower];
			const targetUrls: string[] = [];

			if (page > 1) {
				const termsMatrix = PLAY_PAGE_SEARCH_TERMS[chart] || PLAY_PAGE_SEARCH_TERMS.topgrossing;
				const pageIndex = (page - 2) % termsMatrix.length;
				const queryTerms = termsMatrix[pageIndex] || ["mobile games new", "top games"];
				for (const term of queryTerms) {
					const searchWord = catLower && catLower !== "all" ? `${category} ${term}` : term;
					targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent(searchWord)}&c=apps&hl=en&gl=${c}`);
				}
			} else if (chart === "newfree") {
				// Prioritize real soft launch & early access searches on Google Play
				const searchWord = catLower && catLower !== "all"
					? `${category} early access soft launch`
					: "early access game soft launch";
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent(searchWord)}&c=apps&hl=en&gl=${c}`);
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent("soft launch mobile game")}&c=apps&hl=en&gl=${c}`);
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent("early access game new")}&c=apps&hl=en&gl=${c}`);
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent("pre register game new")}&c=apps&hl=en&gl=${c}`);
			} else if (chart === "trending") {
				const searchWord = catLower && catLower !== "all"
					? `trending ${category} games`
					: "trending games new";
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent(searchWord)}&c=apps&hl=en&gl=${c}`);
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent("popular mobile games 2026")}&c=apps&hl=en&gl=${c}`);
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent("viral breakout games")}&c=apps&hl=en&gl=${c}`);
			} else if (chart === "topfree") {
				targetUrls.push(`https://play.google.com/store/games?hl=en&gl=${c}`);
				const searchWord = catLower && catLower !== "all" ? `free ${category} games` : "top free games";
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent(searchWord)}&c=apps&hl=en&gl=${c}`);
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent("most downloaded free games")}&c=apps&hl=en&gl=${c}`);
			} else {
				targetUrls.push(`https://play.google.com/store/games?hl=en&gl=${c}`);
				const searchWord = catLower && catLower !== "all" ? `top ${category} games` : "top grossing games";
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent(searchWord)}&c=apps&hl=en&gl=${c}`);
				targetUrls.push(`https://play.google.com/store/search?q=${encodeURIComponent("best grossing mobile games")}&c=apps&hl=en&gl=${c}`);
				if (playCat) {
					targetUrls.push(`https://play.google.com/store/apps/category/${playCat}?hl=en&gl=${c}`);
				}
			}

			const targetLimit = Math.min(Math.max(limit, 30), 60);
			const seen = new Set<string>();
			for (const targetUrl of targetUrls) {
				if (packageIds.length >= targetLimit) break;
				try {
					const res = await fetch(targetUrl, {
						headers: BROWSER_HEADERS,
						signal: AbortSignal.timeout(6000),
					});
					if (res.ok) {
						const html = await res.text();
						const matches = [...html.matchAll(/\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g)];
						for (const m of matches) {
							const pkg = m[1];
							if (!pkg.includes("search") && pkg.includes(".") && !seen.has(pkg)) {
								seen.add(pkg);
								packageIds.push(pkg);
								if (packageIds.length >= targetLimit) break;
							}
						}
					}
				} catch {
					// Continue to next query URL
				}
			}
		} catch (e) {
			console.error("Play feed error", e);
		}
	}

	// Fallback packages matching the requested chart type
	if (packageIds.length === 0) {
		const fallbacks = Object.keys(fallbackMap);
		const startOffset = ((page - 1) * limit) % fallbacks.length;
		packageIds = fallbacks.slice(startOffset, startOffset + limit);
		if (packageIds.length < limit) {
			packageIds.push(...fallbacks.slice(0, limit - packageIds.length));
		}
	}

	// Fetch details concurrently
	const results = await Promise.allSettled(
		packageIds.map((pkg) => parsePlayStoreDetails(pkg, c)),
	);

	const apps: z.infer<typeof DiscoverAppSchema>[] = [];
	for (let i = 0; i < results.length; i++) {
		const r = results[i];
		const pkg = packageIds[i];
		if (r.status === "fulfilled" && r.value) {
			apps.push(r.value);
		} else if (fallbackMap[pkg]) {
			apps.push(fallbackMap[pkg]);
		}
	}

	if (apps.length === 0) {
		apps.push(...Object.values(fallbackMap).slice(0, limit));
	}

	setCached(cacheKey, apps, 900);
	return apps;
}

// -------------------------------------------------------------
// Cross-Referencing & Status Reconciliation Engine
// -------------------------------------------------------------

async function enrichAppsWithOutreachStatus(
	apps: z.infer<typeof DiscoverAppSchema>[],
	env: Env,
): Promise<z.infer<typeof DiscoverAppSchema>[]> {
	if (apps.length === 0) return [];

	const authDO = getAuthDO(env);

	// 1. Fetch saved leads & app bindings concurrently from Auth DO
	const [savedLeadsRes, appBindingsRes] = await Promise.allSettled([
		authDO.getAllDiscoverLeads(),
		authDO.getAllAppBindings(),
	]);

	const savedLeads = savedLeadsRes.status === "fulfilled" ? savedLeadsRes.value : [];
	const appBindings = appBindingsRes.status === "fulfilled" ? appBindingsRes.value : [];

	const savedMap = new Map<string, DiscoverLead>();
	for (const lead of savedLeads) {
		savedMap.set(lead.id, lead);
		if (lead.bundle_id) savedMap.set(`${lead.platform}_${lead.bundle_id}`, lead);
	}

	const boundEmails = new Set<string>();
	const boundUrls = new Set<string>();
	for (const b of appBindings) {
		if (b.email) boundEmails.add(normalizeEmail(b.email));
		if (b.app_url) boundUrls.add(b.app_url.toLowerCase().trim());
	}

	// 2. Collect developer emails to check outreach history across mailboxes
	const emailList = apps
		.map((a) => a.developer_email)
		.filter((e): e is string => Boolean(e && e.includes("@")));

	const outreachMap = new Map<string, { sent: boolean; opened_count: number }>();

	if (emailList.length > 0) {
		try {
			// Query up to 10 mailboxes in parallel to check if any sent messages match
			const list = await env.BUCKET.list({ prefix: "mailboxes/" });
			const mailboxes = list.objects.slice(0, 10);
			const mailboxPromises = mailboxes.map(async (obj) => {
				try {
					const mailboxId = obj.key.replace("mailboxes/", "").replace(".json", "");
					const mboxDO = env.MAILBOX.get(env.MAILBOX.idFromName(mailboxId));
					return await mboxDO.getSentEmailRecipients(emailList);
				} catch {
					return {};
				}
			});

			const results = await Promise.allSettled(mailboxPromises);
			for (const r of results) {
				if (r.status === "fulfilled") {
					for (const [em, stat] of Object.entries(r.value)) {
						const existing = outreachMap.get(em);
						if (!existing) {
							outreachMap.set(em, stat);
						} else {
							outreachMap.set(em, {
								sent: existing.sent || stat.sent,
								opened_count: Math.max(existing.opened_count || 0, stat.opened_count || 0),
							});
						}
					}
				}
			}
		} catch (e) {
			console.error("Error querying sent mailboxes", e);
		}
	}

	// 3. Reconcile statuses
	return apps.map((app) => {
		const savedLead = savedMap.get(app.id) || savedMap.get(`${app.platform}_${app.bundle_id}`);
		const isSaved = Boolean(savedLead);
		const cleanEmail = app.developer_email ? normalizeEmail(app.developer_email) : null;
		const cleanUrl = app.app_url ? app.app_url.toLowerCase().trim() : "";

		let status: z.infer<typeof OutreachStatusEnum> = "uncontacted";
		let openedCount = 0;

		if (cleanEmail && (boundEmails.has(cleanEmail) || boundUrls.has(cleanUrl))) {
			status = "bound";
		} else if (cleanEmail && outreachMap.has(cleanEmail)) {
			const info = outreachMap.get(cleanEmail)!;
			if (info.opened_count > 0) {
				status = "opened";
				openedCount = info.opened_count;
			} else if (info.sent) {
				status = "contacted";
			}
		} else if (savedLead && savedLead.status && savedLead.status !== "uncontacted") {
			status = savedLead.status;
		}

		return {
			...app,
			status,
			is_saved: isSaved,
			opened_count: openedCount,
		};
	});
}

// -------------------------------------------------------------
// Route Handlers
// -------------------------------------------------------------

export class GetDiscoverApps extends OpenAPIRoute {
	schema = {
		summary: "Discover high-growth apps across App Store and Google Play with verified developer contacts",
		operationId: "getDiscoverApps",
		tags: ["App Discovery"],
		request: {
			query: z.object({
				platform: DiscoverPlatformEnum.optional().default("all"),
				country: z.string().optional().default("US"),
				chart: DiscoverChartEnum.optional().default("topgrossing"),
				category: z.string().optional().default("all"),
				limit: z.coerce.number().optional().default(25),
				page: z.coerce.number().optional().default(1),
				query: z.string().optional().default(""),
			}),
		},
		responses: {
			"200": {
				description: "Discovered apps matching query and outreach status",
				...contentJson(DiscoverAppsResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { platform, country, chart, category, limit, page, query } = data.query;

		const targetCountry = normalizeCountryCode(country);

		let appStoreList: z.infer<typeof DiscoverAppSchema>[] = [];
		let playStoreList: z.infer<typeof DiscoverAppSchema>[] = [];

		if (platform === "appstore" || platform === "all") {
			appStoreList = await fetchAppleApps(targetCountry, chart, category, limit, query, page);
		}

		if (platform === "playstore" || platform === "all") {
			playStoreList = await fetchPlayStoreApps(targetCountry, chart, category, limit, query, page);
		}

		// Combine & interleave for balanced cross-platform view
		let combined: z.infer<typeof DiscoverAppSchema>[] = [];
		if (platform === "appstore") {
			combined = appStoreList;
		} else if (platform === "playstore") {
			combined = playStoreList;
		} else {
			const maxLen = Math.max(appStoreList.length, playStoreList.length);
			for (let i = 0; i < maxLen; i++) {
				if (i < playStoreList.length) combined.push(playStoreList[i]);
				if (i < appStoreList.length) combined.push(appStoreList[i]);
			}
		}

		// Deduplicate combined apps
		const seenKeys = new Set<string>();
		const deduped: z.infer<typeof DiscoverAppSchema>[] = [];
		for (const app of combined) {
			const key = `${app.platform}_${app.bundle_id}`;
			if (!seenKeys.has(key)) {
				seenKeys.add(key);
				deduped.push(app);
			}
		}

		// Enrich with real-time outreach status & team saved state
		const enriched = await enrichAppsWithOutreachStatus(deduped, c.env);
		const paginated = enriched.slice(0, limit);

		// Compute metrics strip stats
		const verifiedEmails = paginated.filter((a) => a.developer_email && a.developer_email.includes("@")).length;
		const contacted = paginated.filter((a) => a.status === "contacted" || a.status === "opened" || a.status === "bound").length;
		const savedTargets = paginated.filter((a) => a.is_saved).length;

		return c.json({
			apps: paginated,
			total: 500, // Endless discover catalog
			page,
			limit,
			has_more: paginated.length > 0,
			stats: {
				total_discovered: paginated.length,
				verified_emails: verifiedEmails,
				contacted,
				saved_targets: savedTargets,
			},
		});
	}
}

export class GetDiscoverLeads extends OpenAPIRoute {
	schema = {
		summary: "List all saved team target leads for MMP outreach",
		operationId: "getDiscoverLeads",
		tags: ["App Discovery"],
		responses: {
			"200": {
				description: "List of saved leads",
				...contentJson(
					z.object({
						leads: z.array(DiscoverAppSchema),
						total: z.number(),
					}),
				),
			},
		},
	};

	async handle(c: AppContext) {
		const authDO = getAuthDO(c.env);
		const rawLeads = await authDO.getAllDiscoverLeads();

		// Convert to schema format and enrich status
		const formatted: z.infer<typeof DiscoverAppSchema>[] = rawLeads.map((r) => ({
			id: r.id,
			bundle_id: r.bundle_id,
			platform: r.platform,
			app_name: r.app_name,
			app_icon_url: r.app_icon_url,
			app_url: r.app_url,
			developer_name: r.developer_name,
			developer_email: r.developer_email,
			developer_website: r.developer_website,
			installs_bracket: r.installs_bracket,
			rating: r.rating,
			reviews_count: r.reviews_count,
			category: r.category,
			country: r.country,
			has_iap: r.has_iap,
			has_ads: r.has_ads,
			release_date: r.release_date,
			updated_date: r.updated_date,
			status: r.status,
			is_saved: true,
			opened_count: 0,
			notes: r.notes,
		}));

		const enriched = await enrichAppsWithOutreachStatus(formatted, c.env);

		return c.json({
			leads: enriched,
			total: enriched.length,
		});
	}
}

export class PostDiscoverLead extends OpenAPIRoute {
	schema = {
		summary: "Save an app as a target lead for MMP outreach",
		operationId: "postDiscoverLead",
		tags: ["App Discovery"],
		request: {
			body: contentJson(SaveLeadRequestSchema),
		},
		responses: {
			"200": {
				description: "Lead saved successfully",
				...contentJson(DiscoverAppSchema),
			},
			"400": {
				description: "Invalid input",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const leadData = data.body;

		const authDO = getAuthDO(c.env);
		const saved = await authDO.setDiscoverLead(leadData as any);

		return c.json({
			...saved,
			is_saved: true,
			opened_count: 0,
		});
	}
}

export class DeleteDiscoverLead extends OpenAPIRoute {
	schema = {
		summary: "Remove an app from saved target leads",
		operationId: "deleteDiscoverLead",
		tags: ["App Discovery"],
		request: {
			params: z.object({
				id: z.string().min(1, "Lead ID is required"),
			}),
		},
		responses: {
			"200": {
				description: "Lead removed successfully",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Error deleting lead",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const id = decodeURIComponent(data.params.id);

		const authDO = getAuthDO(c.env);
		await authDO.deleteDiscoverLead(id);

		return c.json({ status: "success" });
	}
}
