<template>
  <aside class="w-64 sm:w-72 bg-white dark:bg-gray-900 p-5 sm:p-6 border-r border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0 transition-colors">
    <!-- Compose Button: Bold Emerald-600 with subtle glow -->
    <button 
      @click="openComposeModal" 
      class="w-full mb-6 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transform hover:-translate-y-0.5 transition-all duration-200 font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer select-none"
    >
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
      </svg>
      <span>Compose</span>
    </button>

    <!-- Navigation Menu -->
    <nav class="flex-1 overflow-y-auto space-y-6 pr-1">
      <!-- Standard Mailbox Folders -->
      <ul class="space-y-1">
        <!-- Inbox -->
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'inbox' } }" 
            class="flex items-center justify-between py-2.5 px-3.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 transition-all duration-150 group text-sm font-medium"
            active-class="bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs border-r-2 border-emerald-500"
          >
            <div class="flex items-center gap-3 min-w-0">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <span class="truncate">Inbox</span>
            </div>
            <span 
              v-if="getFolderUnread('inbox') > 0" 
              class="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 ml-2 flex-shrink-0"
            >
              {{ getFolderUnread('inbox') }}
            </span>
          </router-link>
        </li>

        <!-- Sent -->
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'sent' } }" 
            class="flex items-center justify-between py-2.5 px-3.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 transition-all duration-150 group text-sm font-medium"
            active-class="bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs border-r-2 border-emerald-500"
          >
            <div class="flex items-center gap-3 min-w-0">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span class="truncate">Sent</span>
            </div>
          </router-link>
        </li>

        <!-- Drafts -->
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'drafts' } }" 
            class="flex items-center justify-between py-2.5 px-3.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 transition-all duration-150 group text-sm font-medium"
            active-class="bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs border-r-2 border-emerald-500"
          >
            <div class="flex items-center gap-3 min-w-0">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span class="truncate">Drafts</span>
            </div>
            <span 
              v-if="getFolderUnread('drafts') > 0" 
              class="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 ml-2 flex-shrink-0"
            >
              {{ getFolderUnread('drafts') }}
            </span>
          </router-link>
        </li>

        <!-- Archive -->
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'archive' } }" 
            class="flex items-center justify-between py-2.5 px-3.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 transition-all duration-150 group text-sm font-medium"
            active-class="bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs border-r-2 border-emerald-500"
          >
            <div class="flex items-center gap-3 min-w-0">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span class="truncate">Archive</span>
            </div>
          </router-link>
        </li>

        <!-- Trash -->
        <li>
          <router-link 
            :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'trash' } }" 
            class="flex items-center justify-between py-2.5 px-3.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-red-50/60 dark:hover:bg-red-950/20 transition-all duration-150 group text-sm font-medium"
            active-class="bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-400 font-bold shadow-xs border-r-2 border-red-500"
          >
            <div class="flex items-center gap-3 min-w-0">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span class="truncate">Trash</span>
            </div>
          </router-link>
        </li>
      </ul>

      <!-- Custom Folders Section -->
      <div>
        <div class="flex items-center justify-between px-3.5 mb-2">
          <h2 class="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Custom Folders</h2>
          <button 
            @click="createNewFolder" 
            class="p-1 text-gray-400 hover:text-emerald-600 dark:text-gray-500 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
            title="Create new custom folder"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <ul v-if="customFolders.length > 0" class="space-y-1">
          <li v-for="folder in customFolders" :key="folder.id" class="group/item relative">
            <router-link 
              :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: folder.id } }" 
              class="flex items-center justify-between py-2 px-3.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 transition-all duration-150 group text-sm font-medium"
              active-class="bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs border-r-2 border-emerald-500"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <svg class="w-4 h-4 text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span class="truncate">{{ folder.name }}</span>
              </div>

              <!-- Unread counter or action buttons on hover -->
              <div class="flex items-center gap-1">
                <!-- Unread counter badge (visible when not hovering folder item) -->
                <span 
                  v-if="folder.unreadCount > 0" 
                  class="group-hover/item:hidden px-1.5 py-0.2 text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                >
                  {{ folder.unreadCount }}
                </span>

                <!-- Quick Folder Action Buttons (visible on hover) -->
                <div class="hidden group-hover/item:flex items-center gap-0.5">
                  <button
                    type="button"
                    @click.stop.prevent="renameFolder(folder)"
                    class="p-1 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    title="Rename folder"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    @click.stop.prevent="deleteFolder(folder)"
                    class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    title="Delete folder"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </router-link>
          </li>
        </ul>

        <div v-else class="px-3.5 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
          No custom folders
        </div>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useFolderStore } from "@/stores/folders";
import { useUIStore } from "@/stores/ui";
import type { Folder } from "@/types";

const folderStore = useFolderStore();
const { folders } = storeToRefs(folderStore);
const uiStore = useUIStore();
const route = useRoute();

const defaultFolderIds = ["archive", "inbox", "sent", "spam", "trash", "draft", "drafts"];

const customFolders = computed(() => {
	return folders.value.filter(
		(folder) =>
			!defaultFolderIds.includes(folder.name.toLowerCase()) &&
			!defaultFolderIds.includes(folder.id.toLowerCase()),
	);
});

const getFolderUnread = (folderId: string): number => {
	const f = folders.value.find(
		(folder) =>
			folder.id.toLowerCase() === folderId.toLowerCase() ||
			folder.name.toLowerCase() === folderId.toLowerCase(),
	);
	return f ? f.unreadCount || 0 : 0;
};

onMounted(() => {
	if (route.params.mailboxId) {
		folderStore.fetchFolders(route.params.mailboxId as string);
	}
});

const openComposeModal = () => {
	uiStore.openComposeModal();
};

const createNewFolder = async () => {
	const folderName = prompt("Enter a name for the new folder:");
	if (folderName && folderName.trim()) {
		await folderStore.createFolder(route.params.mailboxId as string, folderName.trim());
	}
};

const renameFolder = async (folder: Folder) => {
	const newName = prompt(`Rename folder "${folder.name}" to:`, folder.name);
	if (newName && newName.trim() && newName.trim() !== folder.name) {
		await folderStore.updateFolder(route.params.mailboxId as string, folder.id, newName.trim());
	}
};

const deleteFolder = async (folder: Folder) => {
	if (confirm(`Are you sure you want to delete custom folder "${folder.name}"?`)) {
		await folderStore.deleteFolder(route.params.mailboxId as string, folder.id);
	}
};
</script>
