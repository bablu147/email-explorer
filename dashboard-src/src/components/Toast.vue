<template>
  <div
    class="toast-region fixed z-[70] flex flex-col gap-2 pointer-events-none left-3 right-3 sm:left-6 sm:right-auto sm:w-[380px]"
    aria-live="polite"
    aria-atomic="false"
  >
    <transition-group name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-3 pl-3.5 pr-2 py-2.5 rounded-xl shadow-2xl border bg-gray-900 text-white border-gray-800 dark:bg-gray-800 dark:border-gray-700"
        :role="toast.type === 'error' ? 'alert' : 'status'"
      >
        <!-- Type icon -->
        <span class="flex-shrink-0" :class="iconColor(toast.type)">
          <svg v-if="toast.type === 'success'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else-if="toast.type === 'error'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else-if="toast.type === 'warning'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>

        <span class="flex-1 min-w-0 text-[13px] font-medium leading-snug break-words">{{ toast.message }}</span>

        <!-- Optional action (e.g. Undo) -->
        <button
          v-if="toast.action"
          type="button"
          @click="toast.action.handler()"
          class="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold text-emerald-300 hover:text-emerald-200 hover:bg-white/10 transition-colors cursor-pointer"
        >
          {{ toast.action.label }}
          <kbd
            v-if="toast.action.label === 'Undo'"
            class="hidden sm:inline px-1 py-px rounded border border-white/20 text-[10px] font-mono text-gray-300"
          >Z</kbd>
        </button>

        <button
          type="button"
          @click="removeToast(toast.id)"
          class="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Dismiss notification"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useToast, type ToastType } from "@/composables/useToast";

const { toasts, removeToast, triggerLatestAction } = useToast();

const iconColor = (type: ToastType) => {
	switch (type) {
		case "success":
			return "text-emerald-400";
		case "error":
			return "text-red-400";
		case "warning":
			return "text-amber-400";
		default:
			return "text-sky-400";
	}
};

// Global `z` = undo the most recent undoable action (Superhuman / Gmail convention).
const onKeyDown = (e: KeyboardEvent) => {
	if (e.key !== "z" && e.key !== "Z") return;
	if (e.metaKey || e.ctrlKey || e.altKey) return;
	const el = document.activeElement as HTMLElement | null;
	const tag = el?.tagName?.toLowerCase();
	if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
	if (triggerLatestAction()) {
		e.preventDefault();
		e.stopImmediatePropagation();
	}
};

onMounted(() => window.addEventListener("keydown", onKeyDown, true));
onUnmounted(() => window.removeEventListener("keydown", onKeyDown, true));
</script>

<style scoped>
/* Sit above the mobile bottom nav (+ safe area); plain bottom inset on larger screens. */
.toast-region {
  bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
}
@media (min-width: 640px) {
  .toast-region {
    bottom: 1.5rem;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
.toast-move {
  transition: transform 0.18s ease;
}
</style>
