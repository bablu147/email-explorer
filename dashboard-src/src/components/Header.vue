<template>
  <header class="h-14 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 transition-colors">
    <!-- Left: Mobile Menu Toggle & Omni-Search Bar -->
    <div class="flex items-center gap-2 sm:gap-3 flex-1 max-w-xl min-w-0">
      <!-- Mobile Drawer Hamburger Button -->
      <button
        type="button"
        @click="uiStore.toggleMobileSidebar"
        class="lg:hidden p-2 -ml-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex-shrink-0"
        title="Open menu"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <!-- Omni-Search Bar & Command Palette Launcher -->
      <button 
        type="button"
        @click="uiStore.openCommandPalette"
        class="relative flex-1 min-w-[200px] max-w-md flex items-center justify-between pl-9 pr-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/80 dark:hover:bg-gray-800 rounded-xl text-gray-400 dark:text-gray-400 text-left transition-all cursor-pointer group shadow-2xs"
        title="Open Command Palette (⌘K)"
      >
        <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg class="h-3.5 w-3.5 text-gray-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <span class="truncate">Search emails, contacts, commands...</span>
        <kbd class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 shadow-2xs">
          ⌘K
        </kbd>
      </button>
    </div>

    <!-- Right: External Links, Theme Toggle, Settings, & Profile Menu -->
    <div class="flex items-center gap-1 sm:gap-2 ml-4 flex-shrink-0">
      <!-- External Links to Console & Docs -->
      <a 
        href="https://reflect.cloud" 
        target="_blank" 
        rel="noopener noreferrer"
        class="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Open Reflect Console"
      >
        <span>Console</span>
        <span class="text-[11px] opacity-70">&rarr;</span>
      </a>
      <a 
        href="https://docs.reflect.cloud" 
        target="_blank" 
        rel="noopener noreferrer"
        class="hidden lg:inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Open Documentation"
      >
        <span>Docs</span>
      </a>

      <div class="hidden lg:block h-4 w-px bg-gray-200 dark:border-gray-800 mx-1"></div>

      <!-- Dark / Light Mode Toggle Button -->
      <button
        type="button"
        @click="toggleTheme"
        class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        aria-label="Toggle dark mode"
      >
        <!-- Sun icon (for dark mode -> switch to light) -->
        <svg 
          v-if="isDark" 
          class="w-4 h-4 text-amber-400 transform hover:rotate-45 transition-transform duration-300" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <!-- Moon icon (for light mode -> switch to dark) -->
        <svg 
          v-else 
          class="w-4 h-4 text-gray-600 transform hover:-rotate-12 transition-transform duration-300" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>

      <!-- Settings Icon Button -->
      <button 
        type="button" 
        @click="handleSettingsClick" 
        class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
        title="Mailbox Settings"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <!-- User Profile Avatar Menu -->
      <div class="relative" ref="userMenuRef">
        <button
          type="button"
          @click.stop="toggleUserMenu"
          class="flex items-center gap-1.5 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer group"
          :title="authStore.currentUser?.email || 'User Profile'"
        >
          <div class="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {{ userInitial }}
          </div>
          <svg 
            class="w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-transform duration-200"
            :class="{ 'rotate-180': isUserMenuOpen }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- User Profile Dropdown -->
        <div 
          v-if="isUserMenuOpen"
          class="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        >
          <!-- User Info Banner -->
          <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/40">
            <p class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Signed in as</p>
            <p class="text-xs font-bold text-gray-900 dark:text-white truncate mt-0.5" :title="authStore.currentUser?.email">
              {{ authStore.currentUser?.email }}
            </p>
            <div class="mt-1.5 flex items-center gap-1.5">
              <span 
                v-if="authStore.isAdmin" 
                class="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              >
                Admin
              </span>
              <span class="text-[11px] text-gray-400">Reflect Mail</span>
            </div>
          </div>

          <!-- Quick Mailbox Switcher Section -->
          <div v-if="mailboxes.length > 0" class="py-1 border-b border-gray-100 dark:border-gray-700/60">
            <div class="px-4 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <span>Switch Mailbox</span>
              <router-link to="/" @click="isUserMenuOpen = false" class="text-emerald-600 dark:text-emerald-400 hover:underline capitalize font-semibold">
                Hub
              </router-link>
            </div>
            <div class="max-h-48 overflow-y-auto">
              <button
                v-for="mb in mailboxes"
                :key="mb.id"
                type="button"
                @click="switchMailbox(mb.id)"
                class="w-full px-4 py-2 flex items-center gap-2.5 text-left hover:bg-emerald-50/60 dark:hover:bg-emerald-950/25 transition-colors cursor-pointer group"
                :class="mb.id === currentMailboxId ? 'bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-700 dark:text-gray-300'"
              >
                <div 
                  class="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] flex-shrink-0"
                  :class="mb.id === currentMailboxId ? 'bg-emerald-500 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
                >
                  {{ mb.name.charAt(0).toUpperCase() }}
                </div>
                <div class="flex-grow min-w-0">
                  <p class="text-xs truncate font-medium group-hover:text-gray-900 dark:group-hover:text-white">{{ mb.name }}</p>
                  <p class="text-[10px] text-gray-400 truncate">{{ mb.email }}</p>
                </div>
                <svg 
                  v-if="mb.id === currentMailboxId" 
                  class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>

          <div class="py-1">
            <!-- Mailboxes Link -->
            <router-link
              to="/"
              @click="isUserMenuOpen = false"
              class="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/25 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
              <span>Mailboxes Hub</span>
            </router-link>

            <!-- Admin Panel Link (if admin) -->
            <router-link
              v-if="authStore.isAdmin"
              to="/admin"
              @click="isUserMenuOpen = false"
              class="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/25 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Admin Panel</span>
            </router-link>
          </div>

          <!-- Divider & Logout -->
          <div class="border-t border-gray-100 dark:border-gray-700/60 pt-1 mt-1">
            <button
              type="button"
              @click="handleLogout"
              class="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-950/25 transition-colors cursor-pointer text-left"
            >
              <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTheme } from "@/composables/useTheme";
import { useAuthStore } from "@/stores/auth";
import { useMailboxStore } from "@/stores/mailboxes";
import { useUIStore } from "@/stores/ui";

const uiStore = useUIStore();
const mailboxStore = useMailboxStore();
const authStore = useAuthStore();
const { mailboxes } = storeToRefs(mailboxStore);
const route = useRoute();
const router = useRouter();

const { isDark, toggleTheme } = useTheme();

const isUserMenuOpen = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);

const currentMailboxId = computed(() => (route.params.mailboxId as string) || "");

const userInitial = computed(() => {
	const email = authStore.currentUser?.email || "U";
	return email.charAt(0).toUpperCase();
});

const toggleUserMenu = () => {
	isUserMenuOpen.value = !isUserMenuOpen.value;
	if (isUserMenuOpen.value && mailboxes.value.length === 0) {
		mailboxStore.fetchMailboxes();
	}
};

const switchMailbox = (targetId: string) => {
	isUserMenuOpen.value = false;
	if (targetId === currentMailboxId.value) return;
	mailboxStore.fetchMailbox(targetId);
	const standardFolders = ["inbox", "sent", "drafts", "draft", "archive", "trash", "spam"];
	const currentFolder = (route.params.folder as string) || "inbox";
	const folder = standardFolders.includes(currentFolder.toLowerCase()) ? currentFolder : "inbox";
	router.push({
		name: "EmailList",
		params: { mailboxId: targetId, folder },
	});
};

const handleSettingsClick = () => {
	const mailboxId = currentMailboxId.value;
	if (route.name === "Settings") {
		if (mailboxId) {
			router.push({
				name: "EmailList",
				params: { mailboxId, folder: "inbox" },
			});
		} else {
			router.push("/");
		}
	} else {
		if (mailboxId) {
			router.push({ name: "Settings", params: { mailboxId } });
		} else {
			router.push("/");
		}
	}
};

const handleLogout = async () => {
	isUserMenuOpen.value = false;
	await authStore.logout();
	router.push("/login");
};

const handleClickOutside = (event: MouseEvent) => {
	const target = event.target as Node;
	if (userMenuRef.value && !userMenuRef.value.contains(target)) {
		isUserMenuOpen.value = false;
	}
};

const handleKeydown = (event: KeyboardEvent) => {
	if (event.key === "Escape") {
		isUserMenuOpen.value = false;
	}
};

onMounted(() => {
	if (mailboxes.value.length === 0) {
		mailboxStore.fetchMailboxes();
	}
	document.addEventListener("click", handleClickOutside);
	document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
	document.removeEventListener("click", handleClickOutside);
	document.removeEventListener("keydown", handleKeydown);
});
</script>
