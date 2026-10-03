/**
 * Search query parser and SQL builder for Reflect Mail.
 * Parses filter tokens (from:, to:, has:attachment, is:unread, is:starred,
 * after:, before:, folder:) and free-text search terms.
 */

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

	// Token regex that captures key:value pairs (supporting double-quoted values) or standalone words/quotes
	// Matches: key:"quoted value" | key:unquoted_value | "quoted free text" | unquoted_word
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
					// Unknown prefix, treat full matched string as text term
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
	// If already an ISO string with T, leave as is
	if (val.includes("T")) return val;
	// Match YYYY-MM-DD
	if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
		return boundary === "start" ? `${val}T00:00:00.000Z` : `${val}T23:59:59.999Z`;
	}
	return val;
}

export interface SqlWhereClause {
	whereSql: string;
	params: (string | number)[];
}

/**
 * Builds parameterized SQL conditions for SQLite search over the `emails` table.
 */
export function buildSearchFilterSql(
	parsed: ParsedSearchQuery,
	folderConstraint?: string,
): SqlWhereClause {
	const conditions: string[] = [];
	const params: (string | number)[] = [];

	// Folder constraint: explicit filter token takes precedence over parameter constraint
	const targetFolder = (parsed.folder || folderConstraint || "").toLowerCase();
	if (targetFolder && targetFolder !== "all") {
		if (targetFolder === "snoozed") {
			conditions.push("snoozed_until IS NOT NULL AND folder_id = 'inbox'");
		} else if (targetFolder === "scheduled") {
			conditions.push("scheduled_at IS NOT NULL AND folder_id = 'drafts'");
		} else if (targetFolder === "starred") {
			conditions.push("starred = 1 AND (folder_id IS NULL OR folder_id NOT IN ('trash', 'spam')) AND snoozed_until IS NULL AND scheduled_at IS NULL");
		} else {
			params.push(targetFolder);
			conditions.push(`folder_id = ?${params.length} AND snoozed_until IS NULL AND scheduled_at IS NULL`);
		}
	}

	if (parsed.from) {
		params.push(`%${parsed.from}%`);
		conditions.push(`sender LIKE ?${params.length}`);
	}

	if (parsed.to) {
		params.push(`%${parsed.to}%`);
		conditions.push(`recipient LIKE ?${params.length}`);
	}

	if (parsed.hasAttachment) {
		conditions.push(
			`EXISTS (SELECT 1 FROM attachments WHERE attachments.email_id = emails.id)`,
		);
	}

	if (parsed.isRead !== undefined) {
		params.push(parsed.isRead ? 1 : 0);
		conditions.push(`read = ?${params.length}`);
	}

	if (parsed.isStarred !== undefined) {
		params.push(parsed.isStarred ? 1 : 0);
		conditions.push(`starred = ?${params.length}`);
	}

	if (parsed.after) {
		params.push(parsed.after);
		conditions.push(`date >= ?${params.length}`);
	}

	if (parsed.before) {
		params.push(parsed.before);
		conditions.push(`date <= ?${params.length}`);
	}

	// Free text terms
	if (parsed.rawText) {
		params.push(`%${parsed.rawText}%`);
		const pIdx = params.length;
		conditions.push(
			`(subject LIKE ?${pIdx} OR sender LIKE ?${pIdx} OR recipient LIKE ?${pIdx} OR body LIKE ?${pIdx})`,
		);
	}

	const whereSql = conditions.length > 0 ? conditions.join(" AND ") : "1=1";
	return { whereSql, params };
}
