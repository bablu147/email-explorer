<template>
  <div class="flex-1 flex flex-col min-h-full bg-white dark:bg-gray-900">
    <!-- Header with interactive search & filter controls -->
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">
            Search
          </h1>
          <span v-if="!isLoading" class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {{ results.length }} {{ results.length === 1 ? 'match' : 'matches' }}
          </span>
        </div>
      </div>

      <!-- Search Input Box -->
      <div class="relative flex items-center">
        <div class="absolute left-3.5 pointer-events-none text-gray-400 dark:text-gray-500 flex items-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref="searchInputRef"
          v-model="inputValue"
          type="text"
          placeholder="Search emails or use filters like from:alice is:unread has:attachment folder:inbox..."
          class="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-xs"
          @keydown.enter="handleSearch"
        />
        <button
          v-if="inputValue"
          @click="clearSearch"
          class="absolute right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md transition-colors"
          title="Clear search"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Active Filter Chips -->
      <div v-if="activeFilterTokens.length > 0" class="flex items-center gap-1.5 flex-wrap">
        <span class="text-xs text-gray-400 dark:text-gray-500 font-medium mr-1">Active filters:</span>
        <span
          v-for="chip in activeFilterTokens"
          :key="chip.key + chip.value"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs"
        >
          <span class="text-emerald-500 font-bold">{{ chip.label }}:</span>
          <span>{{ chip.value }}</span>
          <button
            @click="removeFilterToken(chip.raw)"
            class="ml-1 hover:text-emerald-900 dark:hover:text-emerald-100 p-0.5 rounded-full"
            title="Remove filter"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      </div>

      <!-- Quick Suggested Filter Pills -->
      <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
        <span class="text-[11px] text-gray-400 dark:text-gray-500 font-medium mr-1">Add filter:</span>
        <button
          v-for="preset in quickFilters"
          :key="preset.token"
          @click="addFilterToken(preset.token)"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors border border-gray-200/60 dark:border-gray-700/60"
        >
          <svg class="w-2.5 h-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{{ preset.label }}</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="p-16 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center">
      <svg class="w-8 h-8 animate-spin text-emerald-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-sm font-medium">Searching messages...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="results.length === 0" class="p-12 text-center max-w-xl mx-auto">
      <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h2 class="text-base font-bold text-gray-900 dark:text-white mb-1.5">No matching emails</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">
        No messages matched your query. Use filter tokens to narrow down your results.
      </p>

      <!-- Advanced Filter Cheat Sheet -->
      <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-left">
        <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Filter token guide:</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
          <div><code class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-emerald-600 dark:text-emerald-400">from:alice</code> — sender</div>
          <div><code class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-emerald-600 dark:text-emerald-400">to:team</code> — recipient</div>
          <div><code class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-emerald-600 dark:text-emerald-400">is:unread</code> — unread mail</div>
          <div><code class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-emerald-600 dark:text-emerald-400">is:starred</code> — starred mail</div>
          <div><code class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-emerald-600 dark:text-emerald-400">has:attachment</code> — attachments</div>
          <div><code class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-emerald-600 dark:text-emerald-400">folder:sent</code> — specific folder</div>
          <div><code class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-emerald-600 dark:text-emerald-400">after:2026-01-01</code> — date range</div>
          <div><code class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-emerald-600 dark:text-emerald-400">before:2026-12-31</code> — date range</div>
        </div>
      </div>
    </div>

    <!-- Results List -->
    <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
      <li 
        v-for="email in results" 
        :key="email.id"
        class="hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-all border-l-4"
        :class="!email.read ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500' : 'border-transparent'"
      >
        <div @click="openEmail(email.id)" class="block px-6 py-3.5 cursor-pointer">
          <div class="flex items-center gap-4">
            <!-- App Avatar -->
            <AppAvatar
              :email="email.sender"
              :initial="(email.sender || '?').charAt(0).toUpperCase()"
              size="md"
            />

            <!-- Content -->
            <div class="flex-grow min-w-0 pr-2">
              <div class="flex items-center gap-2 flex-wrap mb-0.5">
                <span 
                  class="text-sm font-semibold truncate max-w-[280px]"
                  :class="!email.read ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-800 dark:text-gray-200'"
                >
                  {{ email.sender }}
                </span>
                <!-- Linked App Identity Chip -->
                <AppBadge :email="email.sender" />
                <span class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
                  &rarr; {{ email.recipient }}
                </span>

                <!-- Starred badge -->
                <span v-if="email.starred" class="text-amber-500" title="Starred">
                  <svg class="w-3.5 h-3.5 fill-amber-400 stroke-amber-500" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </span>

                <!-- Viewed Tracking Badge -->
                <span 
                  v-if="email.opened_count && email.opened_count > 0"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                >
                  <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  <span>Viewed ({{ email.opened_count }}x)</span>
                </span>

                <!-- Clicked Badge -->
                <span 
                  v-if="email.clicked_count && email.clicked_count > 0"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                >
                  <svg class="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                  <span>Clicked ({{ email.clicked_count }}x)</span>
                </span>
              </div>

              <p class="text-sm truncate leading-snug">
                <span :class="!email.read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-800 dark:text-gray-300'">
                  {{ email.subject || "(No subject)" }}
                </span>
                <span v-if="getSnippet(email.body)" class="text-gray-500 dark:text-gray-400 font-normal ml-1.5">
                  — {{ getSnippet(email.body) }}
                </span>
              </p>
            </div>

            <!-- Date -->
            <div class="flex-shrink-0 text-right">
              <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {{ formatFriendlyDate(email.date) }}
              </p>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { useSearchStore } from "@/stores/search";
import AppAvatar from "@/components/AppAvatar.vue";
import AppBadge from "@/components/AppBadge.vue";
import { parseSearchQuery } from "@/utils/searchParser";

const route = useRoute();
const router = useRouter();
const searchStore = useSearchStore();
const { results, isLoading } = storeToRefs(searchStore);

const searchInputRef = ref<HTMLInputElement | null>(null);
const inputValue = ref(String(route.query.q || ""));

const mailboxId = computed(() => String(route.params.mailboxId || ""));

const quickFilters = [
	{ label: "Unread", token: "is:unread" },
	{ label: "Starred", token: "is:starred" },
	{ label: "Has Attachment", token: "has:attachment" },
	{ label: "Inbox", token: "folder:inbox" },
	{ label: "Sent", token: "folder:sent" },
	{ label: "Snoozed", token: "folder:snoozed" },
	{ label: "Scheduled", token: "folder:scheduled" },
];

const activeFilterTokens = computed(() => {
	const parsed = parseSearchQuery(inputValue.value);
	const chips: Array<{ label: string; value: string; raw: string; key: string }> = [];

	if (parsed.from) chips.push({ label: "From", value: parsed.from, raw: `from:${parsed.from}`, key: "from" });
	if (parsed.to) chips.push({ label: "To", value: parsed.to, raw: `to:${parsed.to}`, key: "to" });
	if (parsed.folder) chips.push({ label: "Folder", value: parsed.folder, raw: `folder:${parsed.folder}`, key: "folder" });
	if (parsed.hasAttachment) chips.push({ label: "Has", value: "Attachment", raw: "has:attachment", key: "has" });
	if (parsed.isRead === false) chips.push({ label: "Status", value: "Unread", raw: "is:unread", key: "read" });
	if (parsed.isRead === true) chips.push({ label: "Status", value: "Read", raw: "is:read", key: "read" });
	if (parsed.isStarred === true) chips.push({ label: "Status", value: "Starred", raw: "is:starred", key: "starred" });
	if (parsed.after) chips.push({ label: "After", value: parsed.after.slice(0, 10), raw: `after:${parsed.after.slice(0, 10)}`, key: "after" });
	if (parsed.before) chips.push({ label: "Before", value: parsed.before.slice(0, 10), raw: `before:${parsed.before.slice(0, 10)}`, key: "before" });

	return chips;
});

const executeSearch = (q: string) => {
	if (!mailboxId.value) return;
	searchStore.searchEmails(mailboxId.value, q);
};

const handleSearch = () => {
	const q = inputValue.value.trim();
	router.replace({
		name: "SearchResults",
		params: { mailboxId: mailboxId.value },
		query: q ? { q } : {},
	});
	executeSearch(q);
};

const clearSearch = () => {
	inputValue.value = "";
	handleSearch();
	searchInputRef.value?.focus();
};

const addFilterToken = (token: string) => {
	const current = inputValue.value.trim();
	if (current.includes(token)) return;
	inputValue.value = current ? `${current} ${token}` : token;
	handleSearch();
};

const removeFilterToken = (token: string) => {
	const current = inputValue.value;
	// Replace raw token or quoted token
	const cleaned = current
		.replace(new RegExp(`\\b${token}\\b`, "i"), "")
		.replace(/\s+/g, " ")
		.trim();
	inputValue.value = cleaned;
	handleSearch();
};

const openEmail = (id: string) => {
	router.push({ name: "EmailDetail", params: { id } });
};

const getSnippet = (body?: string | null, maxLen = 90): string => {
	if (!body) return "";
	const text = body
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (text.length <= maxLen) return text;
	return text.slice(0, maxLen) + "…";
};

const formatFriendlyDate = (dateStr?: string): string => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return dateStr;

	const now = new Date();
	const isToday =
		date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	if (isToday) {
		return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	}

	if (date.getFullYear() === now.getFullYear()) {
		return date.toLocaleDateString([], { month: "short", day: "numeric" });
	}

	return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
};

watch(
	() => route.query.q,
	(newQ) => {
		const qStr = String(newQ || "");
		inputValue.value = qStr;
		executeSearch(qStr);
	},
);

onMounted(() => {
	executeSearch(inputValue.value);
});
</script>
