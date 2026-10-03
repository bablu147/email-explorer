<template>
  <div class="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 overflow-y-auto">
    <!-- Header -->
    <div class="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-lg sm:text-xl font-extrabold tracking-tight">Outreach pipeline</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Everyone you cold-emailed from this mailbox, and how far they got. Conversations you replied to are not listed.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <select
            v-model.number="days"
            @change="load"
            class="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
            aria-label="Time range"
          >
            <option :value="30">Last 30 days</option>
            <option :value="90">Last 90 days</option>
            <option :value="180">Last 180 days</option>
          </select>
          <button
            type="button"
            @click="load"
            :disabled="loading"
            class="px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-50 transition-all cursor-pointer"
          >
            {{ loading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Funnel numbers -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
        <div v-for="card in cards" :key="card.label" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5">
          <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{{ card.label }}</div>
          <div class="text-lg font-extrabold tabular-nums">{{ card.value }}</div>
          <div class="text-[11px] text-gray-400">{{ card.hint }}</div>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="m-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
      {{ errorMessage }}
    </div>

    <div v-else-if="!loading && chains.length === 0" class="flex-1 flex flex-col items-center justify-center text-center p-10 text-gray-500 dark:text-gray-400">
      <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">No outreach in this period</p>
      <p class="text-xs mt-1 max-w-sm">New messages you send (for example from Discover) show up here and move across as people open, click and reply.</p>
    </div>

    <template v-else>
      <!-- Phones: pick a stage -->
      <div class="md:hidden px-4 pt-3 flex gap-1.5 overflow-x-auto">
        <button
          v-for="col in columns"
          :key="col.stage"
          type="button"
          @click="mobileStage = col.stage"
          class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer"
          :class="mobileStage === col.stage ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'"
        >
          {{ col.label }} {{ byStage[col.stage].length }}
        </button>
      </div>

      <!-- Board -->
      <div class="flex-1 p-4 grid gap-3 md:grid-cols-4 items-start">
        <section
          v-for="col in columns"
          :key="col.stage"
          class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-900/60 min-w-0"
          :class="mobileStage === col.stage ? '' : 'hidden md:block'"
        >
          <header class="flex items-center justify-between px-3 py-2.5">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" :class="col.dot"></span>
              <h2 class="text-xs font-bold">{{ col.label }}</h2>
            </div>
            <span class="text-[11px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">{{ byStage[col.stage].length }}</span>
          </header>
          <ul class="px-2 pb-2 space-y-2">
            <li v-if="byStage[col.stage].length === 0" class="px-2 py-4 text-center text-[11px] text-gray-400">Nobody here</li>
            <li v-for="c in byStage[col.stage]" :key="c.recipient">
              <button
                type="button"
                @click="openChain(c)"
                class="w-full text-left rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-xs font-semibold truncate">{{ c.recipient }}</span>
                  <AppBadge :email="c.recipient" />
                </div>
                <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{{ c.start_subject || '(No subject)' }}</div>
                <div class="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] font-semibold">
                  <span class="text-gray-400">{{ timeAgo(c.last_date) }}</span>
                  <span v-if="c.sent_count > 1" class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {{ c.sent_count }} messages
                  </span>
                  <span v-if="c.pending_draft_id" class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Follow-up draft ready
                  </span>
                  <span v-if="c.suppressed === 'unsubscribe'" class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Unsubscribed
                  </span>
                  <span v-else-if="c.suppressed === 'manual'" class="px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
                    Do not contact
                  </span>
                  <span v-if="c.replied_at" class="text-emerald-600 dark:text-emerald-400">Replied {{ timeAgo(c.replied_at) }}</span>
                </div>
              </button>
            </li>
          </ul>
        </section>
      </div>

      <!-- Bounced -->
      <div v-if="byStage.bounced.length" class="px-4 pb-6">
        <h2 class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Bounced ({{ byStage.bounced.length }})</h2>
        <ul class="flex flex-wrap gap-2">
          <li v-for="c in byStage.bounced" :key="c.recipient">
            <button
              type="button"
              @click="openChain(c)"
              class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 cursor-pointer"
            >
              {{ c.recipient }}
            </button>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppBadge from "@/components/AppBadge.vue";
import api from "@/services/api";
import { useAppBindingsStore } from "@/stores/appBindings";

type Stage = "contacted" | "opened" | "clicked" | "replied" | "bounced";

interface Chain {
	recipient: string;
	start_id: string;
	start_subject: string;
	last_date: string;
	sent_count: number;
	stage: Stage;
	replied_at: string | null;
	pending_draft_id: string | null;
	suppressed: string | null;
}

const route = useRoute();
const router = useRouter();
const bindings = useAppBindingsStore();

const days = ref(90);
const loading = ref(false);
const errorMessage = ref("");
const chains = ref<Chain[]>([]);
const mobileStage = ref<Stage>("contacted");

const mailboxId = computed(() => String(route.params.mailboxId || ""));

const columns = [
	{ stage: "contacted" as Stage, label: "Contacted", dot: "bg-gray-400" },
	{ stage: "opened" as Stage, label: "Opened", dot: "bg-sky-500" },
	{ stage: "clicked" as Stage, label: "Clicked", dot: "bg-violet-500" },
	{ stage: "replied" as Stage, label: "Replied", dot: "bg-emerald-500" },
];

const byStage = computed(() => {
	const out: Record<Stage, Chain[]> = { contacted: [], opened: [], clicked: [], replied: [], bounced: [] };
	for (const c of chains.value) out[c.stage].push(c);
	return out;
});

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "0%");

const cards = computed(() => {
	const total = chains.value.length;
	const bounced = byStage.value.bounced.length;
	const reached = total - bounced;
	const opened = chains.value.filter((c) => ["opened", "clicked", "replied"].includes(c.stage)).length;
	const replied = byStage.value.replied.length;
	return [
		{ label: "Contacted", value: String(total), hint: `last ${days.value} days` },
		{ label: "Opened or more", value: String(opened), hint: pct(opened, reached) },
		{ label: "Clicked", value: String(byStage.value.clicked.length), hint: "and not replied" },
		{ label: "Replied", value: String(replied), hint: `${pct(replied, reached)} reply rate` },
		{ label: "Bounced", value: String(bounced), hint: "never delivered" },
	];
});

const timeAgo = (iso: string): string => {
	const diff = Date.now() - Date.parse(iso);
	const mins = Math.floor(diff / 60000);
	if (mins < 60) return `${Math.max(mins, 1)}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
};

const openChain = (c: Chain) => {
	if (c.pending_draft_id) {
		router.push({
			name: "EmailList",
			params: { mailboxId: mailboxId.value, folder: "drafts" },
		});
		return;
	}
	router.push({
		name: "EmailDetail",
		params: { mailboxId: mailboxId.value, id: c.start_id },
		query: { fromFolder: "sent" },
	});
};

const load = async () => {
	if (!mailboxId.value) return;
	loading.value = true;
	errorMessage.value = "";
	try {
		const res = await api.getPipeline(mailboxId.value, days.value);
		chains.value = res.data?.chains || [];
	} catch (err: any) {
		errorMessage.value = err?.response?.data?.error || "Could not load the pipeline.";
	} finally {
		loading.value = false;
	}
};

onMounted(() => {
	if (!bindings.loaded) bindings.fetchBindings?.();
	load();
});
</script>
