import PostalMime from "postal-mime";
// The explicit .ts lets the node unit tests import this file (as in outreach.ts).
import { parseBounce } from "./suppression.ts";
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

/**
 * What the email() handler is given. `to` and `from` are the SMTP envelope (who the message was
 * really delivered to and sent by), not the To/From headers written inside the message.
 */
export interface InboundEmailEvent {
	raw: ReadableStream;
	rawSize: number;
	to?: string;
	from?: string;
}

const mailboxKey = (mailboxId: string) => `mailboxes/${mailboxId}.json`;

/**
 * Finds the mailbox a delivered-to address belongs to. Mailbox ids are R2 keys and so
 * case-sensitive, while senders write addresses in any letter case, so the match ignores case.
 * An address without a mailbox still gets one, so that no mail is ever dropped.
 * Exported for the unit test.
 */
export async function resolveMailboxId(env: Env, recipient: string): Promise<string> {
	// The lower-cased id is tried first. Mailbox ids are lower-case now; one with capitals may be a
	// ghost left by the old filing bug, and trying the exact case first let that ghost keep taking the
	// real mailbox's mail whenever a sender used the same capitals.
	const lower = recipient.toLowerCase();
	if (await env.BUCKET.head(mailboxKey(lower))) return lower;

	if (lower !== recipient && (await env.BUCKET.head(mailboxKey(recipient)))) return recipient;

	// A mailbox whose own id contains capitals can only be found by comparing against every id.
	let cursor: string | undefined;
	do {
		const page = await env.BUCKET.list({ prefix: "mailboxes/", cursor });
		for (const obj of page.objects) {
			const id = obj.key.replace("mailboxes/", "").replace(/\.json$/, "");
			if (id.toLowerCase() === lower) return id;
		}
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);

	await env.BUCKET.put(mailboxKey(lower), JSON.stringify({}));
	return lower;
}

export async function receiveEmail(
	event: InboundEmailEvent,
	env: Env,
	_ctx: ExecutionContext,
): Promise<void> {
	const rawEmail = await streamToArrayBuffer(event.raw, event.rawSize);
	const parser = new PostalMime();
	const parsedEmail = await parser.parse(rawEmail);

	// File by the envelope recipient: the address Cloudflare routed to this Worker. The To header is
	// written by the sender, and the team address may be in Cc or Bcc, or not first, so filing by it
	// put mail into mailboxes nobody can see. It is only the fallback when there is no envelope.
	const deliveredTo =
		(event.to ?? "").trim() || (parsedEmail.to?.[0]?.address ?? "").trim();
	if (!deliveredTo) {
		throw new Error("received email with empty to");
	}

	const mailboxId = await resolveMailboxId(env, deliveredTo);
	const messageId = crypto.randomUUID();

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
			// Still the To header, so the UI shows who the message was addressed to. A message with
			// no To address (delivered as Bcc) shows the address it was delivered to.
			recipient: toAddresses.join(", ") || deliveredTo,
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
