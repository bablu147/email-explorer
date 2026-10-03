<template>
  <Teleport to="body">
    <div
      v-if="uiStore.isCommandPaletteOpen"
      class="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
      @click.self="closePalette"
      @keydown.esc="closePalette"
    >
      <div
        class="w-full max-w-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] transition-colors"
        role="dialog"
        aria-modal="true"
      >
        <!-- Search Input Bar -->
        <div class="px-4 py-3.5 border-b border-gray-100 dark:border-gray-800/80 flex items-center gap-3">
          <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Type a command, search contacts, apps, or folders..."
            class="flex-1 bg-transparent border-none text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            @keydown.down.prevent="navigateDown"
            @keydown.up.prevent="navigateUp"
            @keydown.enter.prevent="executeActiveItem"
          />
          <kbd class="px-2 py-0.5 text-[10px] font-mono font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
            ESC
          </kbd>
        </div>

        <!-- Results / Commands Stream -->
        <div class="flex-1 overflow-y-auto p-2 space-y-4 text-xs select-none" ref="listContainerRef">
          <!-- 1. Matching Actions & Commands -->
          <div v-if="filteredActions.length > 0">
            <div class="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Actions
            </div>
            <div class="space-y-0.5 mt-1">
              <button
                v-for="item in filteredActions"
                :key="item.id"
                type="button"
                @click="executeItem(item)"
                @mouseenter="setActiveId(item.id)"
                class="w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
                :class="activeId === item.id ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-4 h-4 flex-shrink-0 flex items-center justify-center text-gray-500 dark:text-gray-400" :class="activeId === item.id ? 'text-emerald-600 dark:text-emerald-400' : ''">
                    <!-- compose -->
                    <svg v-if="item.icon === 'compose'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    <!-- inbox -->
                    <svg v-else-if="item.icon === 'inbox'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                    <!-- starred -->
                    <svg v-else-if="item.icon === 'starred'" class="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    <!-- sent -->
                    <svg v-else-if="item.icon === 'sent'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    <!-- drafts -->
                    <svg v-else-if="item.icon === 'drafts'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    <!-- discover -->
                    <svg v-else-if="item.icon === 'discover'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
                    <!-- contacts -->
                    <!-- pipeline -->
                    <svg v-else-if="item.icon === 'pipeline'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                    <svg v-else-if="item.icon === 'contacts'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    <!-- settings -->
                    <svg v-else-if="item.icon === 'settings'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <!-- theme -->
                    <svg v-else-if="item.icon === 'theme'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                    <!-- split -->
                    <svg v-else-if="item.icon === 'split'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>
                    <!-- sidebar -->
                    <svg v-else-if="item.icon === 'sidebar'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/></svg>
                    <!-- refresh -->
                    <svg v-else-if="item.icon === 'refresh'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  </span>
                  <span class="truncate">{{ item.label }}</span>
                </div>
                <kbd v-if="item.shortcut" class="px-1.5 py-0.5 text-[10px] font-mono rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  {{ item.shortcut }}
                </kbd>
              </button>
            </div>
          </div>

          <!-- 2. Matching Contacts -->
          <div v-if="filteredContacts.length > 0">
            <div class="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Contacts
            </div>
            <div class="space-y-0.5 mt-1">
              <button
                v-for="item in filteredContacts"
                :key="item.id"
                type="button"
                @click="executeItem(item)"
                @mouseenter="setActiveId(item.id)"
                class="w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
                :class="activeId === item.id ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                    {{ (item.contact.name || item.contact.email).charAt(0).toUpperCase() }}
                  </div>
                  <div class="truncate">
                    <span class="font-bold text-gray-900 dark:text-white mr-2">{{ item.contact.name }}</span>
                    <span class="text-gray-400 font-mono text-[11px]">{{ item.contact.email }}</span>
                  </div>
                </div>
                <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Compose &rarr;</span>
              </button>
            </div>
          </div>

          <!-- 3. Matching Bound Apps -->
          <div v-if="filteredApps.length > 0">
            <div class="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Bound Mobile Apps
            </div>
            <div class="space-y-0.5 mt-1">
              <button
                v-for="item in filteredApps"
                :key="item.id"
                type="button"
                @click="executeItem(item)"
                @mouseenter="setActiveId(item.id)"
                class="w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
                :class="activeId === item.id ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <img :src="item.binding.app_icon_url" class="w-6 h-6 rounded-md object-cover border border-gray-200 dark:border-gray-700 flex-shrink-0" />
                  <div class="truncate">
                    <span class="font-bold text-gray-900 dark:text-white mr-2">{{ item.binding.app_name }}</span>
                    <span class="text-gray-400 text-[11px]">{{ item.binding.email }}</span>
                  </div>
                </div>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase">
                  {{ item.binding.platform }}
                </span>
              </button>
            </div>
          </div>

          <!-- 4. Global Full-Text Email Search CTA -->
          <div v-if="query.trim()">
            <div class="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Email Search
            </div>
            <button
              type="button"
              @click="searchAllEmails"
              @mouseenter="setActiveId('email-search-cta')"
              class="w-full mt-1 px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
              :class="activeId === 'email-search-cta' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'"
            >
              <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Search all emails matching <span class="font-bold underline">"{{ query.trim() }}"</span></span>
              </div>
              <span class="text-gray-400">&crarr; Enter</span>
            </button>
          </div>

          <!-- No results at all -->
          <div
            v-if="filteredActions.length === 0 && filteredContacts.length === 0 && filteredApps.length === 0 && !query.trim()"
            class="px-4 py-8 text-center text-gray-400 text-xs"
          >
            Type a command or query to search
          </div>
        </div>

        <!-- Footer Cheatsheet -->
        <div class="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
          <div class="flex items-center gap-3">
            <span><kbd class="font-mono font-bold">&uarr;&darr;</kbd> Navigate</span>
            <span><kbd class="font-mono font-bold">&crarr;</kbd> Select</span>
            <span><kbd class="font-mono font-bold">ESC</kbd> Close</span>
          </div>
          <span class="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">Reflect Command Palette</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import { useAppBindingsStore } from "@/stores/appBindings";
import { useContactStore } from "@/stores/contacts";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import { useMailboxStore } from "@/stores/mailboxes";
import { useUIStore } from "@/stores/ui";
import type { AppBinding, Contact } from "@/types";

const uiStore = useUIStore();
const mailboxStore = useMailboxStore();
const contactStore = useContactStore();
const appBindingsStore = useAppBindingsStore();
const emailStore = useEmailStore();
const folderStore = useFolderStore();
const router = useRouter();
const route = useRoute();
const { success: showSuccessToast } = useToast();

const query = ref("");
const activeId = ref<string>("");
const inputRef = ref<HTMLInputElement | null>(null);
const listContainerRef = ref<HTMLElement | null>(null);

const mailboxId = computed(() => (route.params.mailboxId as string) || mailboxStore.currentMailbox?.id || "");

interface PaletteItem {
	id: string;
	label: string;
	icon: string;
	shortcut?: string;
	category: "action" | "navigation" | "contact" | "app";
	execute: () => void;
}

const baseActions: PaletteItem[] = [
	{
		id: "action-compose",
		label: "Compose New Email",
		icon: "compose",
		shortcut: "c",
		category: "action",
		execute: () => {
			uiStore.openComposeModal();
		},
	},
	{
		id: "nav-inbox",
		label: "Go to Inbox",
		icon: "inbox",
		shortcut: "g i",
		category: "navigation",
		execute: () => {
			router.push({ name: "EmailList", params: { mailboxId: mailboxId.value, folder: "inbox" } });
		},
	},
	{
		id: "nav-starred",
		label: "Go to Starred",
		icon: "starred",
		category: "navigation",
		execute: () => {
			router.push({ name: "EmailList", params: { mailboxId: mailboxId.value, folder: "starred" } });
		},
	},
	{
		id: "nav-sent",
		label: "Go to Sent",
		icon: "sent",
		category: "navigation",
		execute: () => {
			router.push({ name: "EmailList", params: { mailboxId: mailboxId.value, folder: "sent" } });
		},
	},
	{
		id: "nav-drafts",
		label: "Go to Drafts",
		icon: "drafts",
		category: "navigation",
		execute: () => {
			router.push({ name: "EmailList", params: { mailboxId: mailboxId.value, folder: "drafts" } });
		},
	},
	{
		id: "nav-discover",
		label: "Discover Apps & MMP Outreach",
		icon: "discover",
		category: "navigation",
		execute: () => {
			router.push({ name: "DiscoverApps", params: { mailboxId: mailboxId.value } });
		},
	},
	{
		id: "nav-pipeline",
		label: "Outreach Pipeline",
		icon: "pipeline",
		category: "navigation",
		execute: () => {
			router.push({ name: "Pipeline", params: { mailboxId: mailboxId.value } });
		},
	},
	{
		id: "nav-contacts",
		label: "Contacts Directory",
		icon: "contacts",
		category: "navigation",
		execute: () => {
			router.push({ name: "Contacts", params: { mailboxId: mailboxId.value } });
		},
	},
	{
		id: "nav-settings",
		label: "Mailbox Settings",
		icon: "settings",
		category: "navigation",
		execute: () => {
			router.push({ name: "Settings", params: { mailboxId: mailboxId.value } });
		},
	},
	{
		id: "action-toggle-theme",
		label: "Toggle Dark / Light Mode",
		icon: "theme",
		shortcut: "t",
		category: "action",
		execute: () => {
			const isDark = document.documentElement.classList.contains("dark");
			if (isDark) {
				document.documentElement.classList.remove("dark");
				localStorage.setItem("theme", "light");
			} else {
				document.documentElement.classList.add("dark");
				localStorage.setItem("theme", "dark");
			}
			showSuccessToast(`Switched to ${isDark ? "Light" : "Dark"} mode`);
		},
	},
	{
		id: "action-toggle-split",
		label: "Toggle Reading Pane (Split / Full Width)",
		icon: "split",
		category: "action",
		execute: () => {
			uiStore.toggleSplitViewMode();
			showSuccessToast(`Reading pane: ${uiStore.splitViewMode === "split" ? "Split" : "Full"}`);
		},
	},
	{
		id: "action-toggle-sidebar",
		label: "Toggle Sidebar Collapse",
		icon: "sidebar",
		category: "action",
		execute: () => {
			uiStore.toggleSidebarCollapsed();
		},
	},
	{
		id: "action-refresh",
		label: "Refresh Mailbox & Folders",
		icon: "refresh",
		category: "action",
		execute: () => {
			if (mailboxId.value) {
				emailStore.fetchEmails(mailboxId.value, { folder: "inbox" });
				folderStore.fetchFolders(mailboxId.value);
				appBindingsStore.fetchBindings(true);
				showSuccessToast("Mailbox refreshed");
			}
		},
	},
];

const filteredActions = computed(() => {
	const q = query.value.trim().toLowerCase();
	if (!q) return baseActions;
	return baseActions.filter((a) => a.label.toLowerCase().includes(q));
});

const filteredContacts = computed(() => {
	const q = query.value.trim().toLowerCase();
	if (!q) return [];
	return contactStore.contacts
		.filter((c) => (c.name && c.name.toLowerCase().includes(q)) || (c.email && c.email.toLowerCase().includes(q)))
		.slice(0, 5)
		.map((c) => ({
			id: `contact-${c.id}`,
			contact: c,
			category: "contact" as const,
			execute: () => {
				uiStore.openComposeModal({
					mode: "new",
					initialTo: c.email,
					initialSubject: `Reflect MMP Partnership`,
				});
			},
		}));
});

const filteredApps = computed(() => {
	const q = query.value.trim().toLowerCase();
	if (!q) return [];
	return appBindingsStore.bindings
		.filter((b) => (b.app_name && b.app_name.toLowerCase().includes(q)) || (b.email && b.email.toLowerCase().includes(q)))
		.slice(0, 5)
		.map((b) => ({
			id: `app-${b.email}`,
			binding: b,
			category: "app" as const,
			execute: () => {
				uiStore.openComposeModal({
					mode: "new",
					initialTo: b.email,
					initialSubject: `Attribution & Growth for ${b.app_name} | Reflect MMP`,
					appBinding: b,
				});
			},
		}));
});

const allSelectableItems = computed(() => {
	const list: { id: string; execute: () => void }[] = [];
	for (const a of filteredActions.value) list.push(a);
	for (const c of filteredContacts.value) list.push(c);
	for (const ap of filteredApps.value) list.push(ap);
	if (query.value.trim()) {
		list.push({ id: "email-search-cta", execute: searchAllEmails });
	}
	return list;
});

watch(
	() => allSelectableItems.value,
	(items) => {
		if (items.length > 0) {
			if (!items.some((i) => i.id === activeId.value)) {
				activeId.value = items[0].id;
			}
		} else {
			activeId.value = "";
		}
	},
	{ immediate: true },
);

watch(
	() => uiStore.isCommandPaletteOpen,
	(open) => {
		if (open) {
			query.value = "";
			nextTick(() => {
				inputRef.value?.focus();
			});
		}
	},
);

const setActiveId = (id: string) => {
	activeId.value = id;
};

const navigateDown = () => {
	const items = allSelectableItems.value;
	if (items.length === 0) return;
	const idx = items.findIndex((i) => i.id === activeId.value);
	if (idx === -1 || idx === items.length - 1) {
		activeId.value = items[0].id;
	} else {
		activeId.value = items[idx + 1].id;
	}
};

const navigateUp = () => {
	const items = allSelectableItems.value;
	if (items.length === 0) return;
	const idx = items.findIndex((i) => i.id === activeId.value);
	if (idx <= 0) {
		activeId.value = items[items.length - 1].id;
	} else {
		activeId.value = items[idx - 1].id;
	}
};

const executeActiveItem = () => {
	const item = allSelectableItems.value.find((i) => i.id === activeId.value);
	if (item) {
		executeItem(item);
	}
};

const executeItem = (item: { execute: () => void }) => {
	closePalette();
	item.execute();
};

const searchAllEmails = () => {
	const q = query.value.trim();
	if (!q) return;
	closePalette();
	router.push({
		name: "SearchResults",
		params: { mailboxId: mailboxId.value },
		query: { q },
	});
};

const closePalette = () => {
	uiStore.closeCommandPalette();
};

const handleGlobalKeyDown = (e: KeyboardEvent) => {
	// Cmd + K (Mac) or Ctrl + K (Windows)
	if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
		e.preventDefault();
		uiStore.toggleCommandPalette();
	}
};

onMounted(() => {
	window.addEventListener("keydown", handleGlobalKeyDown);
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", handleGlobalKeyDown);
});
</script>
