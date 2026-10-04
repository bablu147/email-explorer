// Simple MIME message builder for Cloudflare Workers
// Compliant with RFC 5322 & RFC 2045

export interface MimeMessageOptions {
	from: string;
	to: string | string[];
	cc?: string | string[];
	bcc?: string | string[];
	subject: string;
	text?: string;
	html?: string;
	attachments?: Array<{
		filename: string;
		content: string; // base64
		type: string;
		disposition?: "attachment" | "inline";
		contentId?: string;
	}>;
	inReplyTo?: string;
	references?: string[];
	/** Extra headers (e.g. List-Unsubscribe). Names/values must not contain line breaks. */
	headers?: Record<string, string>;
}

/**
 * Makes a value safe to write on one header line. A CR or LF would end the line and let the rest of
 * the value become a header of its own (a subject of "Hi\r\nBcc: x@evil.test" added a real Bcc), so
 * every run of control characters, with any spaces around it, becomes a single space. U+2028/2029
 * and the C1 range are included because some parsers treat them as line breaks too.
 */
function headerValue(value: unknown): string {
	return String(value ?? "")
		.split(/[\x00-\x1f\x7f-\x9f\u2028\u2029]+/)
		.map((part) => part.trim())
		.filter(Boolean)
		.join(" ");
}

/**
 * For a value written inside a quoted parameter (filename="..."), where a quote would end the string
 * and a backslash would escape its closing quote. Both are replaced rather than escaped, because
 * not every mail client honours backslash escapes there.
 */
function quotedParamValue(value: unknown): string {
	return headerValue(value).replace(/"/g, "'").replace(/\\/g, "_");
}

export function buildMimeMessage(options: MimeMessageOptions): string {
	const {
		from,
		to,
		cc,
		subject,
		text,
		html,
		attachments,
		inReplyTo,
		references,
		headers,
	} = options;

	const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
	const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`;

	// Convert to to string if it's an array
	const toStr = Array.isArray(to) ? to.map(headerValue).join(", ") : headerValue(to);
	const ccStr = cc ? (Array.isArray(cc) ? cc.map(headerValue).join(", ") : headerValue(cc)) : "";

	let mime = "";

	// Headers
	mime += `From: ${headerValue(from)}\r\n`;
	mime += `To: ${toStr}\r\n`;
	if (ccStr && ccStr.trim().length > 0) {
		mime += `Cc: ${ccStr}\r\n`;
	}
	// Note: Bcc is strictly NEVER included in MIME headers to prevent recipient leakage (RFC 5322)
	mime += `Subject: ${headerValue(subject)}\r\n`;
	mime += `MIME-Version: 1.0\r\n`;
	mime += `Date: ${new Date().toUTCString()}\r\n`;
	mime += `Message-ID: <${crypto.randomUUID()}@cloudflare.workers.dev>\r\n`;

	// Threading headers
	if (inReplyTo) {
		mime += `In-Reply-To: <${headerValue(inReplyTo)}>\r\n`;
	}
	if (references && references.length > 0) {
		const refs = references.map((ref) => `<${headerValue(ref)}>`).join(" ");
		mime += `References: ${refs}\r\n`;
	}

	if (headers) {
		for (const [name, value] of Object.entries(headers)) {
			mime += `${name.replace(/[\r\n:]/g, "")}: ${headerValue(value)}\r\n`;
		}
	}

	// Content-Type
	if (attachments && attachments.length > 0) {
		mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
		mime += `This is a multi-part message in MIME format.\r\n\r\n`;
		mime += `--${boundary}\r\n`;
	}

	// Body content
	if (text && html) {
		// Multipart alternative for text and HTML
		mime += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;

		// Text version
		mime += `--${altBoundary}\r\n`;
		mime += `Content-Type: text/plain; charset=utf-8\r\n`;
		mime += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
		mime += `${text}\r\n\r\n`;

		// HTML version
		mime += `--${altBoundary}\r\n`;
		mime += `Content-Type: text/html; charset=utf-8\r\n`;
		mime += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
		mime += `${html}\r\n\r\n`;

		mime += `--${altBoundary}--\r\n`;
	} else if (html) {
		mime += `Content-Type: text/html; charset=utf-8\r\n`;
		mime += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
		mime += `${html}\r\n`;
	} else if (text) {
		mime += `Content-Type: text/plain; charset=utf-8\r\n`;
		mime += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
		mime += `${text}\r\n`;
	}

	// Attachments
	if (attachments && attachments.length > 0) {
		for (const att of attachments) {
			const filename = quotedParamValue(att.filename);
			const contentId = headerValue(att.contentId);
			mime += `\r\n--${boundary}\r\n`;
			mime += `Content-Type: ${headerValue(att.type)}; name="${filename}"\r\n`;
			mime += `Content-Transfer-Encoding: base64\r\n`;

			if (att.disposition === "inline" && contentId) {
				mime += `Content-Disposition: inline; filename="${filename}"\r\n`;
				mime += `Content-ID: <${contentId}>\r\n\r\n`;
			} else {
				mime += `Content-Disposition: attachment; filename="${filename}"\r\n\r\n`;
			}

			// Split base64 content into 76-character lines (RFC 2045)
			const content = att.content;
			for (let i = 0; i < content.length; i += 76) {
				mime += content.substring(i, i + 76) + "\r\n";
			}
		}

		mime += `\r\n--${boundary}--\r\n`;
	}

	return mime;
}
