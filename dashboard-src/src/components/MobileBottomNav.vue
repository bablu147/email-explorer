<template>
  <nav
    v-if="shouldShow"
    class="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 transition-colors"
    :style="{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))', paddingTop: '0.5rem' }"
  >
    <div class="grid grid-cols-5 items-center justify-around px-1">
      <!-- 1. Inbox -->
      <router-link
        :to="{ name: 'EmailList', params: { mailboxId, folder: 'inbox' } }"
        class="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer relative"
        :class="isInboxActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'"
      >
        <div class="relative">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span
            v-if="unreadCount > 0"
            class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs"
          >
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </div>
        <span class="text-[11px] tracking-tight">Inbox</span>
      </router-link>

      <!-- 2. Discover -->
      <router-link
        :to="{ name: 'DiscoverApps', params: { mailboxId } }"
        class="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer"
        :class="isDiscoverActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
        <span class="text-[11px] tracking-tight">Discover</span>
      </router-link>

      <!-- 2b. Pipeline -->
      <router-link
        :to="{ name: 'Pipeline', params: { mailboxId } }"
        class="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer"
        :class="isPipelineActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <span class="text-[11px] tracking-tight">Pipeline</span>
      </router-link>

      <!-- 3. Contacts -->
      <router-link
        :to="{ name: 'Contacts', params: { mailboxId } }"
        class="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer"
        :class="isContactsActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span class="text-[11px] tracking-tight">Contacts</span>
      </router-link>

      <!-- 4. Settings -->
      <router-link
        :to="{ name: 'Settings', params: { mailboxId } }"
        class="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer"
        :class="isSettingsActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span class="text-[11px] tracking-tight">Settings</span>
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useFolderStore } from "@/stores/folders";
import { useMailboxStore } from "@/stores/mailboxes";

const route = useRoute();
const authStore = useAuthStore();
const mailboxStore = useMailboxStore();
const folderStore = useFolderStore();

const mailboxId = computed(() => {
	return (
		(route.params.mailboxId as string) ||
		mailboxStore.currentMailbox?.id ||
		mailboxStore.mailboxes[0]?.id ||
		authStore.session?.email ||
		"default"
	);
});

const shouldShow = computed(() => {
	// Only show when authenticated or on mailbox views, hide on login/register/auth routes
	return (
		!["Login", "Register", "ForgotPassword", "ResetPassword"].includes(
			route.name as string,
		) && !!mailboxId.value
	);
});

const unreadCount = computed(() => {
	const inboxFolder = folderStore.folders.find((f) => f.id === "inbox");
	return inboxFolder?.unreadCount || 0;
});

const isInboxActive = computed(() => {
	return (
		(route.name === "EmailList" && route.params.folder === "inbox") ||
		route.name === "EmailDetail"
	);
});

const isDiscoverActive = computed(() => route.name === "DiscoverApps");
const isPipelineActive = computed(() => route.name === "Pipeline");
const isContactsActive = computed(() => route.name === "Contacts");
const isSettingsActive = computed(() => route.name === "Settings");
</script>
