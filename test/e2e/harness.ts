// Boots the real worker with `wrangler dev --local` on a throwaway database and gives tests a tiny
// API client. Nothing here touches production.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const EMAIL_DIR = join(ROOT, ".wrangler/tmp/email");
export const PASSWORD = "correct-horse-battery";

export interface Harness {
	base: string;
	stop: () => Promise<void>;
}

export async function startWorker(port = 8811): Promise<Harness> {
	const dataDir = mkdtempSync(join(tmpdir(), "mail-e2e-"));
	const child: ChildProcess = spawn(
		"npx",
		["wrangler", "dev", "--local", "--persist-to", dataDir, "--port", String(port), "--log-level", "warn"],
		{ cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CI: "1", NO_COLOR: "1" } },
	);
	let log = "";
	child.stdout?.on("data", (d) => {
		log += d;
	});
	child.stderr?.on("data", (d) => {
		log += d;
	});

	const base = `http://127.0.0.1:${port}`;
	const deadline = Date.now() + 120_000;
	for (;;) {
		if (child.exitCode !== null) throw new Error(`wrangler exited early:\n${log}`);
		try {
			const res = await fetch(`${base}/api/v1/settings`);
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

export interface Reply {
	status: number;
	// biome-ignore lint/suspicious/noExplicitAny: test helper over arbitrary JSON
	body: any;
	headers: Headers;
}

export function client(base: string) {
	async function call(
		method: string,
		path: string,
		opts: { token?: string; json?: unknown; raw?: BodyInit; contentType?: string } = {},
	): Promise<Reply> {
		const headers: Record<string, string> = {};
		if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
		let body: BodyInit | undefined = opts.raw;
		if (opts.json !== undefined) {
			headers["content-type"] = "application/json";
			body = JSON.stringify(opts.json);
		} else if (opts.contentType) {
			headers["content-type"] = opts.contentType;
		}
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
		async login(email: string, password = PASSWORD) {
			const res = await call("POST", "/api/v1/auth/login", { json: { email, password } });
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
