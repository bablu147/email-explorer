import { ref } from "vue";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastAction {
	label: string;
	handler: () => void | Promise<void>;
}

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration?: number;
	action?: ToastAction;
}

const toasts = ref<Toast[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let seq = 0;

/** Max toasts on screen at once — older ones are dropped so the stack never covers the UI. */
const MAX_VISIBLE = 3;

export function useToast() {
	const removeToast = (id: string) => {
		const t = timers.get(id);
		if (t) {
			clearTimeout(t);
			timers.delete(id);
		}
		toasts.value = toasts.value.filter((toast) => toast.id !== id);
	};

	const addToast = (
		message: string,
		type: ToastType = "info",
		duration = 3000,
		action?: ToastAction,
	) => {
		// Monotonic id: Date.now() alone collides when several toasts fire in the same millisecond.
		const id = `${Date.now()}-${++seq}`;
		toasts.value.push({ id, message, type, duration, action });

		while (toasts.value.length > MAX_VISIBLE) {
			removeToast(toasts.value[0].id);
		}

		if (duration > 0) {
			timers.set(
				id,
				setTimeout(() => removeToast(id), duration),
			);
		}

		return id;
	};

	/**
	 * Toast with an "Undo" button (also triggered by the `z` shortcut while visible).
	 * The undo handler runs at most once.
	 */
	const undoable = (message: string, onUndo: () => void | Promise<void>, duration = 6000) => {
		let used = false;
		let id = "";
		id = addToast(message, "success", duration, {
			label: "Undo",
			handler: async () => {
				if (used) return;
				used = true;
				removeToast(id);
				await onUndo();
			},
		});
		return id;
	};

	/** Runs the action of the most recent toast that has one (used by the global `z` shortcut). */
	const triggerLatestAction = (): boolean => {
		for (let i = toasts.value.length - 1; i >= 0; i--) {
			const t = toasts.value[i];
			if (t.action) {
				void t.action.handler();
				return true;
			}
		}
		return false;
	};

	const success = (message: string, duration?: number) => addToast(message, "success", duration);
	const error = (message: string, duration?: number) => addToast(message, "error", duration ?? 5000);
	const info = (message: string, duration?: number) => addToast(message, "info", duration);
	const warning = (message: string, duration?: number) => addToast(message, "warning", duration ?? 4000);

	return {
		toasts,
		addToast,
		removeToast,
		undoable,
		triggerLatestAction,
		success,
		error,
		info,
		warning,
	};
}
