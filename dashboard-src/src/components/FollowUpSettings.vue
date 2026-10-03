<template>
  <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
    <div class="flex items-start justify-between gap-4 mb-3">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-base font-bold text-gray-900 dark:text-white">Automatic follow-ups</h2>
          <span
            class="px-2 py-0.5 text-[10px] font-bold rounded-full border"
            :class="config?.enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'"
          >
            {{ config?.enabled ? 'On' : 'Off' }}
          </span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          When someone you cold-emailed hasn't answered, a follow-up is prepared as a draft and you get a notification.
          Nothing is ever sent without you opening and sending it.
        </p>
      </div>
      <label v-if="isAdmin && config" class="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          :checked="config.enabled"
          :disabled="saving"
          @change="toggle"
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-600 peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
      </label>
      <span
        v-else-if="config"
        class="shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20"
      >
        Admin only
      </span>
    </div>

    <p v-if="loadFailed" class="text-xs text-rose-600 dark:text-rose-400">Could not load follow-up settings.</p>

    <div v-if="config" class="space-y-3">
      <!-- Catch-up choice, only relevant while turning it on -->
      <div v-if="isAdmin && !config.enabled" class="flex flex-wrap items-center gap-2 text-xs">
        <label for="catchup" class="text-gray-600 dark:text-gray-400">When turned on, also follow up outreach from the last</label>
        <select
          id="catchup"
          v-model.number="catchUpDays"
          class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-800 dark:text-gray-200"
        >
          <option :value="0">0 days (only new outreach)</option>
          <option :value="7">7 days</option>
          <option :value="14">14 days</option>
          <option :value="30">30 days</option>
        </select>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Wait before following up</label>
          <select
            :value="config.delay_days"
            :disabled="!isAdmin || saving"
            @change="update({ delay_days: Number(($event.target as HTMLSelectElement).value) })"
            class="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white disabled:opacity-60"
          >
            <option v-for="d in [1, 2, 3, 5, 7, 14]" :key="d" :value="d">{{ d }} {{ d === 1 ? 'day' : 'days' }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Follow-ups per person</label>
          <select
            :value="config.max_followups"
            :disabled="!isAdmin || saving"
            @change="update({ max_followups: Number(($event.target as HTMLSelectElement).value) })"
            class="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white disabled:opacity-60"
          >
            <option v-for="n in [1, 2, 3]" :key="n" :value="n">Up to {{ n }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Message</label>
          <select
            :value="config.template_id"
            :disabled="!isAdmin || saving"
            @change="update({ template_id: ($event.target as HTMLSelectElement).value })"
            class="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white disabled:opacity-60"
          >
            <option v-for="t in templates.replies" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
      </div>
      <p class="text-[11px] text-gray-500 dark:text-gray-400">
        Edit the wording under Templates above. Fields:
        <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700" v-text="'{{first_name}}'"></code>
        <code class="ml-1 px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700" v-text="'{{app_name}}'"></code>
        <code class="ml-1 px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700" v-text="'{{original_subject}}'"></code>.
        People who replied, bounced or unsubscribed are always skipped.
      </p>

      <p v-if="config.last_run" class="text-[11px] text-gray-400">
        Last check {{ new Date(config.last_run.at).toLocaleString() }}: {{ config.last_run.drafts }}
        {{ config.last_run.drafts === 1 ? 'draft' : 'drafts' }} prepared. Checks run every few hours.
      </p>

      <div v-if="isAdmin" class="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          :disabled="previewing"
          @click="preview"
          class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 disabled:opacity-50 transition-all cursor-pointer"
        >
          {{ previewing ? 'Checking...' : 'Preview who is due' }}
        </button>
        <button
          v-if="config.enabled"
          type="button"
          :disabled="running"
          @click="runNow"
          class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all cursor-pointer"
        >
          {{ running ? 'Preparing...' : 'Prepare drafts now' }}
        </button>
      </div>

      <ul v-if="previewList" class="mt-1 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700/60 max-h-56 overflow-y-auto">
        <li v-if="previewList.length === 0" class="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
          Nobody is due for a follow-up right now.
        </li>
        <li v-for="d in previewList" :key="d.mailbox + d.recipient" class="px-3 py-2">
          <div class="text-xs font-semibold text-gray-900 dark:text-white truncate">{{ d.recipient }}</div>
          <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">{{ d.subject }}</div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useTemplatesStore } from "@/stores/templates";

interface Config {
	enabled: boolean;
	delay_days: number;
	max_followups: number;
	template_id: string;
	enabled_at: string | null;
	last_run: { at: string; drafts: number } | null;
}
interface DueItem {
	mailbox: string;
	recipient: string;
	subject: string;
}

const templates = useTemplatesStore();
const { isAdmin } = storeToRefs(useAuthStore());
const { success: showSuccessToast, error: showErrorToast } = useToast();

const config = ref<Config | null>(null);
const loadFailed = ref(false);
const saving = ref(false);
const catchUpDays = ref(7);
const previewing = ref(false);
const running = ref(false);
const previewList = ref<DueItem[] | null>(null);

const message = (err: any, fallback: string) => err?.response?.data?.error || fallback;

const refresh = async () => {
	const res = await api.getFollowUpConfig();
	config.value = res.data.config;
};

const update = async (patch: Record<string, unknown>) => {
	saving.value = true;
	try {
		const res = await api.setFollowUpConfig(patch);
		config.value = res.data.config;
		previewList.value = null;
	} catch (err) {
		showErrorToast(message(err, "Could not save that change."));
		await refresh().catch(() => {});
	} finally {
		saving.value = false;
	}
};

const toggle = async (e: Event) => {
	const enabled = (e.target as HTMLInputElement).checked;
	await update(enabled ? { enabled, catch_up_days: catchUpDays.value } : { enabled });
	showSuccessToast(enabled ? "Follow-ups turned on." : "Follow-ups turned off.");
};

const preview = async () => {
	previewing.value = true;
	try {
		const res = await api.runFollowUps(true);
		previewList.value = res.data.details || [];
	} catch (err) {
		showErrorToast(message(err, "Could not check who is due."));
	} finally {
		previewing.value = false;
	}
};

const runNow = async () => {
	running.value = true;
	try {
		const res = await api.runFollowUps(false);
		previewList.value = null;
		showSuccessToast(
			res.data.drafts === 0
				? "Nobody is due right now."
				: `${res.data.drafts} follow-up ${res.data.drafts === 1 ? "draft" : "drafts"} ready in Drafts.`,
		);
		await refresh();
	} catch (err) {
		showErrorToast(message(err, "Could not prepare drafts."));
	} finally {
		running.value = false;
	}
};

onMounted(async () => {
	try {
		await Promise.all([refresh(), templates.load()]);
	} catch {
		loadFailed.value = true;
	}
});
</script>
