<template>
  <div
    v-if="isModalOpen"
    class="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-70 p-4 animate-in fade-in duration-200"
    @click.self="closeModal"
    @keydown.esc="closeModal"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all flex flex-col max-h-[90vh]"
    >
      <!-- Modal Header -->
      <div
        class="flex justify-between items-center bg-gray-50 dark:bg-gray-900/90 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/20"
          >
            <!-- Mobile App / Device Icon -->
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{{ isEditing ? 'Edit App Binding' : 'Link App / Website' }}</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              >
                Team Shared
              </span>
            </h2>
            <p v-if="targetEmail" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Bind <span class="font-semibold text-gray-700 dark:text-gray-300 font-mono">{{ targetEmail }}</span> to an App or Website identity
            </p>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Link an App or Website to a recipient
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="closeModal"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg p-1.5 transition-colors cursor-pointer"
          title="Close modal"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 overflow-y-auto flex-grow space-y-5">
        <!-- Target Email Input -->
        <div class="space-y-1.5">
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Target Contact Email Address
          </label>
          <input
            v-model="targetEmail"
            type="email"
            placeholder="publisher@gamestudio.com"
            class="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg px-3.5 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            required
          />
        </div>

        <!-- Search & Lookup Section -->
        <div class="space-y-3">
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Search App or Enter Store / Website URL
          </label>

          <!-- Platform Selector Tabs -->
          <div class="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900/60 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              v-for="plat in platformTabs"
              :key="plat.id"
              @click="selectPlatformTab(plat.id)"
              class="flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
              :class="activePlatformTab === plat.id 
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm font-bold' 
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'"
            >
              <component :is="plat.icon" class="w-3.5 h-3.5 flex-shrink-0" />
              <span>{{ plat.label }}</span>
            </button>
          </div>

          <!-- Search Input Box -->
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <svg v-if="!isSearching" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <svg v-else class="w-4 h-4 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>

            <input
              ref="searchInputRef"
              v-model="searchQuery"
              @input="onSearchInput"
              @paste="onSearchPaste"
              @keydown.enter.prevent="executeLookup"
              type="text"
              placeholder="e.g. Instagram, Slack, play.google.com/..., apps.apple.com/..., or stripe.com"
              class="w-full pl-10 pr-24 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 placeholder-gray-400 text-gray-900 dark:text-gray-100 transition-all"
            />

            <div class="absolute inset-y-0 right-1.5 flex items-center gap-1">
              <button
                v-if="searchQuery"
                type="button"
                @click="clearSearch"
                class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Clear input"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                type="button"
                @click="executeLookup"
                :disabled="!searchQuery.trim() || isSearching"
                class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        <!-- Search Results List -->
        <div v-if="searchResults.length > 0" class="space-y-2">
          <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-semibold px-1">
            <span>Search Results ({{ searchResults.length }})</span>
            <span>Click to select</span>
          </div>

          <div class="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-gray-200 dark:border-gray-700 rounded-xl p-1.5 bg-gray-50/50 dark:bg-gray-900/40 divide-y divide-gray-100 dark:divide-gray-800">
            <div
              v-for="(item, index) in searchResults"
              :key="index"
              @click="selectResult(item)"
              class="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer group border border-transparent hover:border-emerald-500/30 hover:shadow-sm"
              :class="{'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40': selectedItem?.app_url === item.app_url}"
            >
              <div class="flex items-center gap-3 min-w-0 pr-2">
                <img
                  :src="item.app_icon_url"
                  :alt="item.app_name"
                  class="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700 bg-white flex-shrink-0 shadow-xs"
                  @error="onImgError($event, item.platform)"
                />
                <div class="min-w-0">
                  <p class="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {{ item.app_name }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {{ item.developer_name || 'App metadata' }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 flex-shrink-0">
                <!-- Platform Badge -->
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border"
                  :class="getPlatformBadgeClass(item.platform)"
                >
                  {{ formatPlatformName(item.platform) }}
                </span>
                <button
                  type="button"
                  class="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 group-hover:bg-emerald-700 text-white transition-all shadow-xs"
                >
                  Select
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected App Form & Preview -->
        <div v-if="selectedItem" class="bg-gray-50 dark:bg-gray-900/80 rounded-xl p-4 border border-emerald-500/30 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700/60 pb-3">
            <span class="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              Selected App Identity
            </span>

            <a
              :href="selectedItem.app_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 font-semibold"
            >
              <span>Test Store / Web URL</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          <!-- Preview Header -->
          <div class="flex items-start gap-4">
            <div class="relative flex-shrink-0">
              <img
                :src="selectedItem.app_icon_url"
                :alt="selectedItem.app_name"
                class="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/40 bg-white shadow-md"
                @error="onImgError($event, selectedItem.platform)"
              />
              <span
                class="absolute -bottom-1 -right-1 p-1 rounded-full text-white shadow-xs"
                :class="selectedItem.platform === 'playstore' ? 'bg-emerald-600' : selectedItem.platform === 'appstore' ? 'bg-blue-600' : 'bg-indigo-600'"
                :title="formatPlatformName(selectedItem.platform)"
              >
                <component :is="getPlatformIcon(selectedItem.platform)" class="w-2.5 h-2.5" />
              </span>
            </div>

            <div class="flex-grow space-y-2">
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Display App Name
                </label>
                <input
                  v-model="selectedItem.app_name"
                  type="text"
                  required
                  placeholder="App Name"
                  class="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label class="block text-gray-500 dark:text-gray-400 mb-1">Platform</label>
                  <select
                    v-model="selectedItem.platform"
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 font-semibold focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="playstore">Google Play Store</option>
                    <option value="appstore">Apple App Store</option>
                    <option value="website">Official Website</option>
                  </select>
                </div>
                <div>
                  <label class="block text-gray-500 dark:text-gray-400 mb-1">Developer / Organization</label>
                  <input
                    v-model="selectedItem.developer_name"
                    type="text"
                    placeholder="Optional Developer Name"
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Advanced URLs Collapsible -->
          <div class="pt-2 border-t border-gray-200 dark:border-gray-700/60">
            <button
              type="button"
              @click="showAdvanced = !showAdvanced"
              class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>{{ showAdvanced ? 'Hide advanced URLs' : 'Show / edit URLs' }}</span>
              <svg class="w-3.5 h-3.5 transform transition-transform" :class="{'rotate-180': showAdvanced}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div v-if="showAdvanced" class="mt-2.5 space-y-2 text-xs">
              <div>
                <label class="block text-gray-500 dark:text-gray-400 mb-0.5">App / Store Destination URL</label>
                <input
                  v-model="selectedItem.app_url"
                  type="url"
                  required
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 font-mono text-[11px]"
                />
              </div>
              <div>
                <label class="block text-gray-500 dark:text-gray-400 mb-0.5">App Icon URL</label>
                <input
                  v-model="selectedItem.app_icon_url"
                  type="url"
                  required
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State if no selection -->
        <div v-else-if="!isSearching && searchResults.length === 0" class="text-center py-6 px-4 bg-gray-50/60 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
          <template v-if="searchQuery.trim()">
            <p class="text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">No apps found for "{{ searchQuery.trim() }}"</p>
            <p class="text-xs">
              Try searching by exact app name, or paste a Google Play link, App Store link, or official website URL.
            </p>
          </template>
          <template v-else>
            <p class="text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Search for an app or paste a link</p>
            <p class="text-xs">
              Search iOS/Android apps by name, or paste a Google Play link, Apple App Store link, or website URL above.
            </p>
          </template>
        </div>
      </div>

      <!-- Modal Footer -->
      <div
        class="flex items-center justify-between bg-gray-50 dark:bg-gray-900/90 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0"
      >
        <div>
          <button
            v-if="isEditing"
            type="button"
            @click="handleUnlink"
            :disabled="isSaving"
            class="px-3.5 py-2 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all border border-red-200 dark:border-red-900/40 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Unlink App
          </button>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            @click="closeModal"
            class="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            @click="handleSave"
            :disabled="!canSave || isSaving"
            class="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg v-if="isSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ isSaving ? 'Saving...' : 'Save App Binding' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, nextTick, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import api from "@/services/api";
import { useToast } from "@/composables/useToast";
import { extractCleanEmail, useAppBindingsStore } from "@/stores/appBindings";
import type { AppBinding, AppPlatform } from "@/types";

const appBindingsStore = useAppBindingsStore();
const { isModalOpen, modalEmail, modalBinding } = storeToRefs(appBindingsStore);
const { success, error: toastError } = useToast();

const targetEmail = ref("");
const searchInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref("");
const isSearching = ref(false);
const isSaving = ref(false);
const showAdvanced = ref(false);
const activePlatformTab = ref<"all" | "playstore" | "appstore" | "website">("all");

interface LookupItem {
	app_name: string;
	app_icon_url: string;
	app_url: string;
	platform: AppPlatform;
	developer_name?: string | null;
}

const searchResults = ref<LookupItem[]>([]);
const selectedItem = ref<LookupItem | null>(null);

let debounceTimeout: any = null;

// Platform tab icons
const AllIcon = () =>
	h("svg", { class: "w-3.5 h-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, [
		h("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M4 6h16M4 10h16M4 14h16M4 18h16" }),
	]);

const PlayIcon = () =>
	h("svg", { class: "w-3.5 h-3.5 text-emerald-500", viewBox: "0 0 24 24", fill: "currentColor" }, [
		h("path", { d: "M3.609 1.814L13.792 12 3.61 22.186a2.03 2.03 0 01-.61-1.467V3.28c0-.573.225-1.096.609-1.466zM15.206 13.414l2.457-2.457a1.99 1.99 0 000-2.814l-2.457-2.457-3.007 3.007 3.007 2.921zM4.75 23.327l9.043-9.043 2.127 2.127-9.704 5.539a1.97 1.97 0 01-1.466.377zM4.75.673a1.97 1.97 0 011.466.377l9.704 5.539-2.127 2.127L4.75.673z" }),
	]);

const AppleIcon = () =>
	h("svg", { class: "w-3.5 h-3.5 text-blue-500", viewBox: "0 0 24 24", fill: "currentColor" }, [
		h("path", { d: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.79 1.06-1.88.94-2.97-.93.04-2.03.62-2.68 1.41-.57.66-.99 1.77-.85 2.84 1.03.08 2.05-.53 2.59-1.28z" }),
	]);

const WebIcon = () =>
	h("svg", { class: "w-3.5 h-3.5 text-indigo-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, [
		h("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" }),
	]);

const platformTabs = [
	{ id: "all" as const, label: "All Platforms", icon: AllIcon },
	{ id: "playstore" as const, label: "Google Play", icon: PlayIcon },
	{ id: "appstore" as const, label: "App Store", icon: AppleIcon },
	{ id: "website" as const, label: "Website", icon: WebIcon },
];

const isEditing = computed(() => {
	const clean = extractCleanEmail(targetEmail.value || modalEmail.value);
	return !!appBindingsStore.getBinding(clean) || !!modalBinding.value;
});

const canSave = computed(() => {
	const clean = extractCleanEmail(targetEmail.value || modalEmail.value);
	return (
		!!clean &&
		!!selectedItem.value &&
		!!selectedItem.value.app_name?.trim() &&
		!!selectedItem.value.app_icon_url?.trim() &&
		!!selectedItem.value.app_url?.trim()
	);
});

// Watch when modal opens
watch(
	() => isModalOpen.value,
	(open) => {
		if (open) {
			targetEmail.value = modalEmail.value || "";
			searchResults.value = [];
			showAdvanced.value = false;
			activePlatformTab.value = "all";

			const existing = modalBinding.value || appBindingsStore.getBinding(targetEmail.value);
			if (existing) {
				selectedItem.value = {
					app_name: existing.app_name,
					app_icon_url: existing.app_icon_url,
					app_url: existing.app_url,
					platform: existing.platform,
					developer_name: existing.developer_name,
				};
				searchQuery.value = existing.app_name;
			} else {
				selectedItem.value = null;
				// Auto-populate search with domain or suggested name from email
				const clean = extractCleanEmail(targetEmail.value);
				const emailParts = clean.split("@");
				if (emailParts.length === 2) {
					const domain = emailParts[1];
					// Strip common mail providers
					if (!["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(domain.toLowerCase())) {
						searchQuery.value = domain;
					} else {
						searchQuery.value = "";
					}
				} else {
					searchQuery.value = "";
				}
			}

			nextTick(() => {
				searchInputRef.value?.focus();
				if (searchQuery.value && !modalBinding.value) {
					executeLookup();
				}
			});
		} else {
			searchQuery.value = "";
			searchResults.value = [];
			selectedItem.value = null;
		}
	},
);

const selectPlatformTab = (tab: "all" | "playstore" | "appstore" | "website") => {
	activePlatformTab.value = tab;
	if (searchQuery.value.trim()) {
		executeLookup();
	}
};

const onSearchInput = () => {
	if (debounceTimeout) clearTimeout(debounceTimeout);
	const q = searchQuery.value.trim();
	if (!q) {
		searchResults.value = [];
		return;
	}
	if (q.length >= 2) {
		debounceTimeout = setTimeout(() => {
			executeLookup();
		}, 400);
	}
};

const onSearchPaste = () => {
	nextTick(() => {
		executeLookup();
	});
};

const clearSearch = () => {
	searchQuery.value = "";
	searchResults.value = [];
	searchInputRef.value?.focus();
};

const executeLookup = async () => {
	const query = searchQuery.value.trim();
	if (!query) return;

	isSearching.value = true;
	try {
		const res = await api.lookupApp(query, activePlatformTab.value);
		const list: LookupItem[] = res.data?.results || [];
		searchResults.value = list;

		// If single exact match from URL/ID lookup, auto-select it
		if (list.length === 1 && !selectedItem.value) {
			selectResult(list[0]);
		}
	} catch (e: any) {
		console.error("App lookup failed", e);
		toastError("Failed to lookup app metadata");
	} finally {
		isSearching.value = false;
	}
};

const selectResult = (item: LookupItem) => {
	selectedItem.value = { ...item };
};

const getPlatformBadgeClass = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore":
			return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
		case "appstore":
			return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
		case "website":
			return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
		default:
			return "bg-gray-100 text-gray-700 dark:text-gray-300 border-gray-200";
	}
};

const formatPlatformName = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore":
			return "Google Play";
		case "appstore":
			return "App Store";
		case "website":
			return "Website";
	}
};

const getPlatformIcon = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore":
			return PlayIcon;
		case "appstore":
			return AppleIcon;
		case "website":
			return WebIcon;
	}
};

const onImgError = (event: Event, platform: AppPlatform) => {
	const img = event.target as HTMLImageElement;
	if (img.dataset.hasError) return;
	img.dataset.hasError = "true";
	if (platform === "playstore") {
		img.src = "https://www.google.com/s2/favicons?domain=play.google.com&sz=128";
	} else if (platform === "appstore") {
		img.src = "https://www.google.com/s2/favicons?domain=apple.com&sz=128";
	} else {
		try {
			const u = new URL(selectedItem.value?.app_url || "");
			img.src = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
		} catch {
			img.src = "https://www.google.com/s2/favicons?domain=reflect.cloud&sz=128";
		}
	}
};

const closeModal = () => {
	appBindingsStore.closeLinkModal();
};

const handleSave = async () => {
	const clean = extractCleanEmail(targetEmail.value || modalEmail.value);
	if (!clean) {
		toastError("Please enter a valid target email address");
		return;
	}
	if (!selectedItem.value) return;

	let appUrl = selectedItem.value.app_url.trim();
	if (!/^https?:\/\//i.test(appUrl)) {
		appUrl = "https://" + appUrl;
	}

	let appIconUrl = selectedItem.value.app_icon_url.trim();
	if (!/^https?:\/\//i.test(appIconUrl)) {
		appIconUrl = "https://" + appIconUrl;
	}

	isSaving.value = true;
	try {
		await appBindingsStore.saveBinding({
			email: clean,
			app_name: selectedItem.value.app_name.trim(),
			app_icon_url: appIconUrl,
			app_url: appUrl,
			platform: selectedItem.value.platform,
			developer_name: selectedItem.value.developer_name?.trim() || null,
		});

		success(`Bound ${clean} to ${selectedItem.value.app_name}`);
		closeModal();
	} catch (e: any) {
		console.error("Failed to save app binding", e);
		toastError(e.response?.data?.error || "Failed to save binding");
	} finally {
		isSaving.value = false;
	}
};

const handleUnlink = async () => {
	const clean = extractCleanEmail(targetEmail.value || modalEmail.value);
	if (!clean) return;
	if (!confirm(`Are you sure you want to unlink the app from ${clean}?`)) {
		return;
	}

	isSaving.value = true;
	try {
		await appBindingsStore.deleteBinding(clean);
		success(`Unlinked app identity from ${clean}`);
		closeModal();
	} catch (e: any) {
		console.error("Failed to delete binding", e);
		toastError("Failed to unlink app");
	} finally {
		isSaving.value = false;
	}
};
</script>
