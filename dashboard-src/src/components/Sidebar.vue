<template>
  <div>
    <!-- Mobile Drawer Backdrop -->
    <div 
      v-if="uiStore.isMobileSidebarOpen" 
      @click="uiStore.closeMobileSidebar" 
      class="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
    ></div>

    <aside 
      class="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0 h-full p-4 select-none transition-all duration-200 fixed lg:static inset-y-0 left-0 z-50 overflow-hidden"
      :class="[
        uiStore.isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0',
        uiStore.sidebarCollapsed ? 'lg:w-20 lg:p-3' : 'w-72 lg:w-64 xl:w-68 sm:p-5'
      ]"
    >
      <!-- Brand Header -->
      <div class="flex items-center justify-between mb-5 px-1 flex-shrink-0">
        <router-link to="/" class="flex items-center gap-2.5 group min-w-0">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="flex-shrink-0 transition-transform group-hover:scale-105">
            <rect width="32" height="32" rx="7" fill="#0A0F0C"/>
            <text x="16" y="22" text-anchor="middle" font-family="'Inter', sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">R</text>
            <path d="M 22.5 9 L 25 9 L 25 11.5" stroke="#4ED49B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div v-if="!uiStore.sidebarCollapsed" class="flex items-center gap-1.5 truncate">
            <span class="font-extrabold text-base text-gray-900 dark:text-white tracking-tight group-hover:text-emerald-500 transition-colors">Reflect</span>
            <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Mail</span>
          </div>
        </router-link>

        <!-- Right side: Close button on mobile / internal badge on desktop -->
        <div class="flex items-center gap-1">
          <span v-if="!uiStore.sidebarCollapsed" class="hidden sm:inline text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">internal</span>
          <button 
            type="button"
            @click="uiStore.closeMobileSidebar"
            class="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Close menu"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Compose Button -->
      <button 
        type="button"
        @click="openComposeModal" 
        class="w-full mb-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transform hover:-translate-y-0.5 transition-all duration-200 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
        :class="uiStore.sidebarCollapsed ? 'p-2.5' : 'px-4 py-2.5'"
        :title="uiStore.sidebarCollapsed ? 'Compose Email (c)' : ''"
      >
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
        </svg>
        <span v-if="!uiStore.sidebarCollapsed">Compose</span>
      </button>

      <!-- App Discovery & MMP Outreach -->
      <div class="mb-4">
        <router-link
          :to="{ name: 'DiscoverApps', params: { mailboxId: route.params.mailboxId } }"
          class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-all text-xs sm:text-sm font-medium group"
          :class="[
            uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
            route.name === 'DiscoverApps' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold border-r-2 border-emerald-500' : ''
          ]"
          :title="uiStore.sidebarCollapsed ? 'Discover Apps & Outreach' : ''"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <svg class="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke-width="2" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" stroke-width="1.5" />
            </svg>
            <span v-if="!uiStore.sidebarCollapsed" class="truncate">Discover Apps</span>
          </div>
          <span v-if="!uiStore.sidebarCollapsed" class="px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            MMP
          </span>
        </router-link>
      </div>

      <!-- Navigation Menu -->
      <nav class="flex-1 overflow-y-auto space-y-5 pr-1">
        <!-- Standard Mailbox Folders -->
        <ul class="space-y-1">
          <!-- Inbox -->
          <li>
            <router-link 
              :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'inbox' } }" 
              class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-all text-xs sm:text-sm font-medium group"
              :class="[
                uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
                isFolderActive('inbox') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold border-r-2 border-emerald-500' : ''
              ]"
              :title="uiStore.sidebarCollapsed ? `Inbox (${getFolderUnread('inbox')})` : ''"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <span v-if="!uiStore.sidebarCollapsed" class="truncate">Inbox</span>
              </div>
              <span 
                v-if="!uiStore.sidebarCollapsed && getFolderUnread('inbox') > 0" 
                class="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 ml-2 flex-shrink-0"
              >
                {{ getFolderUnread('inbox') }}
              </span>
            </router-link>
          </li>

          <!-- Starred -->
          <li>
            <router-link 
              :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'starred' } }" 
              class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-amber-50/70 dark:hover:bg-amber-950/20 transition-all text-xs sm:text-sm font-medium group"
              :class="[
                uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
                isFolderActive('starred') ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold border-r-2 border-amber-500' : ''
              ]"
              :title="uiStore.sidebarCollapsed ? 'Starred' : ''"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <svg class="w-4 h-4 text-amber-400 group-hover:text-amber-500 transition-colors flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span v-if="!uiStore.sidebarCollapsed" class="truncate">Starred</span>
              </div>
            </router-link>
          </li>

          <!-- Sent -->
          <li>
            <router-link 
              :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'sent' } }" 
              class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-all text-xs sm:text-sm font-medium group"
              :class="[
                uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
                isFolderActive('sent') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold border-r-2 border-emerald-500' : ''
              ]"
              :title="uiStore.sidebarCollapsed ? 'Sent' : ''"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span v-if="!uiStore.sidebarCollapsed" class="truncate">Sent</span>
              </div>
            </router-link>
          </li>

          <!-- Drafts -->
          <li>
            <router-link 
              :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'drafts' } }" 
              class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-all text-xs sm:text-sm font-medium group"
              :class="[
                uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
                isFolderActive('drafts') || isFolderActive('draft') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold border-r-2 border-emerald-500' : ''
              ]"
              :title="uiStore.sidebarCollapsed ? `Drafts (${getFolderUnread('drafts')})` : ''"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span v-if="!uiStore.sidebarCollapsed" class="truncate">Drafts</span>
              </div>
              <span 
                v-if="!uiStore.sidebarCollapsed && getFolderUnread('drafts') > 0" 
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
              class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-all text-xs sm:text-sm font-medium group"
              :class="[
                uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
                isFolderActive('archive') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold border-r-2 border-emerald-500' : ''
              ]"
              :title="uiStore.sidebarCollapsed ? 'Archive' : ''"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span v-if="!uiStore.sidebarCollapsed" class="truncate">Archive</span>
              </div>
            </router-link>
          </li>

          <!-- Spam -->
          <li>
            <router-link 
              :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'spam' } }" 
              class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-amber-50/70 dark:hover:bg-amber-950/20 transition-all text-xs sm:text-sm font-medium group"
              :class="[
                uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
                isFolderActive('spam') ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold border-r-2 border-amber-500' : ''
              ]"
              :title="uiStore.sidebarCollapsed ? `Spam (${getFolderUnread('spam')})` : ''"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span v-if="!uiStore.sidebarCollapsed" class="truncate">Spam</span>
              </div>
              <span 
                v-if="!uiStore.sidebarCollapsed && getFolderUnread('spam') > 0" 
                class="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 ml-2 flex-shrink-0"
              >
                {{ getFolderUnread('spam') }}
              </span>
            </router-link>
          </li>

          <!-- Trash -->
          <li>
            <router-link 
              :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'trash' } }" 
              class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-red-50/70 dark:hover:bg-red-950/20 transition-all text-xs sm:text-sm font-medium group"
              :class="[
                uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
                isFolderActive('trash') ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-semibold border-r-2 border-red-500' : ''
              ]"
              :title="uiStore.sidebarCollapsed ? 'Trash' : ''"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span v-if="!uiStore.sidebarCollapsed" class="truncate">Trash</span>
              </div>
            </router-link>
          </li>
        </ul>

        <!-- Contacts & Settings App Tools -->
        <div class="pt-3 border-t border-gray-100 dark:border-gray-800/80">
          <ul class="space-y-1">
            <!-- Contacts -->
            <li>
              <router-link 
                :to="{ name: 'Contacts', params: { mailboxId: route.params.mailboxId } }" 
                class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-all text-xs sm:text-sm font-medium group"
                :class="[
                  uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
                  route.name === 'Contacts' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold border-r-2 border-emerald-500' : ''
                ]"
                :title="uiStore.sidebarCollapsed ? 'Contacts Directory' : ''"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span v-if="!uiStore.sidebarCollapsed" class="truncate">Contacts</span>
                </div>
              </router-link>
            </li>

            <!-- Settings -->
            <li>
              <router-link 
                :to="{ name: 'Settings', params: { mailboxId: route.params.mailboxId } }" 
                class="flex items-center justify-between rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-all text-xs sm:text-sm font-medium group"
                :class="[
                  uiStore.sidebarCollapsed ? 'p-2.5 justify-center' : 'py-2 px-3',
                  route.name === 'Settings' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold border-r-2 border-emerald-500' : ''
                ]"
                :title="uiStore.sidebarCollapsed ? 'Mailbox Settings' : ''"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span v-if="!uiStore.sidebarCollapsed" class="truncate">Settings</span>
                </div>
              </router-link>
            </li>
          </ul>
        </div>

        <!-- Custom Folders Section -->
        <div v-if="!uiStore.sidebarCollapsed">
          <div class="flex items-center justify-between px-3 mb-1.5">
            <h2 class="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Custom Folders</h2>
            <button 
              type="button"
              @click="openCreateFolderModal" 
              class="p-1 text-gray-400 hover:text-emerald-600 dark:text-gray-500 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
              title="Create new folder"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <ul v-if="customFolders.length > 0" class="space-y-1">
            <li v-for="folder in customFolders" :key="folder.id" class="group/item relative">
              <router-link 
                :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: folder.id } }" 
                class="flex items-center justify-between py-2 px-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-all text-xs sm:text-sm font-medium group"
                :class="{ 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold border-r-2 border-emerald-500': isFolderActive(folder.id) }"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <svg class="w-4 h-4 text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span class="truncate">{{ folder.name }}</span>
                </div>

                <!-- Unread counter or action buttons on hover -->
                <div class="flex items-center gap-1">
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
                      @click.stop.prevent="openRenameFolderModal(folder)"
                      class="p-1 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      title="Rename folder"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      @click.stop.prevent="openDeleteFolderModal(folder)"
                      class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors cursor-pointer"
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

          <div v-else class="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 italic">
            No custom folders
          </div>
        </div>
      </nav>

      <!-- Sidebar Footer -->
      <div class="pt-3 mt-auto border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500 px-1">
        <router-link to="/" class="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 font-medium truncate" :title="uiStore.sidebarCollapsed ? 'All Mailboxes' : ''">
          <span>&larr;</span>
          <span v-if="!uiStore.sidebarCollapsed">All Mailboxes</span>
        </router-link>

        <div class="flex items-center gap-2">
          <!-- Desktop Collapse / Expand Toggle Button -->
          <button
            type="button"
            @click="uiStore.toggleSidebarCollapsed"
            class="hidden lg:flex p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            :title="uiStore.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
          >
            <svg class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-180': uiStore.sidebarCollapsed }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- Branded Folder Modal -->
    <FolderModal 
      :is-open="isFolderModalOpen"
      :mode="folderModalMode"
      :folder="selectedFolder"
      :loading="folderModalLoading"
      @close="isFolderModalOpen = false"
      @submit="handleFolderModalSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import FolderModal from "@/components/FolderModal.vue";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import { useUIStore } from "@/stores/ui";
import type { Folder } from "@/types";

const folderStore = useFolderStore();
const { folders } = storeToRefs(folderStore);
const emailStore = useEmailStore();
const { emails } = storeToRefs(emailStore);
const uiStore = useUIStore();
const route = useRoute();
const router = useRouter();

const defaultFolderIds = ["archive", "inbox", "sent", "spam", "trash", "draft", "drafts", "starred"];

// Folder Modal state
const isFolderModalOpen = ref(false);
const folderModalMode = ref<"create" | "rename" | "delete">("create");
const selectedFolder = ref<Folder | null>(null);
const folderModalLoading = ref(false);

const customFolders = computed(() => {
	return folders.value.filter(
		(folder) =>
			!defaultFolderIds.includes(folder.name.toLowerCase()) &&
			!defaultFolderIds.includes(folder.id.toLowerCase()),
	);
});

const isFolderActive = (targetFolder: string): boolean => {
	const currentFolder = (route.params.folder as string) || (route.query.fromFolder as string);
	if (!currentFolder) {
		return route.name === "EmailList" && targetFolder.toLowerCase() === "inbox";
	}
	return currentFolder.toLowerCase() === targetFolder.toLowerCase();
};

const getFolderUnread = (folderId: string): number => {
	const f = folders.value.find(
		(folder) =>
			folder.id.toLowerCase() === folderId.toLowerCase() ||
			folder.name.toLowerCase() === folderId.toLowerCase(),
	);
	let count = f ? f.unreadCount || 0 : 0;
	const currentFolder = (route.params.folder as string) || "inbox";
	if (currentFolder.toLowerCase() === folderId.toLowerCase() && emails.value && emails.value.length > 0) {
		const unreadInList = emails.value.filter((e) => !e.read).length;
		count = Math.max(count, unreadInList);
	}
	return count;
};

const loadFolders = (id?: string) => {
	const mailboxId = id || (route.params.mailboxId as string);
	if (mailboxId) {
		folderStore.fetchFolders(mailboxId);
	}
};

onMounted(() => {
	loadFolders();
});

watch(
	() => route.params.mailboxId,
	(newId) => {
		if (newId) {
			loadFolders(newId as string);
		}
	},
);

// Auto-close mobile drawer when route changes
watch(
	() => route.fullPath,
	() => {
		uiStore.closeMobileSidebar();
	},
);

const openComposeModal = () => {
	uiStore.openComposeModal();
	uiStore.closeMobileSidebar();
};

const openCreateFolderModal = () => {
	folderModalMode.value = "create";
	selectedFolder.value = null;
	isFolderModalOpen.value = true;
};

const openRenameFolderModal = (folder: Folder) => {
	folderModalMode.value = "rename";
	selectedFolder.value = folder;
	isFolderModalOpen.value = true;
};

const openDeleteFolderModal = (folder: Folder) => {
	folderModalMode.value = "delete";
	selectedFolder.value = folder;
	isFolderModalOpen.value = true;
};

const handleFolderModalSubmit = async (payload: {
	mode: "create" | "rename" | "delete";
	name?: string;
	folderId?: string;
}) => {
	const mailboxId = route.params.mailboxId as string;
	if (!mailboxId) return;

	folderModalLoading.value = true;
	try {
		if (payload.mode === "create" && payload.name) {
			await folderStore.createFolder(mailboxId, payload.name);
		} else if (payload.mode === "rename" && payload.folderId && payload.name) {
			await folderStore.updateFolder(mailboxId, payload.folderId, payload.name);
		} else if (payload.mode === "delete" && payload.folderId) {
			await folderStore.deleteFolder(mailboxId, payload.folderId);
			if (route.params.folder === payload.folderId) {
				router.push({
					name: "EmailList",
					params: { mailboxId, folder: "inbox" },
				});
			}
		}
		isFolderModalOpen.value = false;
	} catch (error) {
		console.error("Failed to perform folder action", error);
	} finally {
		folderModalLoading.value = false;
	}
};
</script>
