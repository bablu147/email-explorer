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
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2.5">
            <div 
              class="w-8 h-8 rounded-xl flex items-center justify-center"
              :class="mode === 'delete' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'"
            >
              <svg v-if="mode === 'delete'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 class="text-base font-bold text-gray-900 dark:text-white">
              {{ title }}
            </h3>
          </div>
          <button 
            type="button"
            @click="handleClose"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            title="Close modal"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Body / Content -->
        <form @submit.prevent="handleSubmit">
          <div v-if="mode === 'delete'" class="mb-5 text-sm text-gray-600 dark:text-gray-300">
            <p>
              Are you sure you want to delete custom folder 
              <span class="font-bold text-gray-900 dark:text-white">"{{ folder?.name }}"</span>?
            </p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Emails will remain safely preserved in your mailbox archive.
            </p>
          </div>

          <div v-else class="mb-5">
            <label for="folder-name-input" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Folder Name
            </label>
            <input 
              id="folder-name-input"
              ref="inputRef"
              v-model="nameInput"
              type="text"
              maxlength="50"
              placeholder="e.g. VIP Partners, Q4 Outreach, Bug Reports"
              class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border rounded-xl text-base sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              :class="validationError ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'"
            />
            <p v-if="validationError" class="text-xs text-red-500 mt-1 font-medium">
              {{ validationError }}
            </p>
          </div>

          <!-- Actions -->
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
              :disabled="loading || (mode !== 'delete' && !nameInput.trim())"
              class="px-4 py-2 text-xs font-bold rounded-xl text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :class="mode === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'"
            >
              <svg v-if="loading" class="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ submitButtonText }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { Folder } from "@/types";

const props = defineProps<{
	isOpen: boolean;
	mode: "create" | "rename" | "delete";
	folder?: Folder | null;
	loading?: boolean;
}>();

const emit = defineEmits<{
	(e: "close"): void;
	(e: "submit", payload: { mode: "create" | "rename" | "delete"; name?: string; folderId?: string }): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const nameInput = ref("");
const validationError = ref("");

const reservedNames = ["inbox", "sent", "trash", "archive", "spam", "draft", "drafts", "starred"];

const title = computed(() => {
	if (props.mode === "create") return "Create New Folder";
	if (props.mode === "rename") return "Rename Folder";
	return "Delete Folder";
});

const submitButtonText = computed(() => {
	if (props.mode === "create") return "Create Folder";
	if (props.mode === "rename") return "Save Changes";
	return "Delete Folder";
});

watch(
	() => props.isOpen,
	(open) => {
		if (open) {
			validationError.value = "";
			nameInput.value = props.mode === "rename" && props.folder ? props.folder.name : "";
			if (props.mode !== "delete") {
				nextTick(() => {
					inputRef.value?.focus();
					inputRef.value?.select();
				});
			}
		}
	},
);

const handleClose = () => {
	emit("close");
};

const handleSubmit = () => {
	if (props.mode === "delete") {
		if (props.folder) {
			emit("submit", { mode: "delete", folderId: props.folder.id });
		}
		return;
	}

	const trimmed = nameInput.value.trim();
	if (!trimmed) {
		validationError.value = "Folder name cannot be empty.";
		return;
	}

	if (reservedNames.includes(trimmed.toLowerCase())) {
		validationError.value = `"${trimmed}" is a reserved system folder name.`;
		return;
	}

	if (props.mode === "rename" && props.folder && trimmed === props.folder.name) {
		handleClose();
		return;
	}

	emit("submit", {
		mode: props.mode,
		name: trimmed,
		folderId: props.folder?.id,
	});
};
</script>
