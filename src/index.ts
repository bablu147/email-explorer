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

export default {
	email: baseHandler.email,
	scheduled: baseHandler.scheduled,
	async fetch(request: Request, env: any, context: any) {
		const url = new URL(request.url);

		if (url.pathname === "/robots.txt") {
			return new Response(ROBOTS_TXT_POLICY, {
				status: 200,
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					"Cache-Control": "public, max-age=86400",
					"X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
				},
			});
		}

		const res = await baseHandler.fetch(request, env, context);

		const headers = new Headers(res.headers);
		headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");

		return new Response(res.body, {
			status: res.status,
			statusText: res.statusText,
			headers,
		});
	},
};
