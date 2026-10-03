import { signClickLink } from "./suppression";

// An href holds HTML, so "&amp;" means "&". Decode it so the tracked link points at the real URL.
function decodeHrefEntities(url: string): string {
	return url.replace(/&amp;/gi, "&");
}

export async function injectEmailTracking(
	htmlContent: string | undefined,
	mailboxId: string,
	messageId: string,
	clickSecret: string,
): Promise<string | undefined> {
	if (!htmlContent) return htmlContent;
	const trackingBase = "https://mail.reflect.cloud";
	// Gmail & webmail clients skip fetching images with display:none!
	// Using standard 1x1 inline pixel with opacity:0.01 guarantees GoogleImageProxy loads it upon open.
	const openPixel = `<img src="${trackingBase}/api/v1/track/open/${encodeURIComponent(mailboxId)}/${encodeURIComponent(messageId)}" width="1" height="1" alt="" border="0" style="width:1px!important;height:1px!important;min-width:1px!important;min-height:1px!important;max-width:1px!important;max-height:1px!important;opacity:0.01;pointer-events:none;border:none!important;display:inline!important;margin:0!important;padding:0!important;" />`;

	// Signing is async, so collect the links first, then substitute.
	const linkPattern = /<a\s+([^>]*?)href=(["'])(https?:\/\/[^"'\s>]+)\2([^>]*)>/gi;
	const signatures = new Map<string, string>();
	for (const m of htmlContent.matchAll(linkPattern)) {
		const originalUrl = decodeHrefEntities(m[3]);
		if (!signatures.has(originalUrl)) {
			signatures.set(
				originalUrl,
				await signClickLink(clickSecret, mailboxId, messageId, originalUrl),
			);
		}
	}
	let trackedHtml = htmlContent.replace(
		linkPattern,
		(match, prefix, _quote, rawUrl, suffix) => {
			const originalUrl = decodeHrefEntities(rawUrl);
			if (
				originalUrl.includes("/api/v1/track/") ||
				originalUrl.includes("/api/v1/unsubscribe/")
			)
				return match;
			const sig = signatures.get(originalUrl) ?? "";
			const trackedUrl = `${trackingBase}/api/v1/track/click/${encodeURIComponent(mailboxId)}/${encodeURIComponent(messageId)}?url=${encodeURIComponent(originalUrl)}&s=${encodeURIComponent(sig)}`;
			return `<a ${prefix}href="${trackedUrl}"${suffix}>`;
		},
	);

	if (trackedHtml.includes("</body>")) {
		trackedHtml = trackedHtml.replace("</body>", `${openPixel}</body>`);
	} else if (trackedHtml.includes("</html>")) {
		trackedHtml = trackedHtml.replace("</html>", `${openPixel}</html>`);
	} else {
		trackedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;">${trackedHtml}${openPixel}</body></html>`;
	}
	return trackedHtml;
}
