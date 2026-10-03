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
                  <span class="text-sm flex-shrink-0">{{ item.icon }}</span>
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
                <span class="text-emerald-500">🔍</span>
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
		icon: "✍️",
		shortcut: "c",
		category: "action",
		execute: () => {
			uiStore.openComposeModal();
		},
	},
	{
		id: "nav-inbox",
		label: "Go to Inbox",
		icon: "📥",
		shortcut: "g i",
		category: "navigation",
		execute: () => {
			router.push({ name: "EmailList", params: { mailboxId: mailboxId.value, folder: "inbox" } });
		},
	},
	{
		id: "nav-starred",
		label: "Go to Starred",
		icon: "⭐",
		category: "navigation",
		execute: () => {
			router.push({ name: "EmailList", params: { mailboxId: mailboxId.value, folder: "starred" } });
		},
	},
	{
		id: "nav-sent",
		label: "Go to Sent",
		icon: "📤",
		category: "navigation",
		execute: () => {
			router.push({ name: "EmailList", params: { mailboxId: mailboxId.value, folder: "sent" } });
		},
	},
	{
		id: "nav-drafts",
		label: "Go to Drafts",
		icon: "📝",
		category: "navigation",
		execute: () => {
			router.push({ name: "EmailList", params: { mailboxId: mailboxId.value, folder: "drafts" } });
		},
	},
	{
		id: "nav-discover",
		label: "Discover Apps & MMP Outreach",
		icon: "🎯",
		category: "navigation",
		execute: () => {
			router.push({ name: "DiscoverApps", params: { mailboxId: mailboxId.value } });
		},
	},
	{
		id: "nav-contacts",
		label: "Contacts Directory",
		icon: "👥",
		category: "navigation",
		execute: () => {
			router.push({ name: "Contacts", params: { mailboxId: mailboxId.value } });
		},
	},
	{
		id: "nav-settings",
		label: "Mailbox Settings",
		icon: "⚙️",
		category: "navigation",
		execute: () => {
			router.push({ name: "Settings", params: { mailboxId: mailboxId.value } });
		},
	},
	{
		id: "action-toggle-theme",
		label: "Toggle Dark / Light Mode",
		icon: "🌓",
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
		icon: "⚡",
		category: "action",
		execute: () => {
			uiStore.toggleSplitViewMode();
			showSuccessToast(`Reading pane: ${uiStore.splitViewMode === "split" ? "Split" : "Full"}`);
		},
	},
	{
		id: "action-toggle-sidebar",
		label: "Toggle Sidebar Collapse",
		icon: "📂",
		category: "action",
		execute: () => {
			uiStore.toggleSidebarCollapsed();
		},
	},
	{
		id: "action-refresh",
		label: "Refresh Mailbox & Folders",
		icon: "🔄",
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
