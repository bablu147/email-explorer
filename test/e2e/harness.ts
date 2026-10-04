// Boots the real worker with `wrangler dev --local` on a throwaway database and gives tests a tiny
// API client. Nothing here touches production.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import https from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const EMAIL_DIR = join(ROOT, ".wrangler/tmp/email");
export const PASSWORD = "correct-horse-battery";

// The sign-in limits count by client address, which the Worker reads from the CF-Connecting-IP
// header. Cloudflare sets that header in production; locally the client may, and the runtime only
// fills in 127.0.0.1 when it is absent. So every call says it comes from a new made-up address,
// and no ordinary test can trip a limit meant for one address. A test of the limits pins one.
let addressCounter = 0;
function nextAddress(): string {
	const n = ++addressCounter;
	return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

export interface Harness {
	base: string;
	stop: () => Promise<void>;
}

/**
 * `https` serves the worker over https with wrangler's self-signed certificate, which is how the
 * worker sees requests in production. fetch refuses that certificate: use `httpsCall`.
 */
export async function startWorker(port = 8811, opts: { https?: boolean } = {}): Promise<Harness> {
	const dataDir = mkdtempSync(join(tmpdir(), "mail-e2e-"));
	const args = ["wrangler", "dev", "--local", "--persist-to", dataDir, "--port", String(port), "--log-level", "warn"];
	if (opts.https) args.push("--local-protocol", "https");
	const child: ChildProcess = spawn("npx", args, {
		cwd: ROOT,
		stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env, CI: "1", NO_COLOR: "1" },
	});
	let log = "";
	child.stdout?.on("data", (d) => {
		log += d;
	});
	child.stderr?.on("data", (d) => {
		log += d;
	});

	const base = `${opts.https ? "https" : "http"}://127.0.0.1:${port}`;
	const deadline = Date.now() + 120_000;
	for (;;) {
		if (child.exitCode !== null) throw new Error(`wrangler exited early:\n${log}`);
		try {
			const res = opts.https ? await httpsCall(base, "GET", "/api/v1/settings") : await fetch(`${base}/api/v1/settings`);
			if (res.status < 500) break;
		} catch {
			// not up yet
		}
		if (Date.now() > deadline) {
			child.kill("SIGKILL");
			throw new Error(`worker did not start in time:\n${log}`);
		}
		await new Promise((r) => setTimeout(r, 500));
	}

	return {
		base,
		stop: async () => {
			child.kill("SIGTERM");
			await new Promise((r) => setTimeout(r, 500));
			if (child.exitCode === null) child.kill("SIGKILL");
			rmSync(dataDir, { recursive: true, force: true });
		},
	};
}

/** One request to a worker started with `https`, accepting its self-signed certificate. */
export function httpsCall(
	base: string,
	method: string,
	path: string,
	opts: { json?: unknown; headers?: Record<string, string> } = {},
	// biome-ignore lint/suspicious/noExplicitAny: test helper over arbitrary JSON
): Promise<{ status: number; body: any; setCookie: string[] }> {
	const { hostname, port } = new URL(base);
	const payload = opts.json === undefined ? undefined : JSON.stringify(opts.json);
	const headers: Record<string, string> = { "CF-Connecting-IP": nextAddress(), ...opts.headers };
	if (payload !== undefined) {
		headers["content-type"] = "application/json";
		headers["content-length"] = String(Buffer.byteLength(payload));
	}
	return new Promise((resolve, reject) => {
		const req = https.request({ host: hostname, port, path, method, headers, rejectUnauthorized: false }, (res) => {
			let data = "";
			res.setEncoding("utf8");
			res.on("data", (chunk) => {
				data += chunk;
			});
			res.on("end", () => {
				const json = String(res.headers["content-type"] || "").includes("json");
				resolve({
					status: res.statusCode ?? 0,
					body: json ? JSON.parse(data || "null") : data,
					setCookie: res.headers["set-cookie"] ?? [],
				});
			});
		});
		req.on("error", reject);
		req.end(payload);
	});
}

export interface Reply {
	status: number;
	// biome-ignore lint/suspicious/noExplicitAny: test helper over arbitrary JSON
	body: any;
	headers: Headers;
}

export interface CallOptions {
	/** A session token, sent as "Authorization: Bearer". */
	token?: string;
	/** A session token, sent the way a browser sends it: in the session cookie. */
	cookie?: string;
	json?: unknown;
	raw?: BodyInit;
	contentType?: string;
	/** The client address for this call (see `client`). */
	ip?: string;
	/** Further request headers, sent as given. They win over everything above. */
	headers?: Record<string, string>;
}

/** The session token a login response set, whichever name the cookie has. Empty when it set none. */
export function sessionTokenFrom(headers: Headers): string {
	for (const cookie of headers.getSetCookie()) {
		const match = /^(?:__Host-session|session)=([^;]+)/.exec(cookie);
		if (match) return match[1];
	}
	return "";
}

/** `defaults.ip` pins the client address for every call of this client; a call's own `ip` wins. */
export function client(base: string, defaults: { ip?: string } = {}) {
	async function call(method: string, path: string, opts: CallOptions = {}): Promise<Reply> {
		const headers: Record<string, string> = {
			"CF-Connecting-IP": opts.ip ?? defaults.ip ?? nextAddress(),
		};
		if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
		// The cookie is named "session" on plain http (the "__Host-" name needs https).
		if (opts.cookie) headers.Cookie = `session=${opts.cookie}`;
		let body: BodyInit | undefined = opts.raw;
		if (opts.json !== undefined) {
			headers["content-type"] = "application/json";
			body = JSON.stringify(opts.json);
		} else if (opts.contentType) {
			headers["content-type"] = opts.contentType;
		}
		Object.assign(headers, opts.headers);
		const res = await fetch(base + path, { method, headers, body, redirect: "manual" });
		const buf = Buffer.from(await res.arrayBuffer());
		let parsed: unknown = buf;
		const type = res.headers.get("content-type") || "";
		if (type.includes("json")) parsed = JSON.parse(buf.toString("utf8") || "null");
		else if (type.startsWith("text/")) parsed = buf.toString("utf8");
		return { status: res.status, body: parsed, headers: res.headers };
	}
	return {
		call,
		get: (p: string, token?: string) => call("GET", p, { token }),
		post: (p: string, json: unknown, token?: string) => call("POST", p, { token, json }),
		put: (p: string, json: unknown, token?: string) => call("PUT", p, { token, json }),
		del: (p: string, token?: string) => call("DELETE", p, { token }),
		/**
		 * Signs in. The server sends the session token only in the Set-Cookie header; it is handed
		 * back here as `body.id`, which is not part of the real response (use `call` to see that).
		 */
		async login(email: string, password = PASSWORD, opts: { ip?: string } = {}) {
			const res = await call("POST", "/api/v1/auth/login", { json: { email, password }, ip: opts.ip });
			const token = sessionTokenFrom(res.headers);
			if (token && res.body && typeof res.body === "object") res.body = { ...res.body, id: token };
			return res;
		},
		/** Delivers a raw RFC 822 message to the Worker's email() handler, like Cloudflare Email Routing. */
		async deliver(raw: string, from: string, to: string): Promise<number> {
			const res = await fetch(
				`${base}/cdn-cgi/handler/email?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
				{ method: "POST", body: raw },
			);
			return res.status;
		},
	};
}

/** The local send_email binding writes each outgoing message to disk; these helpers read them back. */
export function sentFiles(): string[] {
	if (!existsSync(EMAIL_DIR)) return [];
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const name of readdirSync(dir)) {
			const p = join(dir, name);
			if (statSync(p).isDirectory()) walk(p);
			else if (p.endsWith(".eml")) out.push(p);
		}
	};
	walk(EMAIL_DIR);
	return out;
}

export async function waitForNewMessages(before: Set<string>, count: number): Promise<string[]> {
	const deadline = Date.now() + 5000;
	for (;;) {
		const fresh = sentFiles().filter((f) => !before.has(f));
		if (fresh.length >= count || Date.now() > deadline) return fresh.map((f) => readFileSync(f, "utf8"));
		await new Promise((r) => setTimeout(r, 100));
	}
}

export function rawEmail(opts: {
	from: string;
	to: string;
	subject: string;
	body?: string;
	messageId?: string;
	inReplyTo?: string;
	extraHeaders?: string[];
}): string {
	return [
		`From: ${opts.from}`,
		`To: ${opts.to}`,
		`Subject: ${opts.subject}`,
		`Message-ID: <${opts.messageId || `${Math.random().toString(36).slice(2)}@sender.test`}>`,
		...(opts.inReplyTo ? [`In-Reply-To: <${opts.inReplyTo}>`] : []),
		...(opts.extraHeaders || []),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
		"",
		opts.body ?? "Hello there",
		"",
	].join("\r\n");
}
