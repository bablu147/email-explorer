<template>
  <div class="flex-1 flex min-h-0 h-full overflow-hidden bg-white dark:bg-gray-900 relative">
    <!-- Left Pane: Email Stream List -->
    <div 
      class="flex flex-col min-h-0 h-full overflow-y-auto transition-all duration-200"
      :class="[
        uiStore.splitViewMode === 'split' 
          ? 'w-full lg:w-[420px] xl:w-[480px] 2xl:w-[540px] shrink-0 border-r border-gray-200 dark:border-gray-800' 
          : 'w-full flex-1'
      ]"
    >
      <!-- Header with Folder Name, Live Search, Filter Pills, and Refresh -->
      <div class="px-4 sm:px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
        <div class="flex items-center gap-3">
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white capitalize tracking-tight flex items-center gap-2">
            {{ folderName }}
          </h1>
          <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {{ filteredEmails.length }} {{ filteredEmails.length === 1 ? 'message' : 'messages' }}
          </span>
        </div>

        <!-- Search, View Toggle & Filters Container -->
        <div class="flex items-center gap-2.5 flex-wrap">
          <!-- Split View Mode Toggle Button (Desktop Only) -->
          <button
            type="button"
            @click="uiStore.toggleSplitViewMode()"
            class="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-xs"
            :class="[
              uiStore.splitViewMode === 'split'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-bold'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
            ]"
            :title="uiStore.splitViewMode === 'split' ? 'Switch to Full Width List' : 'Switch to 3-Pane Split View'"
          >
            <svg v-if="uiStore.splitViewMode === 'split'" class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>{{ uiStore.splitViewMode === 'split' ? 'Split' : 'Full' }}</span>
          </button>

          <!-- Quick In-Folder Filter Search -->
        <div class="relative w-48 sm:w-64">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="folderId === 'sent' ? 'Search recipients or subjects...' : 'Search in this folder...'"
            class="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
          <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button 
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 text-xs"
          >
            ✕
          </button>
        </div>

        <!-- Folder Specific Quick Filter Pills -->
        <div class="flex items-center bg-gray-200 dark:bg-gray-700/60 p-0.5 rounded-lg text-xs font-medium">
          <!-- All -->
          <button
            type="button"
            @click="filterMode = 'all'"
            :class="filterMode === 'all' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer"
          >
            All
          </button>

          <!-- Sent Folder Specific: Delivered -->
          <button
            v-if="folderId === 'sent'"
            type="button"
            @click="filterMode = 'delivered'"
            :class="filterMode === 'delivered' ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1"
            title="Emails delivered to primary Inbox"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Delivered
          </button>

          <!-- Sent Folder Specific: Opened -->
          <button
            v-if="folderId === 'sent'"
            type="button"
            @click="filterMode = 'viewed'"
            :class="filterMode === 'viewed' ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1"
            title="Emails opened by recipients"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Opened
            <span v-if="sentStats.opened > 0" class="text-[10px] opacity-80">({{ sentStats.opened }})</span>
          </button>

          <!-- Sent Folder Specific: Awaiting Open -->
          <button
            v-if="folderId === 'sent'"
            type="button"
            @click="filterMode = 'unopened'"
            :class="filterMode === 'unopened' ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1"
            title="Awaiting recipient to open"
          >
            Pending
            <span v-if="sentStats.pending > 0" class="text-[10px] opacity-80">({{ sentStats.pending }})</span>
          </button>

          <!-- Sent Folder Specific: Clicked -->
          <button
            v-if="folderId === 'sent' && sentStats.clicked > 0"
            type="button"
            @click="filterMode = 'clicked'"
            :class="filterMode === 'clicked' ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1"
            title="Emails where recipient clicked a link"
          >
            🔗 Clicked ({{ sentStats.clicked }})
          </button>

          <!-- Non-sent folders: Unread -->
          <button
            v-if="folderId !== 'sent'"
            type="button"
            @click="filterMode = 'unread'"
            :class="filterMode === 'unread' ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Unread
          </button>

          <!-- Starred -->
          <button
            type="button"
            @click="filterMode = 'starred'"
            :class="filterMode === 'starred' ? 'bg-white dark:bg-gray-800 text-yellow-500 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1"
          >
            ★ Starred
          </button>
        </div>

        <!-- Keyboard Shortcuts Help Pill -->
        <button
          type="button"
          @click="showShortcutsModal = true"
          class="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-700/60 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600/70 transition-all cursor-pointer"
          title="View keyboard shortcuts"
        >
          <kbd class="px-1 py-0.5 text-[10px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">?</kbd>
          <span>Shortcuts</span>
        </button>

        <!-- Refresh Button -->
        <button 
          @click="handleRefresh"
          :disabled="isRefreshing"
          class="p-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          :title="isRefreshing ? 'Refreshing...' : 'Refresh emails'"
        >
          <svg v-if="!isRefreshing" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <svg v-else class="w-4 h-4 animate-spin text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 📊 Outreach Performance Metrics Banner (for Sent folder) -->
    <div 
      v-if="folderId === 'sent' && emails.length > 0" 
      class="px-4 sm:px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"
    >
      <!-- Total Sent Card -->
      <div 
        @click="filterMode = 'all'"
        class="p-3.5 rounded-xl border transition-all cursor-pointer select-none group"
        :class="filterMode === 'all' ? 'bg-white dark:bg-gray-800 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20' : 'bg-white/70 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600'"
      >
        <div class="flex items-center justify-between text-gray-500 dark:text-gray-400 font-medium mb-1">
          <span class="text-[11px] uppercase tracking-wider font-bold">Total Sent</span>
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
        <div class="text-xl font-extrabold text-gray-900 dark:text-white flex items-baseline gap-1.5">
          {{ sentStats.total }}
          <span class="text-xs font-normal text-gray-500">messages</span>
        </div>
      </div>

      <!-- Open Rate Card -->
      <div 
        @click="filterMode = 'viewed'"
        class="p-3.5 rounded-xl border transition-all cursor-pointer select-none group"
        :class="filterMode === 'viewed' ? 'bg-white dark:bg-gray-800 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20' : 'bg-white/70 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600'"
      >
        <div class="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium mb-1">
          <span class="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            Open Rate
          </span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            {{ sentStats.opened }}/{{ sentStats.total }}
          </span>
        </div>
        <div class="text-xl font-extrabold text-gray-900 dark:text-white flex items-baseline gap-1.5">
          {{ sentStats.openRate }}%
          <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">viewed</span>
        </div>
      </div>

      <!-- Click-Through Rate Card -->
      <div 
        @click="filterMode = 'clicked'"
        class="p-3.5 rounded-xl border transition-all cursor-pointer select-none group"
        :class="filterMode === 'clicked' ? 'bg-white dark:bg-gray-800 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20' : 'bg-white/70 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600'"
      >
        <div class="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium mb-1">
          <span class="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            Click Rate
          </span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            {{ sentStats.clicked }} clicks
          </span>
        </div>
        <div class="text-xl font-extrabold text-gray-900 dark:text-white flex items-baseline gap-1.5">
          {{ sentStats.clickRate }}%
          <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">engaged</span>
        </div>
      </div>

      <!-- Primary Inbox Placement Card -->
      <div 
        @click="filterMode = 'delivered'"
        class="p-3.5 rounded-xl border transition-all cursor-pointer select-none group"
        :class="filterMode === 'delivered' ? 'bg-white dark:bg-gray-800 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20' : 'bg-white/70 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600'"
      >
        <div class="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium mb-1">
          <span class="text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            Delivered
          </span>
          <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">SPF/DKIM ✓</span>
        </div>
        <div class="text-xl font-extrabold text-gray-900 dark:text-white flex items-baseline gap-1.5">
          {{ sentStats.inboxRate }}%
          <span class="text-xs font-normal text-gray-500">inbox placement</span>
        </div>
      </div>
    </div>

    <!-- Table Action Header: Select All + Column Labels -->
    <div class="px-4 sm:px-6 py-2 bg-gray-100/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700/80 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 select-none">
      <div class="flex items-center gap-3">
        <!-- Select All Checkbox -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="isAllSelected"
            @change="toggleSelectAll"
            class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <span class="hover:text-gray-900 dark:hover:text-white transition-colors">Select all</span>
        </label>
        <span v-if="selectedEmailIds.length > 0" class="text-emerald-600 dark:text-emerald-400 font-bold ml-1">
          ({{ selectedEmailIds.length }} selected)
        </span>
      </div>

      <div class="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-wider">
        <span class="hidden sm:inline">Status & Activity</span>
        <span class="w-20 text-right">Date</span>
      </div>
    </div>

    <!-- Email List Table / Rows -->
    <ul v-if="filteredEmails.length > 0" class="divide-y divide-gray-100 dark:divide-gray-800/80">
      <li 
        v-for="(email, idx) in filteredEmails" 
        :key="email.id" 
        :ref="(el) => setRowRef(el, idx)"
        @click="handleRowClick(email, idx)"
        class="group relative transition-all duration-150 border-l-4 cursor-pointer"
        :class="[
          selectedEmailIds.includes(email.id)
            ? 'bg-emerald-500/10 border-emerald-500 dark:bg-emerald-950/20'
            : activeEmailId === email.id
              ? 'bg-emerald-500/10 border-emerald-500 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30 font-semibold'
              : activeRowIndex === idx
                ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/40 ring-inset'
                : !email.read 
                  ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500 font-semibold' 
                  : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/40',
          'hover:bg-gray-50/90 dark:hover:bg-gray-800/90'
        ]"
      >
        <div class="flex items-center px-4 sm:px-6 py-3.5 gap-3 sm:gap-4 relative">
          <!-- Left: Selection Checkbox / Star / Avatar -->
          <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <!-- Row Selection Checkbox -->
            <input 
              type="checkbox"
              :checked="selectedEmailIds.includes(email.id)"
              @click.stop="toggleSelectEmail(email.id)"
              class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
            />

            <!-- Quick Star Button -->
            <button 
              type="button"
              @click.stop.prevent="toggleStarStatus(email)" 
              class="p-1 text-gray-400 hover:text-yellow-500 transition-colors flex-shrink-0 cursor-pointer"
              :class="{'text-yellow-500': email.starred}"
              :title="email.starred ? 'Unstar (s)' : 'Star (s)'"
            >
              <svg v-if="email.starred" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>

            <!-- App Avatar (opens Store/Web on click, or opens Link Modal) -->
            <AppAvatar
              :email="getTargetEmail(email, folderId)"
              :initial="getAvatarInitial(email, folderId)"
              :folder="folderId"
              :opened-count="email.opened_count"
              :clicked-count="email.clicked_count"
              size="md"
            />
          </div>

          <!-- Middle: Recipient/Sender Name, Subject & Preview Snippet -->
          <div 
            @click="handleRowClick(email, idx)" 
            class="flex-grow min-w-0 block pr-2 cursor-pointer"
          >
            <!-- Top Row: Recipient/Sender + Chips -->
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <!-- If Sent or Drafts: Show crisp "To:" pill + Structured Recipient Address -->
              <template v-if="folderId === 'sent' || folderId === 'drafts'">
                <div class="flex items-center gap-1.5 truncate max-w-[420px]">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                    {{ folderId === 'drafts' ? 'Draft to' : 'To' }}
                  </span>
                  <!-- Primary Recipient -->
                  <span 
                    class="text-sm truncate font-bold"
                    style="color: var(--fg) !important;"
                  >
                    {{ getParsedRecipients(email.recipient).primary }}
                  </span>
                  <!-- Additional Recipients Tag -->
                  <span 
                    v-if="getParsedRecipients(email.recipient).extrasCount > 0"
                    class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300"
                    :title="'All recipients: ' + email.recipient"
                  >
                    +{{ getParsedRecipients(email.recipient).extrasCount }} more
                  </span>
                  <!-- Linked App Identity Chip -->
                  <AppBadge :email="email.recipient" />
                </div>
              </template>
              <!-- If Inbox or other folders: Show bold Sender -->
              <template v-else>
                <div class="flex items-center gap-1.5 truncate max-w-[420px]">
                  <span 
                    class="text-sm truncate"
                    :class="!email.read ? 'font-extrabold' : 'font-bold'"
                    style="color: var(--fg) !important;"
                  >
                    {{ email.sender }}
                  </span>
                  <!-- Linked App Identity Chip -->
                  <AppBadge :email="email.sender" />
                </div>
              </template>

              <!-- CC summary if present -->
              <span 
                v-if="email.cc" 
                class="text-xs truncate max-w-[180px] font-medium"
                style="color: var(--fg-dim) !important;"
                :title="'Cc: ' + email.cc"
              >
                (Cc: {{ email.cc }})
              </span>

              <!-- Unread Badge Pill (for Inbox) -->
              <span 
                v-if="folderId !== 'sent' && !email.read" 
                class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
              >
                Unread
              </span>
            </div>

            <!-- Bottom Row: Subject + Live Snippet -->
            <p class="text-sm truncate leading-snug">
              <span 
                :class="!email.read ? 'font-bold' : 'font-medium'"
                style="color: var(--fg) !important;"
              >
                {{ email.subject || "(No subject)" }}
              </span>
              <span 
                v-if="getThreadCount(email) > 1"
                class="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                :title="`${getThreadCount(email)} messages in conversation`"
              >
                {{ getThreadCount(email) }}
              </span>
              <span 
                v-if="getSnippet(email.body)" 
                class="font-normal ml-1.5"
                style="color: var(--fg-dim) !important;"
              >
                — {{ getSnippet(email.body) }}
              </span>
            </p>
          </div>

          <!-- Right Column: Deliverability & Engagement Status Badge + Date / Hover Action Bar -->
          <div class="flex-shrink-0 flex items-center gap-3">
            <!-- 📬 Dedicated Delivery & Engagement Status Pillar (Visible on Sent) -->
            <div v-if="folderId === 'sent'" class="hidden md:flex flex-col items-end gap-1 min-w-[140px]">
              <!-- Spam Placement Detected -->
              <span 
                v-if="email.delivery_status === 'spam'"
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                title="Warning: Email routed to recipient Spam folder"
              >
                <svg class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Delivered · Spam
              </span>

              <!-- Opened in Inbox with Pulse Dot -->
              <span 
                v-else-if="email.opened_count && email.opened_count > 0"
                class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs"
                :title="email.opened_at ? 'Delivered to recipient Inbox and opened: ' + formatTooltipDate(email.opened_at) : 'Recipient opened this email in their Inbox'"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Opened · Inbox ({{ email.opened_count }}x)
              </span>

              <!-- Delivered to Primary Inbox (Unopened yet) -->
              <span 
                v-else
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                title="Delivered to recipient primary Inbox with verified SPF/DKIM/DMARC"
              >
                <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Delivered · Inbox
              </span>

              <!-- Link Clicks Mini Tag if clicks occurred -->
              <span 
                v-if="email.clicked_count && email.clicked_count > 0"
                class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                :title="email.clicked_at ? 'Links clicked ' + email.clicked_count + 'x (last: ' + formatTooltipDate(email.clicked_at) + ')' : 'Links clicked'"
              >
                🔗 {{ email.clicked_count }} click{{ email.clicked_count > 1 ? 's' : '' }}
              </span>
            </div>

            <!-- Attachment paperclip icon if email has attachments -->
            <div v-if="email.attachments && email.attachments.length > 0" class="text-gray-400 dark:text-gray-500" title="Has attachments">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </div>

            <!-- Friendly Date -->
            <div class="flex flex-col items-end min-w-[70px]">
              <p 
                class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium"
                :title="formatTooltipDate(email.date)"
              >
                {{ formatFriendlyDate(email.date) }}
              </p>
              <p 
                v-if="folderId === 'sent' && email.opened_at" 
                class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap mt-0.5"
                :title="'First viewed: ' + formatTooltipDate(email.opened_at)"
              >
                👁 {{ formatShortTime(email.opened_at) }}
              </p>
            </div>

            <!-- ⚡ Superhuman / Gmail-Style Floating Quick Action Bar (Revealed on Desktop Row Hover or Active Keyboard Row) -->
            <div 
              class="hidden items-center gap-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md px-1.5 py-1 rounded-xl shadow-lg border border-gray-200/80 dark:border-gray-700/80 transition-all z-20 absolute right-4 sm:right-6 top-1/2 -translate-y-1/2"
              :class="activeRowIndex === idx ? '!flex' : 'group-hover:flex'"
            >
              <!-- Archive Quick Action (Shortcut: e) -->
              <button 
                type="button"
                @click.stop.prevent="handleArchive(email)" 
                class="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer"
                title="Archive (e)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </button>

              <!-- Delete Quick Action (Shortcut: d or #) -->
              <button 
                type="button"
                @click.stop.prevent="handleDelete(email.id)" 
                class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                title="Delete (d)"
              >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" />
                </svg>
              </button>

              <!-- Mark Read/Unread (Shortcut: toggle) -->
              <button 
                type="button"
                @click.stop.prevent="toggleReadStatus(email)" 
                class="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer"
                :title="email.read ? 'Mark unread' : 'Mark read'"
              >
                <svg v-if="email.read" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <svg v-else class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </button>

              <!-- Star / Unstar (Shortcut: s) -->
              <button 
                type="button"
                @click.stop.prevent="toggleStarStatus(email)" 
                class="p-1.5 text-gray-500 hover:text-yellow-500 dark:text-gray-400 dark:hover:text-yellow-400 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-950/30 transition-all cursor-pointer"
                :title="email.starred ? 'Unstar (s)' : 'Star (s)'"
              >
                <svg v-if="email.starred" class="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>

              <!-- Link App Quick Action -->
              <button 
                type="button"
                @click.stop.prevent="handleOpenLinkApp(email)" 
                class="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer"
                title="Link App Identity"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </button>

              <!-- Reply Quick Action (Shortcut: r) -->
              <button 
                type="button"
                @click.stop.prevent="handleQuickReply(email)" 
                class="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer"
                title="Reply (r)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <!-- Refined Empty State -->
    <div v-else class="p-16 flex-1 flex flex-col items-center justify-center text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <svg v-if="filterMode === 'viewed'" class="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <svg v-else class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-1">
        <span v-if="searchQuery">No emails matching "{{ searchQuery }}"</span>
        <span v-else-if="filterMode === 'viewed'">No opened emails yet</span>
        <span v-else-if="filterMode === 'unopened'">All sent emails have been opened!</span>
        <span v-else-if="filterMode === 'clicked'">No link clicks recorded yet</span>
        <span v-else-if="filterMode === 'starred'">No starred emails in this folder</span>
        <span v-else-if="filterMode === 'unread'">No unread emails</span>
        <span v-else>No messages in this folder</span>
      </h2>
      <p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
        <span v-if="searchQuery">Try adjusting your search keywords or clear the filter.</span>
        <span v-else-if="filterMode === 'viewed'">When recipients view your sent emails, their engagement will appear here live.</span>
        <span v-else-if="filterMode === 'all'">Any sent messages will appear here with live deliverability and open tracking.</span>
        <span v-else>Try selecting a different filter above.</span>
      </p>
      <button
        v-if="filterMode !== 'all' || searchQuery"
        type="button"
        @click="filterMode = 'all'; searchQuery = ''"
        class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-sm"
      >
        Reset filters
      </button>
    </div>
  </div>

  <!-- Right Pane: Docked Reading Pane (Desktop only when split mode is active) -->
  <div 
    v-if="uiStore.splitViewMode === 'split'" 
    class="hidden lg:flex flex-1 min-w-0 h-full overflow-hidden flex-col bg-white dark:bg-gray-900"
  >
    <ReadingPane
      :mailbox-id="(route.params.mailboxId as string)"
      :email-id="activeEmailId"
      :from-folder="folderId"
      :can-go-prev="activeRowIndex > 0"
      :can-go-next="activeRowIndex < filteredEmails.length - 1"
      @close="activeEmailId = null"
      @expand="expandToFullView"
      @prev="handleReadingPanePrev"
      @next="handleReadingPaneNext"
      @archived="onReadingPaneArchived"
      @deleted="onReadingPaneDeleted"
      @starred-changed="onReadingPaneStarred"
      @read-changed="onReadingPaneRead"
    />
  </div>

    <!-- ⚡ Floating Batch Actions Bar (slides up when 1+ emails selected) -->
    <div 
      v-if="selectedEmailIds.length > 0"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-gray-700/80 flex items-center gap-4 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <span class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        {{ selectedEmailIds.length }} selected
      </span>
      <div class="h-4 w-px bg-gray-700"></div>

      <!-- Archive Selected -->
      <button 
        type="button" 
        @click="archiveSelected" 
        class="hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
        title="Archive selected emails"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
        Archive
      </button>

      <!-- Delete Selected -->
      <button 
        type="button" 
        @click="deleteSelected" 
        class="hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer"
        title="Delete selected emails"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        Delete
      </button>

      <!-- Deselect All -->
      <button 
        type="button" 
        @click="selectedEmailIds = []" 
        class="text-gray-400 hover:text-white transition-colors cursor-pointer"
      >
        Deselect
      </button>
    </div>

    <!-- ⌨️ Keyboard Shortcuts Help Modal -->
    <div 
      v-if="showShortcutsModal" 
      class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60">
          <div class="flex items-center gap-2">
            <span class="text-emerald-500 font-bold">⚡</span>
            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Keyboard Shortcuts</h3>
          </div>
          <button @click="showShortcutsModal = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 cursor-pointer">
            ✕
          </button>
        </div>

        <div class="p-6 space-y-3 text-xs">
          <div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <span class="text-gray-600 dark:text-gray-400">Navigate down</span>
            <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">j</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <span class="text-gray-600 dark:text-gray-400">Navigate up</span>
            <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">k</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <span class="text-gray-600 dark:text-gray-400">Open active email</span>
            <div class="flex gap-1">
              <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">Enter</kbd>
              <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">o</kbd>
            </div>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <span class="text-gray-600 dark:text-gray-400">Archive message</span>
            <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">e</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <span class="text-gray-600 dark:text-gray-400">Delete message</span>
            <div class="flex gap-1">
              <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">d</kbd>
              <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">#</kbd>
            </div>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <span class="text-gray-600 dark:text-gray-400">Star / Unstar</span>
            <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">s</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <span class="text-gray-600 dark:text-gray-400">Compose new email</span>
            <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">c</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <span class="text-gray-600 dark:text-gray-400">Reply to email</span>
            <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">r</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <span class="text-gray-600 dark:text-gray-400">Select row</span>
            <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">x</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5">
            <span class="text-gray-600 dark:text-gray-400">Deselect / Clear</span>
            <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-gray-800 dark:text-gray-200">Esc</kbd>
          </div>
        </div>

        <div class="px-6 py-3 bg-gray-50/50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700 flex justify-end">
          <button
            type="button"
            @click="showShortcutsModal = false"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import { useUIStore } from "@/stores/ui";
import AppAvatar from "@/components/AppAvatar.vue";
import AppBadge from "@/components/AppBadge.vue";
import ReadingPane from "@/components/ReadingPane.vue";
import { extractCleanEmail, useAppBindingsStore } from "@/stores/appBindings";
import type { Email } from "@/types";

const router = useRouter();
const route = useRoute();
const appBindingsStore = useAppBindingsStore();
const emailStore = useEmailStore();
const { emails, isRefreshing } = storeToRefs(emailStore);
const folderStore = useFolderStore();
const { folders } = storeToRefs(folderStore);
const uiStore = useUIStore();
const { success: showSuccessToast, error: showErrorToast } = useToast();

const filterMode = ref<"all" | "unread" | "starred" | "viewed" | "unopened" | "clicked" | "delivered">("all");
const searchQuery = ref("");
const selectedEmailIds = ref<string[]>([]);
const activeRowIndex = ref<number>(-1);
const activeEmailId = ref<string | null>(null);
const showShortcutsModal = ref(false);
const rowElements = ref<(HTMLElement | null)[]>([]);

const handleRowClick = (email: Email, idx: number) => {
	activeRowIndex.value = idx;

	// If in drafts folder or email is draft, immediately open compose modal
	if (folderId.value === "drafts" || folderId.value === "draft") {
		openDraftInComposer(email);
		return;
	}

	const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
	if (isMobile || uiStore.splitViewMode === "full") {
		router.push({
			name: "EmailDetail",
			params: { id: email.id },
			query: { fromFolder: folderId.value },
		});
		return;
	}

	activeEmailId.value = email.id;
};

const threadCountMap = computed(() => {
	const map = new Map<string, number>();
	for (const e of emails.value) {
		const key =
			e.thread_id ||
			(e.subject ? e.subject.replace(/^(Re|Fwd):\s*/i, "").trim().toLowerCase() : e.id);
		map.set(key, (map.get(key) || 0) + 1);
	}
	return map;
});

const getThreadCount = (email: Email): number => {
	if (email.reply_count && email.reply_count > 1) return email.reply_count;
	const key =
		email.thread_id ||
		(email.subject
			? email.subject.replace(/^(Re|Fwd):\s*/i, "").trim().toLowerCase()
			: email.id);
	return threadCountMap.value.get(key) || 1;
};

const openDraftInComposer = (draftEmail: Email) => {
	uiStore.openComposeModal({
		mode: "new",
		initialTo: draftEmail.recipient,
		initialSubject: draftEmail.subject,
		initialBody: draftEmail.body ?? undefined,
		originalEmail: draftEmail,
	});
};

const expandToFullView = () => {
	if (!activeEmailId.value) return;
	router.push({
		name: "EmailDetail",
		params: { id: activeEmailId.value },
		query: { fromFolder: folderId.value },
	});
};

const handleReadingPanePrev = () => {
	if (activeRowIndex.value > 0) {
		activeRowIndex.value--;
		activeEmailId.value = filteredEmails.value[activeRowIndex.value]?.id || null;
		scrollToActiveRow();
	}
};

const handleReadingPaneNext = () => {
	if (activeRowIndex.value < filteredEmails.value.length - 1) {
		activeRowIndex.value++;
		activeEmailId.value = filteredEmails.value[activeRowIndex.value]?.id || null;
		scrollToActiveRow();
	}
};

const onReadingPaneArchived = (_archivedEmail: Email) => {
	if (activeRowIndex.value < filteredEmails.value.length - 1) {
		activeEmailId.value = filteredEmails.value[activeRowIndex.value + 1]?.id || null;
	} else if (activeRowIndex.value > 0) {
		activeEmailId.value = filteredEmails.value[activeRowIndex.value - 1]?.id || null;
	} else {
		activeEmailId.value = null;
	}
	loadEmails();
};

const onReadingPaneDeleted = (_deletedId: string) => {
	if (activeRowIndex.value < filteredEmails.value.length - 1) {
		activeEmailId.value = filteredEmails.value[activeRowIndex.value + 1]?.id || null;
	} else if (activeRowIndex.value > 0) {
		activeEmailId.value = filteredEmails.value[activeRowIndex.value - 1]?.id || null;
	} else {
		activeEmailId.value = null;
	}
	loadEmails();
};

const onReadingPaneStarred = (starred: boolean) => {
	if (activeRowIndex.value >= 0 && filteredEmails.value[activeRowIndex.value]) {
		filteredEmails.value[activeRowIndex.value].starred = starred;
	}
};

const onReadingPaneRead = (read: boolean) => {
	if (activeRowIndex.value >= 0 && filteredEmails.value[activeRowIndex.value]) {
		filteredEmails.value[activeRowIndex.value].read = read;
	}
};

let refreshInterval: ReturnType<typeof setInterval> | null = null;

const setRowRef = (el: any, index: number) => {
	if (el) {
		rowElements.value[index] = el.$el || el;
	}
};

const folderId = computed(() => route.params.folder as string);

const folderName = computed(() => {
	const foundFolder = folders.value.find((f) => f.id === folderId.value);
	return foundFolder ? foundFolder.name : folderId.value;
});

// Real-time deliverability & engagement metrics for Sent folder
const sentStats = computed(() => {
	if (!emails.value || folderId.value !== "sent") {
		return { total: 0, opened: 0, openRate: 0, clicked: 0, clickRate: 0, inboxRate: 100, pending: 0 };
	}
	const total = emails.value.length;
	const opened = emails.value.filter((e) => e.opened_count && e.opened_count > 0).length;
	const clicked = emails.value.filter((e) => e.clicked_count && e.clicked_count > 0).length;
	const spamCount = emails.value.filter((e) => e.delivery_status === "spam").length;
	const openRate = total > 0 ? Math.round((opened / total) * 100) : 0;
	const clickRate = total > 0 ? Math.round((clicked / total) * 100) : 0;
	const inboxRate = total > 0 ? Math.round(((total - spamCount) / total) * 100) : 100;
	const pending = total - opened;

	return {
		total,
		opened,
		openRate,
		clicked,
		clickRate,
		inboxRate,
		pending,
	};
});

// Filter emails by current filter mode & live in-folder search query
const filteredEmails = computed(() => {
	if (!emails.value) return [];
	let list = emails.value;

	if (filterMode.value === "unread") {
		list = list.filter((e) => !e.read);
	} else if (filterMode.value === "starred") {
		list = list.filter((e) => e.starred);
	} else if (filterMode.value === "viewed") {
		list = list.filter((e) => e.opened_count && e.opened_count > 0);
	} else if (filterMode.value === "unopened") {
		list = list.filter((e) => !e.opened_count || e.opened_count === 0);
	} else if (filterMode.value === "clicked") {
		list = list.filter((e) => e.clicked_count && e.clicked_count > 0);
	} else if (filterMode.value === "delivered") {
		list = list.filter((e) => e.delivery_status !== "spam");
	}

	if (searchQuery.value.trim()) {
		const q = searchQuery.value.toLowerCase().trim();
		list = list.filter(
			(e) =>
				(e.subject && e.subject.toLowerCase().includes(q)) ||
				(e.recipient && e.recipient.toLowerCase().includes(q)) ||
				(e.sender && e.sender.toLowerCase().includes(q)) ||
				(e.body && e.body.toLowerCase().includes(q)),
		);
	}

	return list;
});

const getTargetEmail = (email: Email, folder: string): string => {
	return (folder === "sent" || folder === "drafts") ? email.recipient : email.sender;
};

// Split comma-separated recipients into primary and extra count
const getParsedRecipients = (recipientStr?: string | null): { primary: string; extrasCount: number; all: string[] } => {
	if (!recipientStr) return { primary: "(No recipient)", extrasCount: 0, all: [] };
	const parts = recipientStr
		.split(/[,;\n]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (parts.length === 0) return { primary: "(No recipient)", extrasCount: 0, all: [] };
	return {
		primary: parts[0],
		extrasCount: parts.length - 1,
		all: parts,
	};
};

// Avatar initial letter
const getAvatarInitial = (email: Email, folder: string): string => {
	const raw = (folder === "sent" || folder === "drafts") ? email.recipient : email.sender;
	if (!raw) return "?";
	const clean = raw.replace(/<[^>]+>/, "").trim();
	return (clean.charAt(0) || "?").toUpperCase();
};

// Body snippet generator
const getSnippet = (body?: string | null, maxLen = 95): string => {
	if (!body) return "";
	const text = body
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/\s+/g, " ")
		.trim();
	if (text.length <= maxLen) return text;
	return text.slice(0, maxLen) + "…";
};

// Friendly user-facing date formatting
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

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	const isYesterday =
		date.getDate() === yesterday.getDate() &&
		date.getMonth() === yesterday.getMonth() &&
		date.getFullYear() === yesterday.getFullYear();

	if (isYesterday) {
		return "Yesterday";
	}

	if (date.getFullYear() === now.getFullYear()) {
		return date.toLocaleDateString([], { month: "short", day: "numeric" });
	}

	return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
};

const formatShortTime = (dateStr?: string): string => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return "";
	return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatTooltipDate = (dateStr?: string): string => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return dateStr;
	return date.toLocaleString([], {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	});
};

// Selection helpers
const isAllSelected = computed(() => {
	return (
		filteredEmails.value.length > 0 &&
		selectedEmailIds.value.length === filteredEmails.value.length
	);
});

const toggleSelectAll = () => {
	if (isAllSelected.value) {
		selectedEmailIds.value = [];
	} else {
		selectedEmailIds.value = filteredEmails.value.map((e) => e.id);
	}
};

const toggleSelectEmail = (emailId: string) => {
	const idx = selectedEmailIds.value.indexOf(emailId);
	if (idx === -1) {
		selectedEmailIds.value.push(emailId);
	} else {
		selectedEmailIds.value.splice(idx, 1);
	}
};

const deleteSelected = async () => {
	if (
		selectedEmailIds.value.length > 0 &&
		confirm(`Are you sure you want to delete ${selectedEmailIds.value.length} selected email(s)?`)
	) {
		const mailboxId = route.params.mailboxId as string;
		for (const id of selectedEmailIds.value) {
			await emailStore.deleteEmail(mailboxId, id);
		}
		selectedEmailIds.value = [];
		showSuccessToast("Selected email(s) deleted");
		folderStore.fetchFolders(mailboxId);
	}
};

const archiveSelected = async () => {
	if (selectedEmailIds.value.length > 0) {
		const mailboxId = route.params.mailboxId as string;
		for (const id of selectedEmailIds.value) {
			await emailStore.moveEmail(mailboxId, id, "archive");
		}
		selectedEmailIds.value = [];
		showSuccessToast("Selected email(s) moved to Archive");
		folderStore.fetchFolders(mailboxId);
	}
};

// Quick Actions
const handleArchive = async (email: Email) => {
	const mailboxId = route.params.mailboxId as string;
	try {
		await emailStore.moveEmail(mailboxId, email.id, "archive");
		showSuccessToast("Moved to Archive");
		folderStore.fetchFolders(mailboxId);
	} catch (err: any) {
		showErrorToast("Failed to archive email");
	}
};

const handleDelete = async (emailId: string) => {
	if (confirm("Are you sure you want to delete this email?")) {
		const mailboxId = route.params.mailboxId as string;
		try {
			await emailStore.deleteEmail(mailboxId, emailId);
			showSuccessToast("Email deleted");
			folderStore.fetchFolders(mailboxId);
		} catch (err: any) {
			showErrorToast("Failed to delete email");
		}
	}
};

const toggleReadStatus = async (email: Email) => {
	const mailboxId = route.params.mailboxId as string;
	await emailStore.updateEmail(mailboxId, email.id, {
		read: !email.read,
	});
	folderStore.fetchFolders(mailboxId);
};

const toggleStarStatus = (email: Email) => {
	emailStore.updateEmail(route.params.mailboxId as string, email.id, {
		starred: !email.starred,
	});
};

const handleOpenLinkApp = (email: Email) => {
	const target = getTargetEmail(email, folderId.value);
	const clean = extractCleanEmail(target);
	const binding = clean ? appBindingsStore.getBinding(clean) : null;
	appBindingsStore.openLinkModal(clean || target, binding);
};

const handleQuickReply = (email: Email) => {
	uiStore.openComposeModal({ mode: "reply", originalEmail: email });
};

// ⌨️ Keyboard Navigation System
const handleKeyDown = (e: KeyboardEvent) => {
	const activeElement = document.activeElement;
	const tagName = activeElement?.tagName?.toLowerCase();
	const isEditable = (activeElement as HTMLElement)?.isContentEditable;
	if (tagName === "input" || tagName === "textarea" || tagName === "select" || isEditable) {
		return;
	}

	// Don't trigger if compose or link modal is open
	if (uiStore.isComposeModalOpen || appBindingsStore.isModalOpen) {
		return;
	}

	// '?' to open/close shortcuts modal (works even in empty folders!)
	if (e.key === "?" || (e.shiftKey && e.key === "/")) {
		e.preventDefault();
		showShortcutsModal.value = !showShortcutsModal.value;
		return;
	}

	if (showShortcutsModal.value) {
		if (e.key === "Escape") {
			e.preventDefault();
			showShortcutsModal.value = false;
		}
		return;
	}

	// 'c' to open compose modal (works even in empty folders!)
	if (e.key === "c" || e.key === "C") {
		e.preventDefault();
		uiStore.openComposeModal();
		return;
	}

	// 'Escape' to deselect reading pane, batch selection, or search
	if (e.key === "Escape") {
		e.preventDefault();
		if (activeEmailId.value) {
			activeEmailId.value = null;
			return;
		}
		if (selectedEmailIds.value.length > 0) {
			selectedEmailIds.value = [];
			return;
		}
		if (searchQuery.value) {
			searchQuery.value = "";
			return;
		}
		activeRowIndex.value = -1;
		return;
	}

	const list = filteredEmails.value;
	if (!list || list.length === 0) return;

	// 'j' or ArrowDown to navigate down
	if (e.key === "j" || e.key === "ArrowDown") {
		e.preventDefault();
		if (activeRowIndex.value < list.length - 1) {
			activeRowIndex.value++;
		} else if (activeRowIndex.value === -1) {
			activeRowIndex.value = 0;
		}
		if (uiStore.splitViewMode === "split" && typeof window !== "undefined" && window.innerWidth >= 1024) {
			const email = list[activeRowIndex.value];
			if (email) activeEmailId.value = email.id;
		}
		scrollToActiveRow();
		return;
	}

	// 'k' or ArrowUp to navigate up
	if (e.key === "k" || e.key === "ArrowUp") {
		e.preventDefault();
		if (activeRowIndex.value > 0) {
			activeRowIndex.value--;
		} else if (activeRowIndex.value === -1) {
			activeRowIndex.value = 0;
		}
		if (uiStore.splitViewMode === "split" && typeof window !== "undefined" && window.innerWidth >= 1024) {
			const email = list[activeRowIndex.value];
			if (email) activeEmailId.value = email.id;
		}
		scrollToActiveRow();
		return;
	}

	// From here, require an active email
	const activeEmail = activeRowIndex.value >= 0 && activeRowIndex.value < list.length
		? list[activeRowIndex.value]
		: null;

	if (!activeEmail) return;

	// 'Enter' or 'o' to open email detail
	if (e.key === "Enter" || e.key === "o") {
		e.preventDefault();
		if (folderId.value === "drafts" || folderId.value === "draft") {
			openDraftInComposer(activeEmail);
			return;
		}
		if (uiStore.splitViewMode === "split" && typeof window !== "undefined" && window.innerWidth >= 1024) {
			activeEmailId.value = activeEmail.id;
		} else {
			router.push({
				name: "EmailDetail",
				params: { id: activeEmail.id },
				query: { fromFolder: folderId.value },
			});
		}
		return;
	}

	// 'x' to toggle selection on active row
	if (e.key === "x" || e.key === "X") {
		e.preventDefault();
		toggleSelectEmail(activeEmail.id);
		return;
	}

	// 's' to toggle star
	if (e.key === "s" || e.key === "S") {
		e.preventDefault();
		toggleStarStatus(activeEmail);
		return;
	}

	// 'e' to archive
	if (e.key === "e" || e.key === "E") {
		e.preventDefault();
		if (selectedEmailIds.value.length > 0) {
			archiveSelected();
		} else {
			handleArchive(activeEmail);
			if (uiStore.splitViewMode === "split" && activeRowIndex.value < list.length - 1) {
				const nextEmail = list[activeRowIndex.value + 1];
				if (nextEmail) activeEmailId.value = nextEmail.id;
			}
		}
		return;
	}

	// 'd' or '#' to delete
	if (e.key === "d" || e.key === "D" || e.key === "#") {
		e.preventDefault();
		if (selectedEmailIds.value.length > 0) {
			deleteSelected();
		} else {
			handleDelete(activeEmail.id);
			if (uiStore.splitViewMode === "split" && activeRowIndex.value < list.length - 1) {
				const nextEmail = list[activeRowIndex.value + 1];
				if (nextEmail) activeEmailId.value = nextEmail.id;
			}
		}
		return;
	}

	// 'r' to reply
	if (e.key === "r" || e.key === "R") {
		e.preventDefault();
		handleQuickReply(activeEmail);
		return;
	}
};

const scrollToActiveRow = () => {
	nextTick(() => {
		const el = rowElements.value[activeRowIndex.value];
		if (el) {
			el.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	});
};

const loadEmails = () => {
	const mailboxId = route.params.mailboxId as string;
	if (!mailboxId) return;
	emailStore.fetchEmails(mailboxId, {
		folder: folderId.value,
	});
};

const startAutoRefresh = () => {
	if (refreshInterval) clearInterval(refreshInterval);
	refreshInterval = setInterval(() => {
		const mailboxId = route.params.mailboxId as string;
		if (mailboxId) {
			emailStore.fetchEmails(mailboxId, {
				folder: folderId.value,
			});
			folderStore.fetchFolders(mailboxId);
			appBindingsStore.fetchBindings(true);
		}
	}, 30000);
};

const stopAutoRefresh = () => {
	if (refreshInterval) {
		clearInterval(refreshInterval);
		refreshInterval = null;
	}
};

const handleRefresh = () => {
	loadEmails();
	folderStore.fetchFolders(route.params.mailboxId as string);
	appBindingsStore.fetchBindings(true);
};

onMounted(() => {
	loadEmails();
	startAutoRefresh();
	window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
	stopAutoRefresh();
	window.removeEventListener("keydown", handleKeyDown);
});

watch(
	[() => route.params.mailboxId, folderId],
	() => {
		filterMode.value = "all";
		searchQuery.value = "";
		selectedEmailIds.value = [];
		activeRowIndex.value = -1;
		activeEmailId.value = null;
		rowElements.value = [];
		loadEmails();
	}
);

watch(
	() => filteredEmails.value.length,
	(newLen) => {
		if (activeRowIndex.value >= newLen) {
			activeRowIndex.value = newLen > 0 ? newLen - 1 : -1;
		}
	}
);
</script>
