import { EmailMessage } from "cloudflare:email";
import { buildMimeMessage, formatSenderString } from "./mime-builder";
export { formatSenderString } from "./mime-builder";
import {
	appendUnsubscribeFooter,
	describeSuppressed,
	normalizeEmail,
	signUnsubscribeToken,
	SUPPRESSION_CHECK_BATCH,
} from "./suppression";
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
	/**
	 * The mailbox the message is sent from. Its address is the envelope sender and the From header:
	 * there is deliberately no separate `from`, so a caller cannot send as another address.
	 */
	mailboxId: string;
	/** Optional human-readable display name for the From header (e.g. "Lara Kuhlmann"). */
	fromName?: string;
	/** Id the message will have in the Sent folder; used in the open/click tracking links. */
	messageId: string;
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

export interface SuppressedRecipient {
	email: string;
	reason: string;
}

/** Why a message may not go out: 422 = a recipient is on the do-not-contact list, 503 = the list could not be read. */
export interface SendBlock {
	status: 422 | 503;
	error: string;
	suppressed?: SuppressedRecipient[];
}

/**
 * The do-not-contact check shared by every send path (send, reply, schedule, scheduled fire, forward).
 * Pass every envelope recipient (To, Cc, Bcc), as normalised by parseRecipients. The only address a
 * caller may leave out is the one a reply answers (see answeredSender); everyone else on a reply is
 * checked. Returns null when the message may go out.
 *
 * Fails closed: if the list cannot be read, the message is blocked as well.
 */
export async function checkDoNotContact(env: Env, recipients: string[]): Promise<SendBlock | null> {
	const addresses = Array.from(
		new Set(recipients.map((r) => normalizeEmail(r) ?? r.trim().toLowerCase())),
	);
	const suppressed: SuppressedRecipient[] = [];
	try {
		const auth = env.MAILBOX.get(env.MAILBOX.idFromName("AUTH"));
		for (let i = 0; i < addresses.length; i += SUPPRESSION_CHECK_BATCH) {
			const hits = await auth.checkSuppressions(addresses.slice(i, i + SUPPRESSION_CHECK_BATCH));
			for (const hit of hits) suppressed.push({ email: hit.email, reason: hit.reason });
		}
	} catch (err) {
		console.error("Do-not-contact check failed:", err);
		return { status: 503, error: "Could not check the do-not-contact list. Try again." };
	}
	if (suppressed.length === 0) return null;
	return { status: 422, error: describeSuppressed(suppressed.map((s) => s.email)), suppressed };
}

export async function getMailboxDisplayName(env: Env, mailboxId: string): Promise<string | undefined> {
	try {
		const key = `mailboxes/${mailboxId.trim().toLowerCase()}.json`;
		const obj = await env.BUCKET.get(key);
		if (obj) {
			const settings: any = await obj.json();
			const name = settings?.fromName || settings?.name;
			if (typeof name === "string" && name.trim().length > 0) {
				return name.trim();
			}
		}
	} catch {
		// Ignore failure reading mailbox settings
	}
	return undefined;
}

/**
 * Sends one message through Cloudflare Email Sending, one copy per recipient (so Bcc stays hidden and
 * unsubscribe links are per person). Adds open/click tracking, and, for outreach (not a reply), the
 * unsubscribe footer and List-Unsubscribe headers. Throws if any send fails.
 *
 * Shared by the normal send route and by scheduled sends running from a Durable Object alarm.
 * It does not look at the do-not-contact list: callers run checkDoNotContact first.
 */
export async function deliverMessage(env: Env, msg: OutboundMessage): Promise<void> {
	const toList = msg.to;
	const ccList = msg.cc ?? [];
	const bccList = msg.bcc ?? [];
	const recipients = Array.from(new Set([...toList, ...ccList, ...bccList]));
	if (recipients.length === 0) throw new Error("No valid recipient email provided");

	const resolvedName = msg.fromName || (await getMailboxDisplayName(env, msg.mailboxId));
	const { fromHeader } = formatSenderString(msg.mailboxId, resolvedName);

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
			from: fromHeader,
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
		const message = new EmailMessage(msg.mailboxId, recipient, await buildMimeFor(recipient));
		await env.SEND_EMAIL.send(message);
	}
}
