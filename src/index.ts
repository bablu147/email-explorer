import { EmailExplorer } from "./worker";

export { MailboxDO } from "./durableObject";

const baseHandler = EmailExplorer({
	auth: {
		enabled: true,
	},
});

const ROBOTS_TXT_POLICY = `# Reflect Internal Mail Service — Access Forbidden for All Crawlers & AI Scrapers
User-agent: *
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: Cohere-ai
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: Omgilibot
Disallow: /

User-agent: Amazonbot
Disallow: /
`;

// `wrangler dev` and the e2e harness serve plain http on these hosts, so they are exempt from the
// HTTPS requirement below.
function isLocalDevHost(hostname: string): boolean {
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "[::1]" ||
		hostname.endsWith(".localhost")
	);
}

// Headers for everything the Worker returns (static assets get theirs from dashboard/_headers).
// Referrer-Policy and Cache-Control are defaults only: a route that set its own keeps it.
// No Cross-Origin-Resource-Policy / COEP on purpose: the open-tracking pixel has to stay
// embeddable in recipients' mail clients.
function withSecurityHeaders(res: Response, pathname: string): Response {
	const headers = new Headers(res.headers);
	headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
	headers.set("Strict-Transport-Security", "max-age=31536000");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Frame-Options", "DENY");
	if (!headers.has("Referrer-Policy")) {
		headers.set("Referrer-Policy", "no-referrer");
	}
	if (pathname.startsWith("/api/") && !headers.has("Cache-Control")) {
		headers.set("Cache-Control", "no-store");
	}

	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers,
	});
}

export default {
	email: baseHandler.email,
	scheduled: baseHandler.scheduled,
	async fetch(request: Request, env: any, context: any) {
		const url = new URL(request.url);

		// Refuse plain http in code too, so the API stays closed even if the zone's
		// "Always Use HTTPS" setting is ever switched off.
		if (url.protocol === "http:" && !isLocalDevHost(url.hostname)) {
			const pathname = url.pathname;
			if (request.method === "GET" || request.method === "HEAD") {
				url.protocol = "https:";
				return withSecurityHeaders(
					new Response(null, { status: 301, headers: { Location: url.toString() } }),
					pathname,
				);
			}
			// No redirect for writes: clients replay a redirected POST as a GET without its body.
			return withSecurityHeaders(
				new Response(JSON.stringify({ error: "HTTPS required" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				}),
				pathname,
			);
		}

		if (url.pathname === "/robots.txt") {
			return withSecurityHeaders(
				new Response(ROBOTS_TXT_POLICY, {
					status: 200,
					headers: {
						"Content-Type": "text/plain; charset=utf-8",
						"Cache-Control": "public, max-age=86400",
					},
				}),
				url.pathname,
			);
		}

		const res = await baseHandler.fetch(request, env, context);

		return withSecurityHeaders(res, url.pathname);
	},
};
