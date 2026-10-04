<template>
  <div class="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 overflow-y-auto pb-28 sm:pb-8 touch-pan-y">
    <!-- Header -->
    <div class="px-4 sm:px-6 pt-4 pb-3.5 sm:py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-lg sm:text-xl font-extrabold tracking-tight">Outreach pipeline</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xl leading-relaxed">
            Everyone you cold-emailed from this mailbox, and how far they got. Conversations you replied to are not listed.
          </p>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <select
            v-model.number="days"
            @change="load"
            class="flex-1 sm:flex-initial text-base sm:text-xs min-h-[40px] sm:min-h-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-xs"
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
            class="min-h-[40px] sm:min-h-0 px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
          >
            <svg class="w-3.5 h-3.5 shrink-0" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{{ loading ? 'Loading...' : 'Refresh' }}</span>
          </button>
        </div>
      </div>

      <!-- Funnel numbers: Horizontal swipeable snap carousel on mobile, 5-col grid on desktop -->
      <div class="flex sm:grid sm:grid-cols-5 gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 mt-3.5 snap-x snap-mandatory touch-pan-x">
        <button
          v-for="card in cards"
          :key="card.label"
          type="button"
          @click="selectStage(card.stage)"
          class="shrink-0 w-[140px] sm:w-auto snap-start rounded-xl border p-3 flex flex-col justify-between text-left transition-all cursor-pointer select-none active:scale-[0.98] shadow-xs group"
          :class="mobileStage === card.stage ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/40 ring-1 ring-emerald-500/30' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'"
        >
          <div class="flex items-center justify-between gap-1 w-full">
            <span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">{{ card.label }}</span>
            <span class="w-2 h-2 rounded-full shrink-0" :class="card.dot"></span>
          </div>
          <div class="text-xl font-extrabold tabular-nums my-1 text-gray-900 dark:text-gray-100">{{ card.value }}</div>
          <div class="text-[10px] font-medium text-gray-400 dark:text-gray-500 truncate">{{ card.hint }}</div>
        </button>
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
      <!-- Mobile: Stage selector pills (touch-friendly, no scrollbar, includes bounced) -->
      <div class="md:hidden px-4 pt-3.5 pb-1 flex gap-2 overflow-x-auto no-scrollbar touch-pan-x">
        <button
          v-for="col in mobileColumns"
          :key="col.stage"
          type="button"
          @click="selectStage(col.stage)"
          class="shrink-0 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-xs"
          :class="mobileStage === col.stage ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          <span class="w-2 h-2 rounded-full shrink-0" :class="mobileStage === col.stage ? 'bg-white' : col.dot"></span>
          <span>{{ col.label }}</span>
          <span
            class="px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
            :class="mobileStage === col.stage ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
          >
            {{ byStage[col.stage].length }}
          </span>
        </button>
      </div>

      <!-- Mobile Active Stage View (< md) -->
      <div class="md:hidden p-4">
        <div v-if="byStage[mobileStage].length === 0" class="py-12 px-4 text-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50">
          <div class="w-10 h-10 mx-auto mb-2.5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p class="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {{ mobileStage === 'bounced' ? 'No bounced emails' : 'No contacts in this stage' }}
          </p>
          <p class="text-[11px] text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
            {{ mobileStage === 'bounced' ? 'All sent emails were delivered successfully.' : 'Contacts advance across stages as people open, click and reply to your outreach.' }}
          </p>
        </div>

        <ul v-else class="space-y-2.5">
          <li v-for="c in byStage[mobileStage]" :key="c.recipient">
            <button
              type="button"
              @click="openChain(c)"
              class="w-full text-left rounded-xl bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 p-3.5 hover:border-emerald-400 dark:hover:border-emerald-600 active:scale-[0.99] transition-all cursor-pointer shadow-xs group overflow-hidden"
            >
              <div class="flex items-start justify-between gap-2 min-w-0">
                <div class="flex flex-col gap-1 min-w-0 flex-1">
                  <div class="text-xs font-bold text-gray-900 dark:text-gray-100 truncate" :title="c.recipient">
                    {{ c.recipient }}
                  </div>
                  <AppBadge :email="c.recipient" />
                  <div class="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {{ c.start_subject || '(No subject)' }}
                  </div>
                </div>
                <svg class="w-4 h-4 text-gray-400 group-hover:text-emerald-500 shrink-0 mt-0.5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 mt-2.5 text-[10px] font-semibold">
                <span class="text-gray-400 dark:text-gray-500">{{ timeAgo(c.last_date) }}</span>
                <span v-if="c.sent_count > 1" class="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {{ c.sent_count }} messages
                </span>
                <span v-if="c.stage === 'bounced'" class="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                  Bounced
                </span>
                <span v-if="c.pending_draft_id" class="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Follow-up draft ready
                </span>
                <span v-if="c.suppressed === 'unsubscribe'" class="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Unsubscribed
                </span>
                <span v-else-if="c.suppressed === 'manual'" class="px-1.5 py-0.5 rounded-md bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
                  Do not contact
                </span>
                <span v-if="c.replied_at" class="text-emerald-600 dark:text-emerald-400">
                  Replied {{ timeAgo(c.replied_at) }}
                </span>
              </div>
            </button>
          </li>
        </ul>
      </div>

      <!-- Desktop Kanban Board (>= md) -->
      <div class="hidden md:grid md:grid-cols-4 gap-3 items-start p-4">
        <section
          v-for="col in columns"
          :key="col.stage"
          class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-900/60 min-w-0 overflow-hidden"
        >
          <header class="flex items-center justify-between px-3 py-2.5">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2 h-2 rounded-full shrink-0" :class="col.dot"></span>
              <h2 class="text-xs font-bold truncate">{{ col.label }}</h2>
            </div>
            <span class="text-[11px] font-bold text-gray-500 dark:text-gray-400 tabular-nums shrink-0 ml-1">{{ byStage[col.stage].length }}</span>
          </header>
          <ul class="px-2 pb-2 space-y-2">
            <li v-if="byStage[col.stage].length === 0" class="px-2 py-4 text-center text-[11px] text-gray-400">Nobody here</li>
            <li v-for="c in byStage[col.stage]" :key="c.recipient">
              <button
                type="button"
                @click="openChain(c)"
                class="w-full text-left rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors cursor-pointer overflow-hidden group"
              >
                <div class="flex flex-col gap-1 min-w-0 w-full">
                  <div class="text-xs font-bold text-gray-900 dark:text-gray-100 truncate" :title="c.recipient">
                    {{ c.recipient }}
                  </div>
                  <AppBadge :email="c.recipient" />
                  <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {{ c.start_subject || '(No subject)' }}
                  </div>
                </div>
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

      <!-- Bounced (Desktop only, mobile handles it via stage selector) -->
      <div v-if="byStage.bounced.length" class="hidden md:block px-4 pb-6">
        <h2 class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Bounced ({{ byStage.bounced.length }})</h2>
        <ul class="flex flex-wrap gap-2">
          <li v-for="c in byStage.bounced" :key="c.recipient">
            <button
              type="button"
              @click="openChain(c)"
              class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer"
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

const mobileColumns = [
  { stage: "contacted" as Stage, label: "Contacted", dot: "bg-gray-400" },
  { stage: "opened" as Stage, label: "Opened", dot: "bg-sky-500" },
  { stage: "clicked" as Stage, label: "Clicked", dot: "bg-violet-500" },
  { stage: "replied" as Stage, label: "Replied", dot: "bg-emerald-500" },
  { stage: "bounced" as Stage, label: "Bounced", dot: "bg-rose-500" },
];

const selectStage = (stage: Stage) => {
  mobileStage.value = stage;
};

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
    { stage: "contacted" as Stage, label: "Contacted", value: String(total), hint: `last ${days.value} days`, dot: "bg-gray-400" },
    { stage: "opened" as Stage, label: "Opened or more", value: String(opened), hint: pct(opened, reached), dot: "bg-sky-500" },
    { stage: "clicked" as Stage, label: "Clicked", value: String(byStage.value.clicked.length), hint: "and not replied", dot: "bg-violet-500" },
    { stage: "replied" as Stage, label: "Replied", value: String(replied), hint: `${pct(replied, reached)} reply rate`, dot: "bg-emerald-500" },
    { stage: "bounced" as Stage, label: "Bounced", value: String(bounced), hint: "never delivered", dot: "bg-rose-500" },
  ];
});

const timeAgo = (iso?: string | null): string => {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (isNaN(ts)) return "";
  const diff = Date.now() - ts;
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

