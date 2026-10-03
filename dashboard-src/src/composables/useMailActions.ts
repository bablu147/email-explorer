import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import type { Email } from "@/types";
import { settleAll } from "@/utils/concurrency";

/** Folders that are "virtual" views rather than a real folder_id an email can live in. */
const VIRTUAL_FOLDERS = new Set(["starred", "snoozed", "scheduled"]);

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/**
 * Shared, safe mail actions used by the list, reading pane and full-screen reader.
 *
 * - Every move (archive / trash / restore / move-to-folder) is optimistic and offers Undo (button or `z`).
 * - "Delete" means *move to Trash*. Permanent deletion is only exposed from inside Trash, behind a confirm.
 * - Bulk operations run with bounded concurrency and report partial failures instead of silently stopping.
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

		const removal = staysVisible ? null : emailStore.removeLocal(rows.map((e) => e.id));

		const results = await settleAll(rows, (e) => api.moveEmail(mailboxId, e.id, target));
		removal?.settle();
		const moved = rows.filter((_, i) => results[i].status === "fulfilled");
		const failed = rows.filter((_, i) => results[i].status === "rejected");

		if (failed.length > 0) {
			if (!staysVisible && emailStore.listKey === listKeyAtAction) emailStore.restoreLocal(failed, { settled: true });
			toast.error(
				moved.length === 0
					? `Couldn't move ${failed.length === 1 ? "conversation" : "conversations"} to ${folderLabel(target)}`
					: `${failed.length} of ${rows.length} ${plural(rows.length, "conversation")} couldn't be moved`,
			);
		}

		if (moved.length > 0) {
			toast.undoable(doneMessage(moved.length, target), async () => {
				const restore =
					!staysVisible && emailStore.listKey === listKeyAtAction ? emailStore.restoreLocal(moved) : null;
				const back = await settleAll(moved, (e) => api.moveEmail(mailboxId, e.id, origins.get(e.id) || "inbox"));
				restore?.settle();
				const backFailed = moved.filter((_, i) => back[i].status === "rejected");
				if (backFailed.length > 0) {
					if (emailStore.listKey === listKeyAtAction) {
						emailStore.removeLocal(backFailed.map((e) => e.id), { settled: true });
					}
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
		emailStore.removeLocal(deleted.map((e) => e.id), { settled: true });
		if (deleted.length > 0) {
			toast.success(
				`${deleted.length === 1 ? "Conversation" : `${deleted.length} conversations`} permanently deleted`,
			);
		}
		if (failedCount > 0) toast.error(`${failedCount} ${plural(failedCount, "conversation")} couldn't be deleted`);
		folderStore.fetchFolders(mailboxId);
		return deleted.map((e) => e.id);
	};

	/**
	 * Bulk-safe read/star: every row flips at once (optimistic), requests go out with bounded concurrency,
	 * and failures roll back only the rows that failed.
	 */
	const setRead = async (mailboxId: string, emails: Email[], read: boolean) => {
		const rows = emails.filter((e) => e && e.read !== read);
		if (!mailboxId || rows.length === 0) return;
		const failed = await emailStore.patchFlagsMany(mailboxId, rows.map((e) => e.id), { read });
		if (failed.length > 0) {
			toast.error(
				rows.length === 1
					? `Couldn't mark as ${read ? "read" : "unread"}`
					: `${failed.length} of ${rows.length} conversations couldn't be marked as ${read ? "read" : "unread"}`,
			);
		}
		folderStore.fetchFolders(mailboxId);
	};

	const setStarred = async (mailboxId: string, emails: Email[], starred: boolean) => {
		const rows = emails.filter((e) => e && e.starred !== starred);
		if (!mailboxId || rows.length === 0) return;
		const failed = await emailStore.patchFlagsMany(mailboxId, rows.map((e) => e.id), { starred });
		if (failed.length > 0) {
			toast.error(
				rows.length === 1
					? `Couldn't ${starred ? "star" : "unstar"}`
					: `${failed.length} of ${rows.length} conversations couldn't be ${starred ? "starred" : "unstarred"}`,
			);
		}
	};

	/**
	 * Snooze emails until a given ISO time with optimistic removal and Undo.
	 */
	const snoozeEmails = async (
		mailboxId: string,
		emails: Email[],
		untilIso: string,
	): Promise<string[]> => {
		const rows = emails.filter(Boolean);
		if (!mailboxId || rows.length === 0) return [];

		const listKeyAtAction = emailStore.listKey;
		const removal = emailStore.removeLocal(rows.map((e) => e.id));

		const results = await settleAll(rows, (e) => api.snoozeEmail(mailboxId, e.id, untilIso));
		removal?.settle();
		const snoozed = rows.filter((_, i) => results[i].status === "fulfilled");
		const failed = rows.filter((_, i) => results[i].status === "rejected");

		if (failed.length > 0) {
			if (emailStore.listKey === listKeyAtAction) emailStore.restoreLocal(failed, { settled: true });
			toast.error(`Couldn't snooze ${failed.length === 1 ? "conversation" : "conversations"}`);
		}

		if (snoozed.length > 0) {
			toast.undoable(`${snoozed.length === 1 ? "Conversation" : `${snoozed.length} conversations`} snoozed`, async () => {
				const restore = emailStore.listKey === listKeyAtAction ? emailStore.restoreLocal(snoozed) : null;
				await settleAll(snoozed, (e) => api.snoozeEmail(mailboxId, e.id, null));
				restore?.settle();
				toast.info("Snooze cancelled", 2000);
				folderStore.fetchFolders(mailboxId);
			});
		}

		folderStore.fetchFolders(mailboxId);
		return snoozed.map((e) => e.id);
	};

	/**
	 * Unsnooze emails (bring back to inbox immediately).
	 */
	const unsnoozeEmails = async (
		mailboxId: string,
		emails: Email[],
	): Promise<string[]> => {
		const rows = emails.filter(Boolean);
		if (!mailboxId || rows.length === 0) return [];
		const listKeyAtAction = emailStore.listKey;
		const removal = emailStore.removeLocal(rows.map((e) => e.id));
		await settleAll(rows, (e) => api.snoozeEmail(mailboxId, e.id, null));
		removal?.settle();
		toast.info(`${rows.length === 1 ? "Conversation" : `${rows.length} conversations`} moved to Inbox`, 2000);
		folderStore.fetchFolders(mailboxId);
		return rows.map((e) => e.id);
	};

	return { moveEmails, trashEmails, deleteForever, snoozeEmails, unsnoozeEmails, setRead, setStarred, folderLabel };
}
