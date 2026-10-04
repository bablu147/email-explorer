<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      @click.self="handleClose"
      @keydown.esc="handleClose"
    >
      <div
        class="w-full max-w-md bg-white dark:bg-gray-900 border-t sm:border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 transition-colors animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h3 id="change-password-title" class="text-base font-bold text-gray-900 dark:text-white">
              Change password
            </h3>
          </div>
          <button
            type="button"
            @click="handleClose"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form @submit.prevent="handleSubmit">
          <!-- For password managers: which account these passwords belong to -->
          <input type="text" autocomplete="username" :value="email" readonly hidden />

          <div class="space-y-3.5 mb-5">
            <div>
              <label for="change-password-current" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Current password
              </label>
              <input
                id="change-password-current"
                ref="currentInput"
                v-model="currentPassword"
                type="password"
                required
                autocomplete="current-password"
                class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div>
              <label for="change-password-new" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                New password
              </label>
              <input
                id="change-password-new"
                v-model="newPassword"
                type="password"
                required
                :minlength="PASSWORD_MIN"
                :maxlength="PASSWORD_MAX"
                autocomplete="new-password"
                aria-describedby="change-password-hint"
                class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <p id="change-password-hint" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {{ PASSWORD_MIN }} to {{ PASSWORD_MAX }} characters. Your other devices are signed out.
              </p>
            </div>
            <div>
              <label for="change-password-confirm" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm new password
              </label>
              <input
                id="change-password-confirm"
                v-model="confirmPassword"
                type="password"
                required
                :maxlength="PASSWORD_MAX"
                autocomplete="new-password"
                class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <p v-if="errorMessage" role="alert" class="text-xs text-red-600 dark:text-red-400 font-medium">
              {{ errorMessage }}
            </p>
          </div>

          <div class="flex items-center justify-end gap-2.5">
            <button
              type="button"
              @click="handleClose"
              class="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="px-4 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? "Saving..." : "Change password" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useToast } from "@/composables/useToast";
import api, { apiErrorMessage } from "@/services/api";

// The server's limits; it checks them again.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 256;

const props = defineProps<{
	isOpen: boolean;
	email?: string;
}>();

const emit = defineEmits<{
	(e: "close"): void;
}>();

const toast = useToast();

const currentInput = ref<HTMLInputElement | null>(null);
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const errorMessage = ref("");
const saving = ref(false);

watch(
	() => props.isOpen,
	(open) => {
		if (!open) return;
		currentPassword.value = "";
		newPassword.value = "";
		confirmPassword.value = "";
		errorMessage.value = "";
		nextTick(() => currentInput.value?.focus());
	},
);

const handleClose = () => {
	if (!saving.value) emit("close");
};

const handleSubmit = async () => {
	if (saving.value) return;
	if (newPassword.value.length < PASSWORD_MIN || newPassword.value.length > PASSWORD_MAX) {
		errorMessage.value = `The new password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`;
		return;
	}
	if (newPassword.value !== confirmPassword.value) {
		errorMessage.value = "The new password and its confirmation are not the same.";
		return;
	}
	errorMessage.value = "";
	saving.value = true;
	try {
		await api.changePassword(currentPassword.value, newPassword.value);
		toast.success("Password changed. Your other devices were signed out.");
		emit("close");
	} catch (err: any) {
		// The server's sentence: a wrong current password (400) or too many attempts (429).
		errorMessage.value = apiErrorMessage(err, "The password could not be changed. Try again.");
	} finally {
		saving.value = false;
	}
};
</script>
