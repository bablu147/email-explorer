// Stands in for src/composables/useToast.ts: toasts are recorded instead of shown.
export const toasts: { type: string; message: string }[] = [];

const push = (type: string) => (message: string) => {
	toasts.push({ type, message });
	return String(toasts.length);
};

export const useToast = () => ({
	success: push("success"),
	error: push("error"),
	info: push("info"),
	addToast: (message: string, type: string) => push(type)(message),
	removeToast: () => {},
});
