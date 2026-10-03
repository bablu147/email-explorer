import { EmailMessage } from "cloudflare:email";
import { buildMimeMessage } from "./mime-builder";
import { appendUnsubscribeFooter, signUnsubscribeToken } from "./suppression";
import { injectEmailTracking } from "./tracking";
import type { Env } from "./types";

export interface OutboundAttachment {
	filename: string;
	/** base64 */
	content: string;
	type: string;
	disposition?: "attachment" | "inline";
	contentId?: string;
}

export interface OutboundMessage {
	mailboxId: string;
	/** Id the message will have in the Sent folder; used in the open/click tracking links. */
	messageId: string;
	from: string;
	to: string[];
	cc?: string[];
	bcc?: string[];
	subject: string;
	html?: string;
	text?: string;
	attachments?: OutboundAttachment[];
	inReplyTo?: string;
	references?: string[];
}

/**
 * Sends one message through Cloudflare Email Sending, one copy per recipient (so Bcc stays hidden and
 * unsubscribe links are per person). Adds open/click tracking, and, for outreach (not a reply), the
 * unsubscribe footer and List-Unsubscribe headers. Throws if any send fails.
 *
 * Shared by the normal send route and by scheduled sends running from a Durable Object alarm.
 */
export async function deliverMessage(env: Env, msg: OutboundMessage): Promise<void> {
	const toList = msg.to;
	const ccList = msg.cc ?? [];
	const bccList = msg.bcc ?? [];
	const recipients = Array.from(new Set([...toList, ...ccList, ...bccList]));
	if (recipients.length === 0) throw new Error("No valid recipient email provided");

	// One signing secret serves unsubscribe tokens and click-tracking link signatures.
	const signingSecret = await env.MAILBOX.get(env.MAILBOX.idFromName("AUTH")).getUnsubscribeSecret();
	const outboundHtml = await injectEmailTracking(msg.html, msg.mailboxId, msg.messageId, signingSecret);

	// Outreach = a brand-new message (not a reply or forward). Only outreach carries an
	// unsubscribe link and the List-Unsubscribe headers, signed per recipient.
	const isOutreach = !msg.inReplyTo;

	const buildMimeFor = async (recipient: string) => {
		let bodyHtml = outboundHtml;
		let bodyText = msg.text;
		let extraHeaders: Record<string, string> | undefined;
		if (isOutreach) {
			const token = await signUnsubscribeToken(signingSecret, recipient, msg.mailboxId);
			const unsubscribeUrl = `https://mail.reflect.cloud/api/v1/unsubscribe/${token}`;
			const withFooter = appendUnsubscribeFooter(outboundHtml, msg.text, unsubscribeUrl);
			bodyHtml = withFooter.html;
			bodyText = withFooter.text;
			extraHeaders = {
				"List-Unsubscribe": `<${unsubscribeUrl}>`,
				"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
			};
		}
		return buildMimeMessage({
			from: msg.from,
			to: toList,
			cc: ccList.length > 0 ? ccList : undefined,
			bcc: bccList.length > 0 ? bccList : undefined,
			subject: msg.subject,
			text: bodyText,
			html: bodyHtml,
			attachments: msg.attachments?.map((att) => ({
				filename: att.filename,
				content: att.content,
				type: att.type,
				disposition: att.disposition || "attachment",
				contentId: att.contentId,
			})),
			inReplyTo: msg.inReplyTo,
			references: msg.references,
			headers: extraHeaders,
		});
	};

	for (const recipient of recipients) {
		const message = new EmailMessage(msg.from, recipient, await buildMimeFor(recipient));
		await env.SEND_EMAIL.send(message);
	}
}
