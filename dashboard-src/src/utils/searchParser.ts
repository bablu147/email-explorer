/**
 * Client-side search query parser and filter engine for Reflect Mail.
 * Supports token syntax (from:, to:, has:attachment, is:unread, is:starred,
 * after:, before:, folder:) and free-text search.
 */

import type { Email } from "@/types";

export interface ParsedSearchQuery {
	from?: string;
	to?: string;
	folder?: string;
	hasAttachment?: boolean;
	isRead?: boolean;
	isStarred?: boolean;
	after?: string;
	before?: string;
	textTerms: string[];
	rawText: string;
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
	const result: ParsedSearchQuery = {
		textTerms: [],
		rawText: "",
	};

	if (!query || typeof query !== "string") {
		return result;
	}

	const tokenRegex = /(?:(\w+):(?:"([^"]*)"|([^\s]+)))|(?:"([^"]*)")|([^\s]+)/g;
	let match: RegExpExecArray | null;
	const textTerms: string[] = [];

	while ((match = tokenRegex.exec(query)) !== null) {
		const [, key, quotedVal, unquotedVal, quotedText, plainText] = match;

		if (key) {
			const filterKey = key.toLowerCase();
			const val = (quotedVal !== undefined ? quotedVal : unquotedVal || "").trim();

			switch (filterKey) {
				case "from":
					result.from = val;
					break;
				case "to":
					result.to = val;
					break;
				case "folder":
					result.folder = val.toLowerCase();
					break;
				case "has":
					if (val.toLowerCase() === "attachment" || val.toLowerCase() === "attachments") {
						result.hasAttachment = true;
					}
					break;
				case "is":
					if (val.toLowerCase() === "unread") {
						result.isRead = false;
					} else if (val.toLowerCase() === "read") {
						result.isRead = true;
					} else if (val.toLowerCase() === "starred" || val.toLowerCase() === "star") {
						result.isStarred = true;
					} else if (val.toLowerCase() === "unstarred") {
						result.isStarred = false;
					}
					break;
				case "after":
				case "since":
					result.after = normalizeDate(val, "start");
					break;
				case "before":
				case "until":
					result.before = normalizeDate(val, "end");
					break;
				default:
					textTerms.push(match[0]);
					break;
			}
		} else if (quotedText !== undefined) {
			if (quotedText.trim()) textTerms.push(quotedText.trim());
		} else if (plainText !== undefined) {
			if (plainText.trim()) textTerms.push(plainText.trim());
		}
	}

	result.textTerms = textTerms;
	result.rawText = textTerms.join(" ");
	return result;
}

function normalizeDate(val: string, boundary: "start" | "end"): string {
	if (val.includes("T")) return val;
	if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
		return boundary === "start" ? `${val}T00:00:00.000Z` : `${val}T23:59:59.999Z`;
	}
	return val;
}

export function filterEmailsByQuery(emails: Email[], query: string): Email[] {
	if (!query.trim()) return emails;

	const parsed = parseSearchQuery(query);
	const textQuery = parsed.rawText.toLowerCase().trim();

	return emails.filter((e) => {
		// Filter tokens
		if (parsed.from && !e.sender?.toLowerCase().includes(parsed.from.toLowerCase())) {
			return false;
		}

		if (parsed.to) {
			const toLower = (e.recipient || "").toLowerCase();
			const ccLower = (e.cc || "").toLowerCase();
			const target = parsed.to.toLowerCase();
			if (!toLower.includes(target) && !ccLower.includes(target)) {
				return false;
			}
		}

		if (parsed.hasAttachment !== undefined) {
			const hasAtt = (e.attachments && e.attachments.length > 0);
			if (parsed.hasAttachment !== hasAtt) return false;
		}

		if (parsed.isRead !== undefined && !!e.read !== parsed.isRead) {
			return false;
		}

		if (parsed.isStarred !== undefined && !!e.starred !== parsed.isStarred) {
			return false;
		}

		if (parsed.after) {
			const emailTime = new Date(e.date).getTime();
			const afterTime = new Date(parsed.after).getTime();
			if (!isNaN(emailTime) && !isNaN(afterTime) && emailTime < afterTime) {
				return false;
			}
		}

		if (parsed.before) {
			const emailTime = new Date(e.date).getTime();
			const beforeTime = new Date(parsed.before).getTime();
			if (!isNaN(emailTime) && !isNaN(beforeTime) && emailTime > beforeTime) {
				return false;
			}
		}

		if (parsed.folder && parsed.folder !== "all") {
			if (parsed.folder === "snoozed") {
				if (!e.snoozed_until || e.folder_id !== "inbox") return false;
			} else if (parsed.folder === "scheduled") {
				if (!e.scheduled_at || e.folder_id !== "drafts") return false;
			} else if (parsed.folder === "starred") {
				if (!e.starred) return false;
			} else if (e.folder_id !== parsed.folder) {
				return false;
			}
		}

		// Free text search
		if (textQuery) {
			const subject = (e.subject || "").toLowerCase();
			const sender = (e.sender || "").toLowerCase();
			const recipient = (e.recipient || "").toLowerCase();
			const cc = (e.cc || "").toLowerCase();
			const body = (e.body || "").toLowerCase();

			const matches =
				subject.includes(textQuery) ||
				sender.includes(textQuery) ||
				recipient.includes(textQuery) ||
				cc.includes(textQuery) ||
				body.includes(textQuery);

			if (!matches) return false;
		}

		return true;
	});
}
