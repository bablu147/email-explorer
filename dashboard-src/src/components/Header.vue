<template>
  <header class="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700/80 backdrop-blur-md sticky top-0 z-30 transition-colors">
    <!-- Left: Mailbox Switcher Dropdown & Live Search -->
    <div class="flex items-center gap-3 flex-1 max-w-2xl min-w-0">
      <!-- Quick Mailbox Switcher Dropdown -->
      <div v-if="currentMailboxId" class="relative flex-shrink-0" ref="mailboxDropdownRef">
        <button
          type="button"
          @click.stop="toggleMailboxMenu"
          class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-700/60 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600/70 transition-all cursor-pointer shadow-xs group"
          :title="'Current mailbox: ' + (activeMailbox?.email || 'Select Mailbox')"
        >
          <div class="w-5 h-5 rounded-md bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[11px] border border-emerald-500/30">
            {{ (activeMailbox?.name || 'M').charAt(0).toUpperCase() }}
          </div>
          <div class="flex flex-col text-left max-w-[130px] sm:max-w-[170px] truncate">
            <span class="truncate leading-tight font-bold text-gray-900 dark:text-white">{{ activeMailbox?.name || 'Mailbox' }}</span>
            <span class="truncate text-[10px] text-gray-500 dark:text-gray-400 font-normal leading-none mt-0.5">{{ activeMailbox?.email || '' }}</span>
          </div>
          <svg 
            class="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-transform duration-200"
            :class="{ 'rotate-180': isMailboxMenuOpen }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Dropdown Menu -->
        <div 
          v-if="isMailboxMenuOpen"
          class="absolute left-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        >
          <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Switch Mailbox</span>
            <router-link 
              to="/" 
              @click="isMailboxMenuOpen = false"
              class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View All
            </router-link>
          </div>

          <div class="max-h-64 overflow-y-auto py-1">
            <button
              v-for="mb in mailboxes"
              :key="mb.id"
              type="button"
              @click="switchMailbox(mb.id)"
              class="w-full px-3.5 py-2.5 flex items-center gap-3 text-left hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25 transition-colors cursor-pointer"
              :class="mb.id === currentMailboxId ? 'bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'"
            >
              <div 
                class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                :class="mb.id === currentMailboxId ? 'bg-emerald-500 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
              >
                {{ mb.name.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-grow min-w-0">
                <p class="text-xs font-bold truncate text-gray-900 dark:text-white">{{ mb.name }}</p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate">{{ mb.email }}</p>
              </div>
              <svg 
                v-if="mb.id === currentMailboxId" 
                class="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>

          <div class="p-2 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50">
            <router-link
              to="/"
              @click="isMailboxMenuOpen = false"
              class="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Manage Mailboxes</span>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Live Search Bar -->
      <div class="relative flex-1 min-w-[160px]">
        <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <svg class="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input 
          type="text" 
          v-model="searchQuery" 
          @keyup.enter="performSearch" 
          placeholder="Search all emails..." 
          class="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200" 
        />
      </div>
    </div>

    <!-- Right: Quick Navigation, Theme Toggle, & Profile Menu -->
    <div class="flex items-center gap-2 sm:gap-3 ml-4 flex-shrink-0">
      <!-- Dark / Light Mode Toggle Button -->
      <button
        type="button"
        @click="toggleTheme"
        class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-all cursor-pointer relative"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        aria-label="Toggle dark mode"
      >
        <!-- Sun icon (for dark mode -> switch to light) -->
        <svg 
          v-if="isDark" 
          class="w-5 h-5 text-amber-400 transform hover:rotate-45 transition-transform duration-300" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <!-- Moon icon (for light mode -> switch to dark) -->
        <svg 
          v-else 
          class="w-5 h-5 text-gray-600 transform hover:-rotate-12 transition-transform duration-300" 
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
        class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-all cursor-pointer"
        title="Mailbox Settings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <!-- User Profile Avatar Menu -->
      <div class="relative" ref="userMenuRef">
        <button
          type="button"
          @click.stop="toggleUserMenu"
          class="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all cursor-pointer group"
          :title="authStore.currentUser?.email || 'User Profile'"
        >
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-xs ring-2 ring-emerald-500/20">
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
import { useSearchStore } from "@/stores/search";

const searchQuery = ref("");
const searchStore = useSearchStore();
const mailboxStore = useMailboxStore();
const authStore = useAuthStore();
const { mailboxes } = storeToRefs(mailboxStore);
const route = useRoute();
const router = useRouter();

const { isDark, toggleTheme } = useTheme();

const isMailboxMenuOpen = ref(false);
const isUserMenuOpen = ref(false);
const mailboxDropdownRef = ref<HTMLElement | null>(null);
const userMenuRef = ref<HTMLElement | null>(null);

const currentMailboxId = computed(() => (route.params.mailboxId as string) || "");

const activeMailbox = computed(() => {
	if (!currentMailboxId.value) return null;
	return mailboxes.value.find((m) => m.id === currentMailboxId.value) || mailboxStore.currentMailbox;
});

const userInitial = computed(() => {
	const email = authStore.currentUser?.email || "U";
	return email.charAt(0).toUpperCase();
});

const toggleMailboxMenu = () => {
	isMailboxMenuOpen.value = !isMailboxMenuOpen.value;
	if (isMailboxMenuOpen.value) {
		isUserMenuOpen.value = false;
	}
};

const toggleUserMenu = () => {
	isUserMenuOpen.value = !isUserMenuOpen.value;
	if (isUserMenuOpen.value) {
		isMailboxMenuOpen.value = false;
	}
};

const switchMailbox = (targetId: string) => {
	isMailboxMenuOpen.value = false;
	const folder = (route.params.folder as string) || "inbox";
	router.push({
		name: "EmailList",
		params: { mailboxId: targetId, folder },
	});
};

const performSearch = () => {
	const mailboxId = currentMailboxId.value;
	if (!mailboxId) return;
	searchStore.searchEmails(mailboxId, searchQuery.value);
	router.push({ name: "SearchResults", params: { mailboxId } });
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
	if (mailboxDropdownRef.value && !mailboxDropdownRef.value.contains(target)) {
		isMailboxMenuOpen.value = false;
	}
	if (userMenuRef.value && !userMenuRef.value.contains(target)) {
		isUserMenuOpen.value = false;
	}
};

onMounted(() => {
	if (mailboxes.value.length === 0) {
		mailboxStore.fetchMailboxes();
	}
	document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
	document.removeEventListener("click", handleClickOutside);
});
</script>
