import PostalMime from "postal-mime";
import { parseBounce } from "./suppression";
import type { Env } from "./types";

async function streamToArrayBuffer(stream: ReadableStream, streamSize: number): Promise<Uint8Array> {
	const result = new Uint8Array(streamSize);
	let bytesRead = 0;
	const reader = stream.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		result.set(value, bytesRead);
		bytesRead += value.length;
	}
	return result;
}

export async function receiveEmail(
	event: { raw: ReadableStream; rawSize: number },
	env: Env,
	_ctx: ExecutionContext,
): Promise<void> {
	const rawEmail = await streamToArrayBuffer(event.raw, event.rawSize);
	const parser = new PostalMime();
	const parsedEmail = await parser.parse(rawEmail);

	if (
		!parsedEmail.to ||
		parsedEmail.to.length === 0 ||
		!parsedEmail.to[0].address
	) {
		throw new Error("received email with empty to");
	}

	const mailboxId = parsedEmail.to[0].address;
	const messageId = crypto.randomUUID();

	const key = `mailboxes/${mailboxId}.json`;
	const obj = await env.BUCKET.head(key);
	if (!obj) {
		await env.BUCKET.put(key, JSON.stringify({}));
	}

	const ns = env.MAILBOX;
	const id = ns.idFromName(mailboxId);
	const stub = ns.get(id);

	const attachmentData = [];
	if (parsedEmail.attachments) {
		for (const att of parsedEmail.attachments) {
			const attachmentId = crypto.randomUUID();
			const key = `attachments/${messageId}/${attachmentId}/${att.filename}`;
			await env.BUCKET.put(key, att.content);
			attachmentData.push({
				id: attachmentId,
				email_id: messageId,
				filename: att.filename || "untitled",
				mimetype: att.mimeType,
				size:
					typeof att.content === "string"
						? att.content.length
						: att.content.byteLength,
				content_id: att.contentId || null,
				disposition: att.disposition,
			});
		}
	}

	// Parse threading headers from incoming email
	const stripBrackets = (s: string) => s.replace(/^</, "").replace(/>$/, "");
	const inReplyTo = parsedEmail.inReplyTo
		? stripBrackets(parsedEmail.inReplyTo)
		: null;
	const emailReferences = parsedEmail.references
		? parsedEmail.references.split(/\s+/).filter(Boolean).map(stripBrackets)
		: [];

	const toAddresses = parsedEmail.to?.map((t) => t.address).filter(Boolean) || [];
	const ccAddresses = parsedEmail.cc?.map((c) => c.address).filter(Boolean) || [];

	// Determine spam classification from headers
	const headers = parsedEmail.headers || [];
	const findHeader = (name: string) => {
		const h = headers.find((item: any) => item.key?.toLowerCase() === name.toLowerCase());
		return h ? String(h.value).toLowerCase() : "";
	};

	const authResults = findHeader("authentication-results");
	const spamStatus = findHeader("x-spam-status");
	const isSpam =
		spamStatus.includes("yes") ||
		authResults.includes("dkim=fail") ||
		authResults.includes("spf=fail") ||
		authResults.includes("dmarc=fail");

	const targetFolder = isSpam ? "spam" : "inbox";
	const deliveryStatus = isSpam ? "spam" : "inbox";

	await stub.createEmail(
		targetFolder,
		{
			id: messageId,
			subject: parsedEmail.subject || "",
			sender: parsedEmail.from?.address || "",
			recipient: toAddresses.join(", ") || parsedEmail.to[0].address,
			cc: ccAddresses.length > 0 ? ccAddresses.join(", ") : null,
			date: new Date().toISOString(),
			body: parsedEmail.html || parsedEmail.text || "",
			in_reply_to: inReplyTo,
			email_references:
				emailReferences.length > 0 ? JSON.stringify(emailReferences) : null,
			thread_id: emailReferences[0] || inReplyTo || messageId,
			delivery_status: deliveryStatus,
			spam_score: isSpam ? 5.0 : 0.0,
		},
		attachmentData,
		mailboxId,
	);

	// A permanent-failure bounce marks the original sent message and puts the address on the
	// suppression list. Never allowed to break delivery of the bounce itself.
	try {
		const headerMap: Record<string, string> = {};
		for (const h of headers as Array<{ key?: string; value?: unknown }>) {
			if (h.key) headerMap[h.key.toLowerCase()] = String(h.value ?? "");
		}
		const decoder = new TextDecoder();
		let bodyText = parsedEmail.text || "";
		for (const att of parsedEmail.attachments || []) {
			if (/delivery-status|rfc822-headers/i.test(att.mimeType || "")) {
				bodyText +=
					"\n\n" +
					(typeof att.content === "string" ? att.content : decoder.decode(att.content));
			}
		}
		const bounce = parseBounce({
			fromAddress: parsedEmail.from?.address || "",
			subject: parsedEmail.subject || "",
			headers: headerMap,
			bodyText,
		});
		if (bounce) {
			const authDO = env.MAILBOX.get(env.MAILBOX.idFromName("AUTH"));
			for (const address of bounce.recipients) {
				if (await stub.markBounced(address)) {
					await authDO.addSuppression(
						address,
						"bounce",
						"Permanent delivery failure (hard bounce)",
						mailboxId,
					);
				}
			}
		}
	} catch (err) {
		console.error("Bounce handling failed:", err);
	}
}
