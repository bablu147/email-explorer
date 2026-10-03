import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import type { Email } from "@/types";

/** Folders that are "virtual" views rather than a real folder_id an email can live in. */
const VIRTUAL_FOLDERS = new Set(["starred"]);

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** Like Promise.allSettled, but at most `limit` requests in flight (bulk actions on hundreds of rows). */
async function settleAll<T>(
	items: T[],
	fn: (item: T) => Promise<unknown>,
	limit = 6,
): Promise<PromiseSettledResult<unknown>[]> {
	const results: PromiseSettledResult<unknown>[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			try {
				results[i] = { status: "fulfilled", value: await fn(items[i]) };
			} catch (reason) {
				results[i] = { status: "rejected", reason };
			}
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

/**
 * Shared, safe mail actions used by the list, reading pane and full-screen reader.
 *
 * - Every move (archive / trash / restore / move-to-folder) is optimistic and offers Undo (button or `z`).
 * - "Delete" means *move to Trash*. Permanent deletion is only exposed from inside Trash, behind a confirm.
 * - Bulk operations run in parallel and report partial failures instead of silently stopping.
 */
export function useMailActions() {
	const emailStore = useEmailStore();
	const folderStore = useFolderStore();
	const toast = useToast();

	const folderLabel = (folderId: string): string => {
		switch (folderId) {
			case "archive":
				return "Archive";
			case "trash":
				return "Trash";
			case "inbox":
				return "Inbox";
			case "spam":
				return "Spam";
			default:
				return folderStore.folders.find((f) => f.id === folderId)?.name || folderId;
		}
	};

	const doneMessage = (count: number, target: string) => {
		const noun = `${count === 1 ? "Conversation" : `${count} conversations`}`;
		if (target === "archive") return `${noun} archived`;
		if (target === "trash") return `${noun} moved to Trash`;
		return `${noun} moved to ${folderLabel(target)}`;
	};

	/** Where Undo should put a message back. */
	const originalFolderOf = (email: Email, fromFolder: string) =>
		email.folder_id || (VIRTUAL_FOLDERS.has(fromFolder) ? "inbox" : fromFolder) || "inbox";

	/**
	 * Move messages to `target` with optimistic UI + Undo.
	 * Returns the ids that were successfully moved.
	 */
	const moveEmails = async (
		mailboxId: string,
		emails: Email[],
		target: string,
		fromFolder: string,
	): Promise<string[]> => {
		const rows = emails.filter(Boolean);
		if (!mailboxId || rows.length === 0) return [];

		// In the virtual Starred view, archiving/moving keeps the star, so the row stays visible there.
		const staysVisible = fromFolder === "starred" && target !== "trash" && target !== "spam";
		const listKeyAtAction = emailStore.listKey;
		const origins = new Map(rows.map((e) => [e.id, originalFolderOf(e, fromFolder)]));

		if (!staysVisible) emailStore.removeLocal(rows.map((e) => e.id));

		const results = await settleAll(rows, (e) => api.moveEmail(mailboxId, e.id, target));
		emailStore.noteMutation();
		const moved = rows.filter((_, i) => results[i].status === "fulfilled");
		const failed = rows.filter((_, i) => results[i].status === "rejected");

		if (failed.length > 0) {
			if (!staysVisible && emailStore.listKey === listKeyAtAction) emailStore.restoreLocal(failed);
			toast.error(
				moved.length === 0
					? `Couldn't move ${failed.length === 1 ? "conversation" : "conversations"} to ${folderLabel(target)}`
					: `${failed.length} of ${rows.length} ${plural(rows.length, "conversation")} couldn't be moved`,
			);
		}

		if (moved.length > 0) {
			toast.undoable(doneMessage(moved.length, target), async () => {
				if (!staysVisible && emailStore.listKey === listKeyAtAction) emailStore.restoreLocal(moved);
				const back = await settleAll(moved, (e) => api.moveEmail(mailboxId, e.id, origins.get(e.id) || "inbox"));
				emailStore.noteMutation();
				const backFailed = moved.filter((_, i) => back[i].status === "rejected");
				if (backFailed.length > 0) {
					if (emailStore.listKey === listKeyAtAction) emailStore.removeLocal(backFailed.map((e) => e.id));
					toast.error("Undo failed for some conversations");
				} else {
					toast.info(`${moved.length === 1 ? "Conversation" : `${moved.length} conversations`} restored`, 2500);
				}
				folderStore.fetchFolders(mailboxId);
			});
		}

		folderStore.fetchFolders(mailboxId);
		return moved.map((e) => e.id);
	};

	/** "Delete" = move to Trash (recoverable). */
	const trashEmails = (mailboxId: string, emails: Email[], fromFolder: string) =>
		moveEmails(mailboxId, emails, "trash", fromFolder);

	/** Permanently delete (only from Trash; callers must confirm first). Returns ids that were deleted. */
	const deleteForever = async (mailboxId: string, emails: Email[]): Promise<string[]> => {
		const rows = emails.filter(Boolean);
		if (!mailboxId || rows.length === 0) return [];
		const results = await settleAll(rows, (e) => api.deleteEmail(mailboxId, e.id));
		const deleted = rows.filter((_, i) => results[i].status === "fulfilled");
		const failedCount = rows.length - deleted.length;
		emailStore.removeLocal(deleted.map((e) => e.id));
		if (deleted.length > 0) {
			toast.success(
				`${deleted.length === 1 ? "Conversation" : `${deleted.length} conversations`} permanently deleted`,
			);
		}
		if (failedCount > 0) toast.error(`${failedCount} ${plural(failedCount, "conversation")} couldn't be deleted`);
		folderStore.fetchFolders(mailboxId);
		return deleted.map((e) => e.id);
	};

	const setRead = async (mailboxId: string, emails: Email[], read: boolean) => {
		const rows = emails.filter((e) => e && e.read !== read);
		if (rows.length === 0) return;
		const results = await Promise.allSettled(rows.map((e) => emailStore.patchFlags(mailboxId, e.id, { read })));
		if (results.some((r) => r.status === "rejected")) toast.error(`Couldn't mark as ${read ? "read" : "unread"}`);
		folderStore.fetchFolders(mailboxId);
	};

	const setStarred = async (mailboxId: string, emails: Email[], starred: boolean) => {
		const rows = emails.filter((e) => e && e.starred !== starred);
		if (rows.length === 0) return;
		const results = await Promise.allSettled(
			rows.map((e) => emailStore.patchFlags(mailboxId, e.id, { starred })),
		);
		if (results.some((r) => r.status === "rejected")) toast.error(`Couldn't ${starred ? "star" : "unstar"}`);
	};

	return { moveEmails, trashEmails, deleteForever, setRead, setStarred, folderLabel };
}
