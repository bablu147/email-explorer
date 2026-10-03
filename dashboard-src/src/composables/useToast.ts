import { computed, ref, watch } from "vue";

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
/** Auto-dismiss bookkeeping. `handle` is null while timers are paused. */
const timers = new Map<string, { handle: ReturnType<typeof setTimeout> | null; deadline: number; remaining: number }>();
let seq = 0;
/** Pause requests (hover / focus / expanded overflow). Timers only run while this is 0. */
let pauseDepth = 0;

/**
 * Max toasts rendered at once so the stack never covers the UI. Toasts beyond this stay alive (and their
 * Undo stays reachable via `z` or the "more" expander in Toast.vue) until they time out.
 */
export const MAX_VISIBLE = 3;
/** Hard ceiling on retained toasts (only reachable with pathological bursts). */
const MAX_RETAINED = 25;

/** User expanded the collapsed overflow ("N more") to see every live toast. */
export const toastsExpanded = ref(false);
watch(
	() => toasts.value.length,
	(n) => {
		if (n <= MAX_VISIBLE) toastsExpanded.value = false;
	},
);

/** Toasts currently rendered (newest last). */
export const visibleToasts = computed(() =>
	toastsExpanded.value ? toasts.value : toasts.value.slice(-MAX_VISIBLE),
);
/** Toasts alive but collapsed behind the "N more" row. */
export const hiddenToastCount = computed(() => toasts.value.length - visibleToasts.value.length);

/** How many toast rows are on screen (including the "N more" row) — used to lay out around them. */
export const visibleToastRows = computed(
	() => visibleToasts.value.length + (toasts.value.length > MAX_VISIBLE ? 1 : 0),
);

const removeToast = (id: string) => {
	const t = timers.get(id);
	if (t) {
		if (t.handle) clearTimeout(t.handle);
		timers.delete(id);
	}
	toasts.value = toasts.value.filter((toast) => toast.id !== id);
};

const arm = (id: string, ms: number) => {
	const t = { handle: null as ReturnType<typeof setTimeout> | null, deadline: Date.now() + ms, remaining: ms };
	if (pauseDepth === 0) t.handle = setTimeout(() => removeToast(id), ms);
	timers.set(id, t);
};

/** Freeze auto-dismiss (e.g. while the pointer is over the stack, so an Undo can't vanish under the cursor). */
const pauseTimers = () => {
	if (pauseDepth++ > 0) return;
	const now = Date.now();
	for (const t of timers.values()) {
		if (t.handle) clearTimeout(t.handle);
		t.handle = null;
		t.remaining = Math.max(0, t.deadline - now);
	}
};
const resumeTimers = () => {
	if (pauseDepth === 0 || --pauseDepth > 0) return;
	const now = Date.now();
	for (const [id, t] of timers) {
		// Give at least a moment to read after the pointer leaves.
		const ms = Math.max(t.remaining, 1200);
		t.deadline = now + ms;
		t.handle = setTimeout(() => removeToast(id), ms);
	}
};

export function useToast() {
	const addToast = (
		message: string,
		type: ToastType = "info",
		duration = 3000,
		action?: ToastAction,
	) => {
		// Monotonic id: Date.now() alone collides when several toasts fire in the same millisecond.
		const id = `${Date.now()}-${++seq}`;
		toasts.value.push({ id, message, type, duration, action });

		// Over the visible budget: drop the oldest *plain* notifications first. Toasts with an action
		// (Undo) are never evicted by newer toasts — rapid archiving must not push an Undo out of reach;
		// extra ones collapse behind a "N more" row instead.
		while (toasts.value.length > MAX_VISIBLE) {
			const plain = toasts.value.find((t) => !t.action && t.id !== id);
			if (!plain) break;
			removeToast(plain.id);
		}
		while (toasts.value.length > MAX_RETAINED) {
			removeToast(toasts.value[0].id);
		}

		if (duration > 0) arm(id, duration);

		return id;
	};

	/**
	 * Toast with an "Undo" button (also triggered by the `z` shortcut while alive).
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

	/**
	 * Runs the action of the most recent toast that has one (used by the global `z` shortcut).
	 * Repeated presses walk back through older undoable actions, including collapsed ones.
	 */
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
		pauseTimers,
		resumeTimers,
		success,
		error,
		info,
		warning,
	};
}
