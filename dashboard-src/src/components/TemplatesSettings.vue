<template>
  <div class="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-6">
    <div>
      <h2 class="text-base font-bold text-gray-900 dark:text-white">Templates</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        Shared with the whole team. Merge fields such as
        <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[11px]" v-text="'{{first_name}}'"></code>
        are filled in when you use a template.
      </p>
    </div>

    <p v-if="loadFailed" class="text-xs text-rose-600 dark:text-rose-400">Could not load templates.</p>

    <!-- Outreach pitch -->
    <div v-if="store.pitch" class="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-sm font-bold text-gray-900 dark:text-white">Outreach pitch</h3>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Used by the Pitch button on Discover. Fields:
            <code v-for="f in PITCH_FIELDS" :key="f" class="mr-1 px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700" v-text="`{{${f}}}`"></code>
          </p>
        </div>
        <span
          v-if="!isAdmin"
          class="shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20"
        >
          Admin only
        </span>
      </div>

      <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Subject</label>
      <input
        v-model="pitchSubject"
        type="text"
        :disabled="!isAdmin"
        class="w-full mb-3 px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
      />

      <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Body</label>
      <div :class="{ 'pointer-events-none opacity-60': !isAdmin }">
        <RichTextEditor :key="pitchEditorKey" v-model="pitchBody" />
      </div>

      <div v-if="isAdmin" class="flex items-center justify-end gap-2 mt-3">
        <button
          type="button"
          :disabled="busy"
          @click="resetPitch"
          class="px-3 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          Reset to default
        </button>
        <button
          type="button"
          :disabled="busy || !pitchDirty"
          @click="savePitch"
          class="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all cursor-pointer"
        >
          Save pitch
        </button>
      </div>
    </div>

    <!-- Reply templates -->
    <div class="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 class="text-sm font-bold text-gray-900 dark:text-white">Reply templates</h3>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Appear in the "Insert template" menu when replying. Field:
            <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700" v-text="'{{first_name}}'"></code>
          </p>
        </div>
        <button
          type="button"
          @click="startNew"
          class="shrink-0 px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-all cursor-pointer"
        >
          New template
        </button>
      </div>

      <div v-if="editing" class="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
        <input
          v-model="draftName"
          type="text"
          placeholder="Template name"
          maxlength="120"
          class="w-full mb-2 px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
        <textarea
          v-model="draftBody"
          rows="8"
          placeholder="Write the reply. Use {{first_name}} for the recipient's first name."
          class="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        ></textarea>
        <div class="flex justify-end gap-2 mt-2">
          <button
            type="button"
            @click="cancelEdit"
            class="px-3 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="busy || !draftName.trim() || !draftBody.trim()"
            @click="saveReply"
            class="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all cursor-pointer"
          >
            {{ editing === 'new' ? 'Create' : 'Save' }}
          </button>
        </div>
      </div>

      <p v-if="store.replies.length === 0 && !editing" class="text-xs text-gray-400 py-2">
        No reply templates yet.
      </p>
      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700/60">
        <li v-for="t in store.replies" :key="t.id" class="flex items-center gap-3 py-2.5">
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold text-gray-900 dark:text-white truncate">{{ t.name }}</div>
            <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">{{ preview(t.body) }}</div>
          </div>
          <button
            type="button"
            @click="startEdit(t)"
            class="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Edit
          </button>
          <button
            type="button"
            :aria-label="`Delete ${t.name}`"
            @click="removeReply(t)"
            class="shrink-0 p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, watch } from "vue";
import RichTextEditor from "@/components/RichTextEditor.vue";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/stores/auth";
import { type MailTemplate, useTemplatesStore } from "@/stores/templates";

const PITCH_FIELDS = ["app_name", "developer_name", "platform", "category", "installs", "traction"];

const store = useTemplatesStore();
const { isAdmin } = storeToRefs(useAuthStore());
const { success: showSuccessToast, error: showErrorToast } = useToast();

const busy = ref(false);
const loadFailed = ref(false);

// Pitch editor
const pitchSubject = ref("");
const pitchBody = ref("");
const pitchEditorKey = ref(0);
const pitchDirty = computed(
	() =>
		!!store.pitch &&
		(pitchSubject.value !== (store.pitch.subject || "") || pitchBody.value !== store.pitch.body),
);

const syncPitch = () => {
	pitchSubject.value = store.pitch?.subject || "";
	pitchBody.value = store.pitch?.body || "";
	pitchEditorKey.value++; // remount the editor so it shows the new content
};

let pitchSynced = false;
watch(
	() => store.pitch,
	(p) => {
		if (p && !pitchSynced) {
			pitchSynced = true;
			syncPitch();
		}
	},
	{ immediate: true },
);

const errorMessage = (err: any, fallback: string) => err?.response?.data?.error || fallback;

const savePitch = async () => {
	if (!store.pitch) return;
	busy.value = true;
	try {
		await store.update(store.pitch.id, {
			name: store.pitch.name,
			subject: pitchSubject.value,
			body: pitchBody.value,
		});
		showSuccessToast("Pitch saved.");
	} catch (err) {
		showErrorToast(errorMessage(err, "Could not save the pitch."));
	} finally {
		busy.value = false;
	}
};

const resetPitch = async () => {
	if (!window.confirm("Replace the pitch with the built-in default? Your edits will be lost.")) return;
	busy.value = true;
	try {
		await store.resetPitch();
		syncPitch();
		showSuccessToast("Pitch reset to default.");
	} catch (err) {
		showErrorToast(errorMessage(err, "Could not reset the pitch."));
	} finally {
		busy.value = false;
	}
};

// Reply templates
const editing = ref<"new" | string | null>(null);
const draftName = ref("");
const draftBody = ref("");

const preview = (body: string) => body.replace(/\s+/g, " ").trim().slice(0, 110);

const startNew = () => {
	editing.value = "new";
	draftName.value = "";
	draftBody.value = "";
};
const startEdit = (t: MailTemplate) => {
	editing.value = t.id;
	draftName.value = t.name;
	draftBody.value = t.body;
};
const cancelEdit = () => {
	editing.value = null;
};

const saveReply = async () => {
	busy.value = true;
	try {
		if (editing.value === "new") {
			await store.createReply(draftName.value, draftBody.value);
		} else if (editing.value) {
			await store.update(editing.value, { name: draftName.value, body: draftBody.value });
		}
		editing.value = null;
		showSuccessToast("Template saved.");
	} catch (err) {
		showErrorToast(errorMessage(err, "Could not save the template."));
	} finally {
		busy.value = false;
	}
};

const removeReply = async (t: MailTemplate) => {
	if (!window.confirm(`Delete the template "${t.name}"?`)) return;
	try {
		await store.remove(t.id);
		if (editing.value === t.id) editing.value = null;
		showSuccessToast("Template deleted.");
	} catch (err) {
		showErrorToast(errorMessage(err, "Could not delete the template."));
	}
};

onMounted(async () => {
	try {
		await store.load(true);
	} catch {
		loadFailed.value = true;
	}
});
</script>
