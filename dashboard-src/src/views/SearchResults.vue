<template>
  <div class="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <span>Search Results</span>
        <span v-if="!isLoading" class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {{ results.length }} {{ results.length === 1 ? 'match' : 'matches' }}
        </span>
      </h1>
    </div>

    <div v-if="isLoading" class="p-16 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center">
      <svg class="w-8 h-8 animate-spin text-emerald-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-sm font-medium">Searching messages...</p>
    </div>

    <div v-else-if="results.length === 0" class="p-16 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-1">No matching emails</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400">Try searching with a different term, sender, or subject.</p>
    </div>

    <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
      <li 
        v-for="email in results" 
        :key="email.id"
        class="hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-all border-l-4"
        :class="!email.read ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500' : 'border-transparent'"
      >
        <router-link :to="{ name: 'EmailDetail', params: { id: email.id } }" class="block px-6 py-3.5">
          <div class="flex items-center gap-4">
            <!-- Initials Avatar -->
            <div class="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {{ (email.sender || '?').charAt(0).toUpperCase() }}
            </div>

            <!-- Content -->
            <div class="flex-grow min-w-0 pr-2">
              <div class="flex items-center gap-2 flex-wrap mb-0.5">
                <span 
                  class="text-sm font-semibold truncate max-w-[280px]"
                  :class="!email.read ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-800 dark:text-gray-200'"
                >
                  {{ email.sender }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
                  &rarr; {{ email.recipient }}
                </span>

                <!-- Viewed Tracking Badge -->
                <span 
                  v-if="email.opened_count && email.opened_count > 0"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                >
                  👁 Viewed ({{ email.opened_count }}x)
                </span>

                <!-- Clicked Badge -->
                <span 
                  v-if="email.clicked_count && email.clicked_count > 0"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                >
                  🔗 Clicked ({{ email.clicked_count }}x)
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
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSearchStore } from "@/stores/search";

const searchStore = useSearchStore();
const { results, isLoading } = storeToRefs(searchStore);

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
</script>
