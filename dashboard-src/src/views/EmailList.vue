<template>
  <div class="flex-1 flex min-h-0 h-full overflow-hidden bg-white dark:bg-gray-900 relative">
    <!-- Left Pane: Email Stream List -->
    <div
      ref="listScrollEl"
      class="flex flex-col min-h-0 h-full overflow-y-auto overscroll-contain"
      :class="[
        uiStore.splitViewMode === 'split'
          ? 'w-full md:w-auto shrink-0'
          : 'w-full flex-1',
        isResizing ? 'transition-none select-none' : 'transition-[width] duration-150'
      ]"
      :style="leftPaneStyle"
    >
      <!-- Sticky list header: title row + filter/search row -->
      <div class="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <!-- Row 1: Folder title, counts, utility icons -->
        <div class="flex items-center gap-2 px-4 pt-3 pb-2">
          <h1 class="text-lg font-semibold text-gray-900 dark:text-white tracking-tight truncate">
            {{ folderName }}
          </h1>
          <span
            v-if="!showSkeleton"
            class="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap"
          >
            {{ listCountLabel }}
          </span>

          <div class="ml-auto flex items-center gap-0.5">
            <!-- Refresh -->
            <button
              type="button"
              @click="handleRefresh"
              :disabled="isRefreshing"
              class="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:cursor-wait cursor-pointer"
              :title="isRefreshing ? 'Refreshing…' : 'Refresh'"
              aria-label="Refresh"
            >
              <svg class="w-4 h-4" :class="{ 'animate-spin text-emerald-500': isRefreshing }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <!-- Split / full toggle (>= md) -->
            <button
              type="button"
              @click="uiStore.toggleSplitViewMode()"
              class="hidden md:inline-flex p-2 rounded-lg transition-colors cursor-pointer"
              :class="uiStore.splitViewMode === 'split'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'"
              :title="uiStore.splitViewMode === 'split' ? 'Reading pane on (click for full-width list)' : 'Reading pane off (click for split view)'"
              :aria-pressed="uiStore.splitViewMode === 'split'"
              aria-label="Toggle reading pane"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
              </svg>
            </button>

            <!-- Shortcuts (>= lg) -->
            <button
              type="button"
              @click="showShortcutsModal = true"
              class="hidden lg:inline-flex p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2.5" y="6" width="19" height="12" rx="2" stroke-width="2" />
                <path stroke-linecap="round" stroke-width="2" d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Row 2: select-all, filters, search -->
        <div class="flex items-center gap-2 px-4 pb-2.5 flex-wrap">
          <label
            class="items-center justify-center w-7 h-7 -ml-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            :class="selectedEmailIds.length > 0 ? 'flex' : 'hidden sm:flex'"
            :title="isAllSelected ? 'Deselect all' : 'Select all'"
          >
            <input
              ref="selectAllEl"
              type="checkbox"
              :checked="isAllSelected"
              @change="toggleSelectAll"
              :disabled="filteredEmails.length === 0"
              class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              aria-label="Select all"
            />
          </label>

          <!-- Segmented filters -->
          <div class="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium overflow-x-auto no-scrollbar max-w-full">
            <button
              v-for="opt in filterOptions"
              :key="opt.id"
              type="button"
              @click="filterMode = opt.id"
              class="px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5"
              :class="filterMode === opt.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
              :aria-pressed="filterMode === opt.id"
            >
              {{ opt.label }}
              <span
                v-if="opt.count"
                class="tabular-nums text-[10px]"
                :class="filterMode === opt.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'"
              >{{ opt.count }}</span>
            </button>
          </div>

          <!-- In-folder search -->
          <div class="relative flex-1 min-w-[10rem]">
            <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref="searchInputEl"
              v-model="searchQuery"
              type="search"
              :placeholder="folderId === 'sent' ? 'Filter by recipient or subject' : 'Filter this folder'"
              @keydown.esc.prevent="onSearchEscape"
              class="w-full pl-8 pr-8 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors [&::-webkit-search-cancel-button]:hidden"
              aria-label="Filter messages in this folder"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="searchQuery = ''"
              class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              title="Clear filter"
              aria-label="Clear filter"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <kbd
              v-else
              class="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-px rounded border border-gray-200 dark:border-gray-700 text-[10px] font-mono text-gray-400 pointer-events-none"
            >/</kbd>
          </div>
        </div>
      </div>

      <!-- Outreach performance (Sent folder) -->
      <div
        v-if="folderId === 'sent' && !showSkeleton && emails.length > 0"
        class="px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 grid gap-2"
        :class="uiStore.splitViewMode === 'split' ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'"
      >
        <button
          v-for="card in sentCards"
          :key="card.filter"
          type="button"
          @click="filterMode = card.filter"
          class="text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer min-w-0"
          :class="filterMode === card.filter
            ? 'bg-white dark:bg-gray-800 border-emerald-500/60 ring-1 ring-emerald-500/20'
            : 'bg-white/70 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600'"
          :aria-pressed="filterMode === card.filter"
        >
          <div class="flex items-center justify-between gap-2 min-w-0">
            <span class="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">{{ card.label }}</span>
            <span class="text-[10px] tabular-nums text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{{ card.hint }}</span>
          </div>
          <div class="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white truncate">{{ card.value }}</div>
        </button>
      </div>

      <!-- Loading skeleton (first load / folder switch) -->
      <ul v-if="showSkeleton && !showError" class="flex-1" aria-busy="true" aria-label="Loading messages">
        <li
          v-for="n in 9"
          :key="n"
          class="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800/80 animate-pulse"
        >
          <div class="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0"></div>
          <div class="flex-1 min-w-0 space-y-2 py-0.5">
            <div class="flex items-center justify-between gap-4">
              <div class="h-3 rounded bg-gray-200 dark:bg-gray-800" :style="{ width: `${28 + ((n * 17) % 30)}%` }"></div>
              <div class="h-2.5 w-10 rounded bg-gray-100 dark:bg-gray-800/70"></div>
            </div>
            <div class="h-2.5 rounded bg-gray-100 dark:bg-gray-800/70" :style="{ width: `${55 + ((n * 23) % 40)}%` }"></div>
          </div>
        </li>
      </ul>

      <!-- Load error -->
      <div v-else-if="showError" class="flex-1 flex flex-col items-center justify-center text-center p-12">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/10 text-red-600 dark:text-red-400 mb-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Couldn't load {{ folderName }}</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">Check your connection and try again.</p>
        <button
          type="button"
          @click="loadEmails"
          class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>

      <!-- Email rows -->
      <ul v-else-if="filteredEmails.length > 0" class="flex-1" role="listbox" :aria-label="`${folderName} messages`">
        <template v-for="(email, idx) in filteredEmails" :key="email.id">
          <!-- Date group header -->
          <li
            v-if="groupLabels[idx]"
            class="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 select-none"
            role="presentation"
          >
            {{ groupLabels[idx] }}
          </li>

          <li
            :ref="(el) => setRowRef(el, idx)"
            @click="handleRowClick(email, idx)"
            @touchstart.passive="onRowTouchStart(email)"
            @touchmove.passive="cancelLongPress"
            @touchend="cancelLongPress"
            @touchcancel="cancelLongPress"
            @contextmenu="onRowContextMenu"
            class="touch-row group relative cursor-pointer border-b border-gray-100 dark:border-gray-800/80 transition-colors duration-100"
            :class="rowClass(email, idx)"
            role="option"
            :aria-selected="activeEmailId === email.id || selectedEmailIds.includes(email.id)"
          >
            <!-- Left accent: open in reading pane / keyboard cursor -->
            <span
              v-if="activeEmailId === email.id || activeRowIndex === idx"
              class="absolute left-0 top-0 bottom-0 w-0.5"
              :class="activeEmailId === email.id ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'"
            ></span>

            <div class="flex items-start gap-3 pl-4 pr-3 sm:pr-4 py-2.5">
              <!-- Selection checkbox: reveals on hover (desktop) or when selecting -->
              <div
                class="pt-2.5 -ml-1 shrink-0"
                :class="selectedEmailIds.length > 0 ? 'block' : 'hidden sm:block'"
                @click.stop
              >
                <input
                  type="checkbox"
                  :checked="selectedEmailIds.includes(email.id)"
                  @click.stop="toggleSelectEmail(email.id, $event)"
                  class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-opacity"
                  :class="selectedEmailIds.length > 0 || selectedEmailIds.includes(email.id) ? 'opacity-100' : 'sm:opacity-0 group-hover:opacity-100 focus:opacity-100'"
                  :aria-label="`Select message from ${getTargetEmail(email, folderId)}`"
                />
              </div>

              <!-- Avatar / linked app icon -->
              <div class="relative shrink-0 pt-0.5">
                <AppAvatar
                  :email="getTargetEmail(email, folderId)"
                  :initial="getAvatarInitial(email, folderId)"
                  :folder="folderId"
                  :opened-count="email.opened_count"
                  :clicked-count="email.clicked_count"
                  size="md"
                />
                <span
                  v-if="!email.read && !isOutgoingFolder"
                  class="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500"
                  aria-label="Unread"
                ></span>
              </div>

              <!-- Main content -->
              <div class="flex-1 min-w-0">
                <!-- Line 1: who · app chip · thread count · meta -->
                <div class="flex items-center gap-1.5 min-w-0">
                  <template v-if="isOutgoingFolder">
                    <span class="text-[11px] font-medium text-gray-400 dark:text-gray-500 shrink-0">
                      {{ folderId === 'drafts' || folderId === 'draft' ? 'Draft to' : 'To' }}
                    </span>
                    <span class="text-sm truncate font-semibold text-gray-900 dark:text-gray-100">
                      {{ getParsedRecipients(email.recipient).primary }}
                    </span>
                    <span
                      v-if="getParsedRecipients(email.recipient).extrasCount > 0"
                      class="shrink-0 text-[11px] font-medium text-gray-500 dark:text-gray-400"
                      :title="'All recipients: ' + email.recipient"
                    >
                      +{{ getParsedRecipients(email.recipient).extrasCount }}
                    </span>
                  </template>
                  <span
                    v-else
                    class="text-sm truncate"
                    :class="!email.read ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'"
                  >
                    {{ getDisplayName(email.sender) }}
                  </span>

                  <span class="shrink-0 hidden sm:inline-flex"><AppBadge :email="getTargetEmail(email, folderId)" /></span>

                  <span
                    v-if="getThreadCount(email) > 1"
                    class="shrink-0 px-1.5 rounded text-[10px] font-semibold tabular-nums bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    :title="`${getThreadCount(email)} messages in conversation`"
                  >
                    {{ getThreadCount(email) }}
                  </span>

                  <!-- Meta (date etc). Hidden behind the hover action bar on desktop. -->
                  <div class="ml-auto pl-2 flex items-center gap-1.5 shrink-0 text-gray-400 dark:text-gray-500">
                    <svg v-if="email.attachments && email.attachments.length > 0" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Has attachments">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <svg v-if="email.starred" class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-label="Starred">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span
                      class="text-xs tabular-nums whitespace-nowrap"
                      :class="!email.read && !isOutgoingFolder ? 'font-semibold text-gray-900 dark:text-white' : ''"
                      :title="formatTooltipDate(email.date)"
                    >
                      {{ formatFriendlyDate(email.date) }}
                    </span>
                  </div>
                </div>

                <!-- Line 2: subject — snippet -->
                <p class="text-[13px] truncate leading-snug mt-0.5">
                  <span :class="!email.read && !isOutgoingFolder ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200'">
                    {{ email.subject || "(No subject)" }}
                  </span>
                  <span v-if="getSnippet(email.body)" class="text-gray-500 dark:text-gray-400">
                    &nbsp;— {{ getSnippet(email.body) }}
                  </span>
                </p>

                <!-- Line 3 (Sent): delivery & engagement -->
                <div v-if="folderId === 'sent'" class="mt-1 flex items-center gap-3 text-[11px] font-medium min-w-0">
                  <span
                    v-if="email.delivery_status === 'spam'"
                    class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                    title="Delivered to the recipient's spam folder"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Delivered to spam
                  </span>
                  <span
                    v-else-if="email.opened_count && email.opened_count > 0"
                    class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                    :title="email.opened_at ? 'First opened ' + formatTooltipDate(email.opened_at) : 'Opened'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Opened {{ email.opened_count }}&times;<template v-if="email.opened_at">&nbsp;· {{ formatFriendlyDate(email.opened_at) }}</template>
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 whitespace-nowrap"
                    title="Delivered to the recipient's inbox (SPF/DKIM/DMARC verified); not opened yet"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    Delivered · not opened
                  </span>
                  <span
                    v-if="email.clicked_count && email.clicked_count > 0"
                    class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                    :title="email.clicked_at ? 'Last click ' + formatTooltipDate(email.clicked_at) : 'Links clicked'"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                    {{ email.clicked_count }} {{ email.clicked_count === 1 ? 'click' : 'clicks' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Hover / keyboard-cursor quick actions (desktop) -->
            <div
              class="hidden items-center gap-0.5 bg-white dark:bg-gray-800 px-1 py-1 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 z-20 absolute right-3 sm:right-4 top-2"
              :class="activeRowIndex === idx ? 'sm:flex' : 'sm:group-hover:flex'"
              @click.stop
            >
              <button
                type="button"
                @click.stop.prevent="handleArchive(email)"
                class="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                :title="isRestoreFolder ? 'Move to Inbox (e)' : 'Archive (e)'"
                :aria-label="isRestoreFolder ? 'Move to Inbox' : 'Archive'"
              >
                <svg v-if="isRestoreFolder" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </button>
              <button
                type="button"
                @click.stop.prevent="handleDelete(email)"
                class="p-1.5 rounded-md text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                :title="folderId === 'trash' ? 'Delete forever (#)' : 'Move to Trash (#)'"
                :aria-label="folderId === 'trash' ? 'Delete forever' : 'Move to Trash'"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                type="button"
                @click.stop.prevent="toggleReadStatus(email)"
                class="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                :title="email.read ? 'Mark unread (u)' : 'Mark read (u)'"
                :aria-label="email.read ? 'Mark unread' : 'Mark read'"
              >
                <svg v-if="email.read" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
              </button>
              <button
                type="button"
                @click.stop.prevent="toggleStarStatus(email)"
                class="p-1.5 rounded-md text-gray-500 hover:text-amber-500 dark:text-gray-400 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors cursor-pointer"
                :title="email.starred ? 'Unstar (s)' : 'Star (s)'"
                :aria-label="email.starred ? 'Unstar' : 'Star'"
              >
                <svg v-if="email.starred" class="h-4 w-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              <button
                type="button"
                @click.stop.prevent="handleOpenLinkApp(email)"
                class="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                title="Link to app"
                aria-label="Link to app"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                v-if="!isOutgoingFolder"
                type="button"
                @click.stop.prevent="handleQuickReply(email)"
                class="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                title="Reply (r)"
                aria-label="Reply"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
            </div>
          </li>
        </template>

        <!-- Infinite scroll sentinel / footer -->
        <li ref="sentinelEl" class="px-4 py-5 text-center text-xs text-gray-400 dark:text-gray-500 select-none" role="presentation">
          <span v-if="isLoadingMore" class="inline-flex items-center gap-2">
            <svg class="w-3.5 h-3.5 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Loading older messages…
          </span>
          <span v-else-if="loadMoreFailed && hasMore" class="inline-flex items-center gap-2">
            Couldn't load older messages.
            <button
              type="button"
              @click="loadMore"
              class="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </span>
          <button
            v-else-if="hasMore && isFiltering"
            type="button"
            @click="loadMore"
            class="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Load older messages to filter
          </button>
          <span v-else-if="!hasMore && emails.length > 12">End of {{ folderName }}</span>
        </li>
      </ul>

      <!-- Empty states -->
      <div v-else class="flex-1 flex flex-col items-center justify-center text-center p-12">
        <div
          class="w-14 h-14 mb-4 rounded-2xl flex items-center justify-center"
          :class="isInboxZero ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'"
        >
          <svg v-if="isInboxZero" class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else-if="searchQuery" class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <svg v-else-if="folderId === 'trash'" class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <svg v-else class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>

        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ emptyTitle }}</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-5 leading-relaxed">
          <template v-if="isInboxZero">
            Press <kbd class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">c</kbd> to compose or
            <kbd class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">⌘K</kbd> to jump anywhere.
          </template>
          <template v-else>{{ emptyHint }}</template>
        </p>

        <div class="flex items-center gap-2">
          <button
            v-if="filterMode !== 'all' || searchQuery"
            type="button"
            @click="filterMode = 'all'; searchQuery = ''"
            class="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Clear filters
          </button>
          <button
            v-else-if="folderId === 'inbox'"
            type="button"
            @click="uiStore.openComposeModal()"
            class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Compose
          </button>
        </div>
      </div>
    </div>

    <!-- Draggable split divider (>= md, split mode) -->
    <div
      v-if="uiStore.splitViewMode === 'split'"
      @mousedown.prevent="startResizing"
      @touchstart="startTouchResizing"
      @dblclick="resetSplitWidth"
      class="hidden md:flex items-center justify-center w-2 -mx-1 hover:bg-emerald-500/20 active:bg-emerald-500/40 cursor-col-resize z-20 group relative transition-colors select-none shrink-0"
      :class="{ '!bg-emerald-500/30': isResizing }"
      title="Drag to resize (double-click to reset)"
      role="separator"
      aria-orientation="vertical"
    >
      <div
        class="w-px h-full bg-gray-200 dark:bg-gray-800 group-hover:bg-emerald-500 transition-colors"
        :class="{ '!bg-emerald-500': isResizing }"
      ></div>
      <div
        class="absolute w-1.5 h-8 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-emerald-500 transition-all opacity-0 group-hover:opacity-100 pointer-events-none"
        :class="{ '!opacity-100 !bg-emerald-500': isResizing }"
      ></div>
    </div>

    <!-- Docked reading pane (>= md, split mode) -->
    <div
      v-if="uiStore.splitViewMode === 'split'"
      class="hidden md:flex flex-1 min-w-0 h-full overflow-hidden flex-col bg-white dark:bg-gray-900"
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
        @archive="onReadingPaneArchive"
        @trash="onReadingPaneTrash"
      />
    </div>

    <!-- Floating bulk-actions bar -->
    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="selectedEmailIds.length > 0"
        :style="bulkBarStyle"
        class="bulk-bar fixed left-3 sm:left-1/2 sm:-translate-x-1/2 z-50 bg-gray-900 dark:bg-gray-800 text-white pl-4 pr-1.5 py-1.5 rounded-xl shadow-2xl border border-gray-800 dark:border-gray-700 flex items-center gap-1 text-xs font-medium max-w-[calc(100vw-6.5rem)] sm:max-w-[calc(100vw-1.5rem)]"
        role="toolbar"
        aria-label="Bulk actions"
      >
        <span class="tabular-nums whitespace-nowrap pr-2">{{ selectedEmailIds.length }} selected</span>
        <div class="h-4 w-px bg-white/15 mx-1"></div>
        <button type="button" @click="archiveSelected" class="bulk-btn" :title="isRestoreFolder ? 'Move to Inbox (e)' : 'Archive (e)'">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
          <span class="hidden sm:inline">{{ isRestoreFolder ? 'Move to Inbox' : 'Archive' }}</span>
        </button>
        <button type="button" @click="deleteSelected" class="bulk-btn hover:!text-red-300" :title="folderId === 'trash' ? 'Delete forever (#)' : 'Move to Trash (#)'">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          <span class="hidden sm:inline">{{ folderId === 'trash' ? 'Delete forever' : 'Trash' }}</span>
        </button>
        <button type="button" @click="markSelectedRead(!allSelectedRead)" class="bulk-btn" :title="allSelectedRead ? 'Mark unread (u)' : 'Mark read (u)'">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <span class="hidden sm:inline">{{ allSelectedRead ? 'Unread' : 'Read' }}</span>
        </button>
        <div class="h-4 w-px bg-white/15 mx-1"></div>
        <button type="button" @click="selectedEmailIds = []" class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="Clear selection (Esc)" aria-label="Clear selection">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </transition>

    <!-- Permanent-delete confirmation (only reachable from Trash) -->
    <ConfirmModal
      :is-open="isDeleteConfirmOpen"
      :title="deleteConfirmTitle"
      :message="deleteConfirmMessage"
      confirm-text="Delete forever"
      :danger="true"
      :loading="isExecutingDelete"
      @close="isDeleteConfirmOpen = false"
      @confirm="executePendingDelete"
    />

    <!-- Keyboard shortcuts -->
    <div
      v-if="showShortcutsModal"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="showShortcutsModal = false"
    >
      <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800 overflow-hidden" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div class="flex justify-between items-center px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Keyboard shortcuts</h3>
          <button @click="showShortcutsModal = false" class="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" aria-label="Close">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="p-5 grid sm:grid-cols-2 gap-x-8 gap-y-5 text-xs max-h-[70vh] overflow-y-auto">
          <div v-for="group in shortcutGroups" :key="group.title">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{{ group.title }}</div>
            <div class="space-y-1.5">
              <div v-for="item in group.items" :key="item.label" class="flex items-center justify-between gap-3">
                <span class="text-gray-600 dark:text-gray-300">{{ item.label }}</span>
                <span class="flex items-center gap-1 shrink-0">
                  <kbd
                    v-for="k in item.keys"
                    :key="k"
                    class="min-w-[1.5rem] text-center px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono text-[11px] text-gray-700 dark:text-gray-200"
                  >{{ k }}</kbd>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fullscreen drag overlay so iframes/text selection don't swallow events while resizing -->
    <div v-if="isResizing" class="fixed inset-0 z-50 cursor-col-resize select-none bg-transparent"></div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppAvatar from "@/components/AppAvatar.vue";
import AppBadge from "@/components/AppBadge.vue";
import ConfirmModal from "@/components/ConfirmModal.vue";
import ReadingPane from "@/components/ReadingPane.vue";
import { useMailActions } from "@/composables/useMailActions";
import { visibleToastRows } from "@/composables/useToast";
import { extractCleanEmail, useAppBindingsStore } from "@/stores/appBindings";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import { useUIStore } from "@/stores/ui";
import type { Email } from "@/types";

type FilterMode = "all" | "unread" | "starred" | "viewed" | "unopened" | "clicked" | "delivered";

const router = useRouter();
const route = useRoute();
const appBindingsStore = useAppBindingsStore();
const emailStore = useEmailStore();
const { emails, isRefreshing, hasMore, isLoadingMore, loadMoreFailed } = storeToRefs(emailStore);
const folderStore = useFolderStore();
const { folders } = storeToRefs(folderStore);
const uiStore = useUIStore();
const mail = useMailActions();

const filterMode = ref<FilterMode>("all");
const searchQuery = ref("");
const selectedEmailIds = ref<string[]>([]);
const lastSelectedIndex = ref<number>(-1);
const activeRowIndex = ref<number>(-1);
const activeEmailId = ref<string | null>(null);
const showShortcutsModal = ref(false);
const rowElements = ref<(HTMLElement | null)[]>([]);
const listScrollEl = ref<HTMLElement | null>(null);
const sentinelEl = ref<HTMLElement | null>(null);
const searchInputEl = ref<HTMLInputElement | null>(null);
const selectAllEl = ref<HTMLInputElement | null>(null);

const mailboxId = computed(() => route.params.mailboxId as string);
const folderId = computed(() => route.params.folder as string);
const isOutgoingFolder = computed(() => ["sent", "drafts", "draft"].includes(folderId.value));
/** In these folders the primary "archive" action restores to Inbox instead. */
const isRestoreFolder = computed(() => ["archive", "trash", "spam"].includes(folderId.value));

// ── Split-pane resize ────────────────────────────────────────────────────────
const isResizing = ref(false);
const startX = ref(0);
const startWidth = ref(0);
const windowWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1200);
const isTabletOrDesktop = computed(() => windowWidth.value >= 768);
const isSplitActive = computed(() => uiStore.splitViewMode === "split" && isTabletOrDesktop.value);

// Desktop toasts sit bottom-left (380px wide); below ~1360px they collide with the centered bulk bar,
// so lift the bar above the toast stack (≈3.5rem per toast) while any are visible. Phones use fixed lanes.
const bulkBarStyle = computed(() => {
	const rows = Math.min(visibleToastRows.value, 6);
	if (windowWidth.value < 640 || windowWidth.value >= 1360 || rows === 0) return undefined;
	return { bottom: `calc(1.5rem + ${rows * 3.5}rem)` };
});

const leftPaneStyle = computed(() => {
	if (uiStore.splitViewMode !== "split" || !isTabletOrDesktop.value) return {};
	return { width: `${uiStore.splitPaneWidth}px` };
});

const clampPaneWidth = (w: number) => {
	const maxAllowed = Math.max(380, windowWidth.value - 420);
	return Math.max(320, Math.min(w, Math.min(850, maxAllowed)));
};

const startResizing = (e: MouseEvent) => {
	isResizing.value = true;
	startX.value = e.clientX;
	startWidth.value = uiStore.splitPaneWidth;
	window.addEventListener("mousemove", onMouseMove);
	window.addEventListener("mouseup", onMouseUp);
	document.body.style.cursor = "col-resize";
	document.body.style.userSelect = "none";
};
const onMouseMove = (e: MouseEvent) => {
	if (!isResizing.value) return;
	uiStore.setSplitPaneWidth(clampPaneWidth(startWidth.value + (e.clientX - startX.value)));
};
const onMouseUp = () => {
	isResizing.value = false;
	window.removeEventListener("mousemove", onMouseMove);
	window.removeEventListener("mouseup", onMouseUp);
	document.body.style.cursor = "";
	document.body.style.userSelect = "";
};
const startTouchResizing = (e: TouchEvent) => {
	if (e.touches.length !== 1) return;
	isResizing.value = true;
	startX.value = e.touches[0].clientX;
	startWidth.value = uiStore.splitPaneWidth;
	window.addEventListener("touchmove", onTouchMove, { passive: false });
	window.addEventListener("touchend", onTouchEnd);
};
const onTouchMove = (e: TouchEvent) => {
	if (!isResizing.value || e.touches.length !== 1) return;
	e.preventDefault();
	uiStore.setSplitPaneWidth(clampPaneWidth(startWidth.value + (e.touches[0].clientX - startX.value)));
};
const onTouchEnd = () => {
	isResizing.value = false;
	window.removeEventListener("touchmove", onTouchMove);
	window.removeEventListener("touchend", onTouchEnd);
};
const resetSplitWidth = () => uiStore.setSplitPaneWidth(480);
const handleWindowResize = () => {
	windowWidth.value = window.innerWidth;
};

// ── List state ───────────────────────────────────────────────────────────────
const currentListKey = computed(() => emailStore.listKeyFor(mailboxId.value, folderId.value));
/** True until the list for *this* mailbox+folder has loaded — never show another folder's rows. */
const showSkeleton = computed(() => emailStore.listKey !== currentListKey.value);
const showError = computed(() => showSkeleton.value && emailStore.errorKey === currentListKey.value);
const isFiltering = computed(() => filterMode.value !== "all" || searchQuery.value.trim() !== "");

const folderName = computed(() => {
	const found = folders.value.find((f) => f.id === folderId.value);
	if (found) return found.name;
	const id = folderId.value || "";
	return id.charAt(0).toUpperCase() + id.slice(1);
});

const folderUnread = computed(() => folders.value.find((f) => f.id === folderId.value)?.unreadCount || 0);

const filteredEmails = computed<Email[]>(() => {
	if (showSkeleton.value || !emails.value) return [];
	let list = emails.value;
	if (folderId.value === "starred") list = list.filter((e) => e.starred);

	switch (filterMode.value) {
		case "unread":
			list = list.filter((e) => !e.read);
			break;
		case "starred":
			list = list.filter((e) => e.starred);
			break;
		case "viewed":
			list = list.filter((e) => e.opened_count && e.opened_count > 0);
			break;
		case "unopened":
			list = list.filter((e) => !e.opened_count);
			break;
		case "clicked":
			list = list.filter((e) => e.clicked_count && e.clicked_count > 0);
			break;
		case "delivered":
			list = list.filter((e) => e.delivery_status !== "spam");
			break;
	}

	const q = searchQuery.value.toLowerCase().trim();
	if (q) {
		list = list.filter(
			(e) =>
				e.subject?.toLowerCase().includes(q) ||
				e.recipient?.toLowerCase().includes(q) ||
				e.sender?.toLowerCase().includes(q) ||
				e.cc?.toLowerCase().includes(q) ||
				e.body?.toLowerCase().includes(q),
		);
	}
	return list;
});

const listCountLabel = computed(() => {
	const loaded = emails.value.length;
	const more = hasMore.value ? "+" : "";
	if (isFiltering.value) return `${filteredEmails.value.length} of ${loaded}${more}`;
	if (!isOutgoingFolder.value && folderUnread.value > 0) return `${loaded}${more} · ${folderUnread.value} unread`;
	return `${loaded}${more} ${loaded === 1 ? "message" : "messages"}`;
});

// ── Sent analytics (computed over the loaded rows) ───────────────────────────
const sentStats = computed(() => {
	if (folderId.value !== "sent" || showSkeleton.value) {
		return { total: 0, opened: 0, openRate: 0, clicked: 0, clickRate: 0, inboxRate: 100, pending: 0 };
	}
	const list = emails.value;
	const total = list.length;
	const opened = list.filter((e) => e.opened_count && e.opened_count > 0).length;
	const clicked = list.filter((e) => e.clicked_count && e.clicked_count > 0).length;
	const spam = list.filter((e) => e.delivery_status === "spam").length;
	return {
		total,
		opened,
		openRate: total ? Math.round((opened / total) * 100) : 0,
		clicked,
		clickRate: total ? Math.round((clicked / total) * 100) : 0,
		inboxRate: total ? Math.round(((total - spam) / total) * 100) : 100,
		pending: total - opened,
	};
});

const sentCards = computed(() => [
	{ filter: "all" as FilterMode, label: "Sent", value: String(sentStats.value.total), hint: hasMore.value ? "latest" : "total" },
	{ filter: "viewed" as FilterMode, label: "Open rate", value: `${sentStats.value.openRate}%`, hint: `${sentStats.value.opened}/${sentStats.value.total}` },
	{ filter: "clicked" as FilterMode, label: "Click rate", value: `${sentStats.value.clickRate}%`, hint: `${sentStats.value.clicked} ${sentStats.value.clicked === 1 ? "click" : "clicks"}` },
	{ filter: "delivered" as FilterMode, label: "Inbox placement", value: `${sentStats.value.inboxRate}%`, hint: "SPF/DKIM" },
]);

const filterOptions = computed<{ id: FilterMode; label: string; count?: number }[]>(() => {
	if (folderId.value === "sent") {
		const opts: { id: FilterMode; label: string; count?: number }[] = [
			{ id: "all", label: "All" },
			{ id: "viewed", label: "Opened", count: sentStats.value.opened || undefined },
			{ id: "unopened", label: "Not opened", count: sentStats.value.pending || undefined },
		];
		if (sentStats.value.clicked > 0) opts.push({ id: "clicked", label: "Clicked", count: sentStats.value.clicked });
		opts.push({ id: "starred", label: "Starred" });
		return opts;
	}
	if (folderId.value === "starred") return [{ id: "all", label: "All" }, { id: "unread", label: "Unread" }];
	return [
		{ id: "all", label: "All" },
		{ id: "unread", label: "Unread", count: (isOutgoingFolder.value ? 0 : folderUnread.value) || undefined },
		{ id: "starred", label: "Starred" },
	];
});

// ── Date grouping ────────────────────────────────────────────────────────────
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const groupFor = (dateStr: string): string => {
	const d = new Date(dateStr);
	if (Number.isNaN(d.getTime())) return "Earlier";
	const today = startOfDay(new Date());
	const day = startOfDay(d);
	const diffDays = Math.round((today - day) / 86400000);
	if (diffDays <= 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return "Previous 7 days";
	const now = new Date();
	if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: "long" });
	return d.toLocaleDateString([], { month: "long", year: "numeric" });
};
/** Label to render *above* row idx (empty string when it's the same group as the previous row). */
const groupLabels = computed(() => {
	const labels: string[] = [];
	let prev = "";
	for (const e of filteredEmails.value) {
		const g = groupFor(e.date);
		labels.push(g !== prev ? g : "");
		prev = g;
	}
	return labels;
});

// ── Empty states ─────────────────────────────────────────────────────────────
const isInboxZero = computed(() => folderId.value === "inbox" && !isFiltering.value);
const emptyTitle = computed(() => {
	if (searchQuery.value) return `No messages match "${searchQuery.value}"`;
	if (isInboxZero.value) return "You're all caught up";
	switch (filterMode.value) {
		case "viewed":
			return "No opened emails yet";
		case "unopened":
			return "Every sent email has been opened";
		case "clicked":
			return "No link clicks yet";
		case "starred":
			return "No starred messages";
		case "unread":
			return "No unread messages";
	}
	if (folderId.value === "trash") return "Trash is empty";
	if (folderId.value === "archive") return "Nothing archived yet";
	if (folderId.value === "drafts" || folderId.value === "draft") return "No drafts";
	if (folderId.value === "starred") return "No starred messages";
	return `No messages in ${folderName.value}`;
});
const emptyHint = computed(() => {
	if (searchQuery.value) {
		return hasMore.value
			? "Only loaded messages are filtered. Use the search bar at the top to search the whole mailbox."
			: "Try different keywords or clear the filter.";
	}
	if (filterMode.value === "viewed") return "When recipients open your emails, they'll show up here.";
	if (folderId.value === "trash") return "Deleted messages land here and can be restored until you delete them forever.";
	if (folderId.value === "starred") return "Press s on any message to star it.";
	return "Messages will appear here as they arrive.";
});

// ── Selection ────────────────────────────────────────────────────────────────
const isAllSelected = computed(
	() => filteredEmails.value.length > 0 && filteredEmails.value.every((e) => selectedEmailIds.value.includes(e.id)),
);
const selectedEmails = computed(() => {
	const ids = new Set(selectedEmailIds.value);
	return emails.value.filter((e) => ids.has(e.id));
});
const allSelectedRead = computed(() => selectedEmails.value.length > 0 && selectedEmails.value.every((e) => e.read));

watch([selectedEmailIds, isAllSelected], () => {
	if (selectAllEl.value) {
		selectAllEl.value.indeterminate = selectedEmailIds.value.length > 0 && !isAllSelected.value;
	}
}, { deep: true, flush: "post" });

const toggleSelectAll = () => {
	selectedEmailIds.value = isAllSelected.value ? [] : filteredEmails.value.map((e) => e.id);
};

/** Click toggles one row; Shift+click selects the range from the last toggled row. */
const toggleSelectEmail = (emailId: string, event?: MouseEvent) => {
	const list = filteredEmails.value;
	const idx = list.findIndex((e) => e.id === emailId);
	if (event?.shiftKey && lastSelectedIndex.value >= 0 && idx >= 0) {
		const [a, b] = [Math.min(lastSelectedIndex.value, idx), Math.max(lastSelectedIndex.value, idx)];
		const range = list.slice(a, b + 1).map((e) => e.id);
		selectedEmailIds.value = Array.from(new Set([...selectedEmailIds.value, ...range]));
	} else {
		const i = selectedEmailIds.value.indexOf(emailId);
		if (i === -1) selectedEmailIds.value.push(emailId);
		else selectedEmailIds.value.splice(i, 1);
	}
	lastSelectedIndex.value = idx;
};

// ── Row interactions ─────────────────────────────────────────────────────────
const rowClass = (email: Email, idx: number) => {
	if (selectedEmailIds.value.includes(email.id)) return "bg-emerald-50/70 dark:bg-emerald-500/10";
	if (activeEmailId.value === email.id) return "bg-gray-100 dark:bg-gray-800";
	if (activeRowIndex.value === idx) return "bg-gray-50 dark:bg-gray-800/60";
	return "hover:bg-gray-50 dark:hover:bg-gray-800/50";
};

const openDetail = (email: Email) => {
	router.push({
		name: "EmailDetail",
		params: { mailboxId: mailboxId.value || "default", id: email.id },
		query: { fromFolder: folderId.value },
	});
};

// Touch: long-press a row to start multi-select (the checkbox column is hidden on phones to save space).
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let suppressNextClick = false;
const cancelLongPress = () => {
	if (longPressTimer) {
		clearTimeout(longPressTimer);
		longPressTimer = null;
	}
};
const onRowTouchStart = (email: Email) => {
	cancelLongPress();
	// If the previous long-press never produced a click (some browsers skip it), don't swallow this tap.
	suppressNextClick = false;
	longPressTimer = setTimeout(() => {
		longPressTimer = null;
		suppressNextClick = true;
		toggleSelectEmail(email.id);
		if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(10);
	}, 450);
};
const onRowContextMenu = (e: Event) => {
	// Prevent the native long-press menu from fighting the selection gesture on touch devices.
	if (!isTabletOrDesktop.value) e.preventDefault();
};

const handleRowClick = (email: Email, idx: number) => {
	if (suppressNextClick) {
		suppressNextClick = false;
		return;
	}
	// While selecting on a phone, taps toggle selection instead of opening the message.
	if (!isTabletOrDesktop.value && selectedEmailIds.value.length > 0) {
		toggleSelectEmail(email.id);
		return;
	}
	activeRowIndex.value = idx;
	if (folderId.value === "drafts" || folderId.value === "draft") {
		openDraftInComposer(email);
		return;
	}
	if (!isSplitActive.value) {
		openDetail(email);
		return;
	}
	activeEmailId.value = email.id;
};

const setRowRef = (el: any, index: number) => {
	if (el) rowElements.value[index] = el.$el || el;
};

const scrollToActiveRow = () => {
	nextTick(() => {
		rowElements.value[activeRowIndex.value]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	});
};

const moveCursor = (delta: number) => {
	const list = filteredEmails.value;
	if (list.length === 0) return;
	if (activeRowIndex.value === -1) activeRowIndex.value = 0;
	else activeRowIndex.value = Math.max(0, Math.min(list.length - 1, activeRowIndex.value + delta));
	// In split view the reading pane follows the cursor (continuous triage).
	if (isSplitActive.value) activeEmailId.value = list[activeRowIndex.value]?.id || null;
	scrollToActiveRow();
};

const handleReadingPanePrev = () => moveCursor(-1);
const handleReadingPaneNext = () => moveCursor(1);

const expandToFullView = () => {
	if (!activeEmailId.value) return;
	router.push({
		name: "EmailDetail",
		params: { id: activeEmailId.value },
		query: { fromFolder: folderId.value },
	});
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

const threadCountMap = computed(() => {
	const map = new Map<string, number>();
	for (const e of emails.value) {
		const key = e.thread_id || (e.subject ? e.subject.replace(/^(Re|Fwd):\s*/i, "").trim().toLowerCase() : e.id);
		map.set(key, (map.get(key) || 0) + 1);
	}
	return map;
});
const getThreadCount = (email: Email): number => {
	if (email.reply_count && email.reply_count > 1) return email.reply_count;
	const key =
		email.thread_id ||
		(email.subject ? email.subject.replace(/^(Re|Fwd):\s*/i, "").trim().toLowerCase() : email.id);
	return threadCountMap.value.get(key) || 1;
};

// ── Removal with cursor advance (archive / trash / delete forever) ───────────
/**
 * Runs an action that removes `rows` from the list and moves the cursor / reading pane to the next
 * surviving message (Superhuman-style "advance"), instead of leaving the pane on a message that's gone.
 */
const removeWithAdvance = (rows: Email[], action: () => Promise<unknown>, optimistic = true) => {
	const list = filteredEmails.value;
	const ids = new Set(rows.map((r) => r.id));
	const anchorId = activeEmailId.value || list[activeRowIndex.value]?.id || null;
	const anchorIdx = anchorId ? list.findIndex((e) => e.id === anchorId) : -1;
	let nextId: string | null = anchorId;
	if (anchorId && ids.has(anchorId)) {
		nextId = null;
		for (let i = anchorIdx + 1; i < list.length; i++) {
			if (!ids.has(list[i].id)) { nextId = list[i].id; break; }
		}
		if (!nextId) {
			for (let i = anchorIdx - 1; i >= 0; i--) {
				if (!ids.has(list[i].id)) { nextId = list[i].id; break; }
			}
		}
		if (activeEmailId.value) activeEmailId.value = nextId;
	}
	selectedEmailIds.value = selectedEmailIds.value.filter((id) => !ids.has(id));

	const resync = () => {
		activeRowIndex.value = nextId ? filteredEmails.value.findIndex((e) => e.id === nextId) : -1;
		if (activeRowIndex.value >= 0) scrollToActiveRow();
	};
	const p = action();
	if (optimistic) {
		// Optimistic moves remove rows synchronously inside the action, so re-anchor right away.
		// (Not again after the request settles — the user may already have moved on with j/k/e.)
		nextTick(resync);
	} else {
		p.finally(() => nextTick(resync));
	}
	return p;
};

const primaryMoveTarget = computed(() => (isRestoreFolder.value ? "inbox" : "archive"));

const handleArchive = (email: Email) =>
	removeWithAdvance([email], () => mail.moveEmails(mailboxId.value, [email], primaryMoveTarget.value, folderId.value));

const archiveSelected = () => {
	const rows = selectedEmails.value;
	if (rows.length === 0) return;
	return removeWithAdvance(rows, () => mail.moveEmails(mailboxId.value, rows, primaryMoveTarget.value, folderId.value));
};

// Permanent-delete confirm (Trash only)
const isDeleteConfirmOpen = ref(false);
const deleteConfirmTitle = ref("");
const deleteConfirmMessage = ref("");
const isExecutingDelete = ref(false);
const pendingDeleteRows = ref<Email[]>([]);

const confirmDeleteForever = (rows: Email[]) => {
	pendingDeleteRows.value = rows;
	deleteConfirmTitle.value = rows.length === 1 ? "Delete forever?" : `Delete ${rows.length} conversations forever?`;
	deleteConfirmMessage.value =
		"This permanently removes the message" + (rows.length === 1 ? "" : "s") + " and any attachments. This can't be undone.";
	isDeleteConfirmOpen.value = true;
};

const executePendingDelete = async () => {
	const rows = pendingDeleteRows.value;
	if (rows.length === 0) return;
	isExecutingDelete.value = true;
	try {
		await removeWithAdvance(rows, () => mail.deleteForever(mailboxId.value, rows), false);
		isDeleteConfirmOpen.value = false;
		pendingDeleteRows.value = [];
	} finally {
		isExecutingDelete.value = false;
	}
};

const handleDelete = (email: Email) => {
	if (folderId.value === "trash") {
		confirmDeleteForever([email]);
		return;
	}
	return removeWithAdvance([email], () => mail.trashEmails(mailboxId.value, [email], folderId.value));
};

const deleteSelected = () => {
	const rows = selectedEmails.value;
	if (rows.length === 0) return;
	if (folderId.value === "trash") {
		confirmDeleteForever(rows);
		return;
	}
	return removeWithAdvance(rows, () => mail.trashEmails(mailboxId.value, rows, folderId.value));
};

const markSelectedRead = (read: boolean) => mail.setRead(mailboxId.value, selectedEmails.value, read);
const toggleReadStatus = (email: Email) => mail.setRead(mailboxId.value, [email], !email.read);
const toggleStarStatus = (email: Email) => mail.setStarred(mailboxId.value, [email], !email.starred);

const findInList = (id: string, fallback: Email) => emails.value.find((e) => e.id === id) || fallback;
const onReadingPaneArchive = (email: Email) => handleArchive(findInList(email.id, email));
const onReadingPaneTrash = (email: Email) => handleDelete(findInList(email.id, email));

const handleOpenLinkApp = (email: Email) => {
	const target = getTargetEmail(email, folderId.value);
	const clean = extractCleanEmail(target);
	const binding = clean ? appBindingsStore.getBinding(clean) : null;
	appBindingsStore.openLinkModal(clean || target, binding);
};

const handleQuickReply = (email: Email, mode: "reply" | "reply-all" | "forward" = "reply") => {
	uiStore.openComposeModal({ mode, originalEmail: email });
};

// ── Formatting helpers ───────────────────────────────────────────────────────
const getTargetEmail = (email: Email, folder: string): string =>
	folder === "sent" || folder === "drafts" || folder === "draft" ? email.recipient : email.sender;

/** "Jane Doe <jane@x.com>" -> "Jane Doe"; bare address stays as-is. */
const getDisplayName = (raw?: string | null): string => {
	if (!raw) return "(Unknown sender)";
	const m = raw.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
	return m && m[1].trim() ? m[1].trim() : raw;
};

const getParsedRecipients = (recipientStr?: string | null): { primary: string; extrasCount: number } => {
	if (!recipientStr) return { primary: "(No recipient)", extrasCount: 0 };
	const parts = recipientStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
	if (parts.length === 0) return { primary: "(No recipient)", extrasCount: 0 };
	return { primary: getDisplayName(parts[0]), extrasCount: parts.length - 1 };
};

const getAvatarInitial = (email: Email, folder: string): string => {
	const raw = getTargetEmail(email, folder);
	if (!raw) return "?";
	const clean = getDisplayName(raw).replace(/<[^>]+>/, "").replace(/^["'\s]+/, "").trim();
	return (clean.charAt(0) || "?").toUpperCase();
};

const snippetCache = new Map<string, string>();
const getSnippet = (body?: string | null, maxLen = 120): string => {
	if (!body) return "";
	const cached = snippetCache.get(body);
	if (cached !== undefined) return cached;
	const text = body
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&quot;/gi, '"')
		.replace(/\s+/g, " ")
		.trim();
	const out = text.length <= maxLen ? text : `${text.slice(0, maxLen)}…`;
	if (snippetCache.size > 2000) snippetCache.clear();
	snippetCache.set(body, out);
	return out;
};

const formatFriendlyDate = (dateStr?: string | null): string => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	if (Number.isNaN(date.getTime())) return dateStr;
	const now = new Date();
	const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
	if (diffDays <= 0) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
	if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { month: "short", day: "numeric" });
	return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
};

const formatTooltipDate = (dateStr?: string | null): string => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	if (Number.isNaN(date.getTime())) return dateStr;
	return date.toLocaleString([], {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};

// ── Shortcuts ────────────────────────────────────────────────────────────────
const shortcutGroups = computed(() => [
	{
		title: "Navigate",
		items: [
			{ label: "Next / previous", keys: ["j", "k"] },
			{ label: "Open", keys: ["Enter"] },
			{ label: "Close pane / clear", keys: ["Esc"] },
			{ label: "Filter this folder", keys: ["/"] },
			{ label: "Command palette", keys: ["⌘", "K"] },
		],
	},
	{
		title: "Act",
		items: [
			{ label: isRestoreFolder.value ? "Move to Inbox" : "Archive", keys: ["e"] },
			{ label: folderId.value === "trash" ? "Delete forever" : "Move to Trash", keys: ["#"] },
			{ label: "Undo last action", keys: ["z"] },
			{ label: "Star / unstar", keys: ["s"] },
			{ label: "Mark read / unread", keys: ["u"] },
			{ label: "Select row", keys: ["x"] },
		],
	},
	{
		title: "Write",
		items: [
			{ label: "Compose", keys: ["c"] },
			{ label: "Reply", keys: ["r"] },
			{ label: "Reply all", keys: ["a"] },
			{ label: "Forward", keys: ["f"] },
		],
	},
]);

const onSearchEscape = () => {
	if (searchQuery.value) searchQuery.value = "";
	else searchInputEl.value?.blur();
};

const handleKeyDown = (e: KeyboardEvent) => {
	const el = document.activeElement as HTMLElement | null;
	const tag = el?.tagName?.toLowerCase();
	if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
	if (e.metaKey || e.ctrlKey || e.altKey) return;
	if (uiStore.isComposeModalOpen || appBindingsStore.isModalOpen || uiStore.isCommandPaletteOpen) return;
	if (isDeleteConfirmOpen.value) return;

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

	if (e.key === "/") {
		e.preventDefault();
		searchInputEl.value?.focus();
		searchInputEl.value?.select();
		return;
	}
	if (e.key === "c" || e.key === "C") {
		e.preventDefault();
		uiStore.openComposeModal();
		return;
	}
	if (e.key === "Escape") {
		if (activeEmailId.value) {
			activeEmailId.value = null;
		} else if (selectedEmailIds.value.length > 0) {
			selectedEmailIds.value = [];
		} else if (searchQuery.value) {
			searchQuery.value = "";
		} else {
			activeRowIndex.value = -1;
		}
		e.preventDefault();
		return;
	}

	const list = filteredEmails.value;
	if (list.length === 0) return;

	if (e.key === "j" || e.key === "ArrowDown") {
		e.preventDefault();
		moveCursor(1);
		return;
	}
	if (e.key === "k" || e.key === "ArrowUp") {
		e.preventDefault();
		moveCursor(-1);
		return;
	}

	// Bulk-aware actions
	if (selectedEmailIds.value.length > 0) {
		if (e.key === "e" || e.key === "E") { e.preventDefault(); archiveSelected(); return; }
		if (e.key === "#" || e.key === "d" || e.key === "D" || e.key === "Delete") { e.preventDefault(); deleteSelected(); return; }
		if (e.key === "u" || e.key === "U") { e.preventDefault(); markSelectedRead(!allSelectedRead.value); return; }
	}

	const active = activeRowIndex.value >= 0 && activeRowIndex.value < list.length ? list[activeRowIndex.value] : null;
	if (!active) return;

	switch (e.key) {
		case "Enter":
		case "o":
			e.preventDefault();
			if (folderId.value === "drafts" || folderId.value === "draft") openDraftInComposer(active);
			else if (isSplitActive.value) activeEmailId.value = active.id;
			else openDetail(active);
			return;
		case "x":
		case "X":
			e.preventDefault();
			toggleSelectEmail(active.id);
			return;
		case "s":
		case "S":
			e.preventDefault();
			toggleStarStatus(active);
			return;
		case "u":
		case "U":
			e.preventDefault();
			toggleReadStatus(active);
			return;
		case "e":
		case "E":
			e.preventDefault();
			handleArchive(active);
			return;
		case "#":
		case "d":
		case "D":
		case "Delete":
			e.preventDefault();
			handleDelete(active);
			return;
		case "r":
		case "R":
			if (isOutgoingFolder.value) return;
			e.preventDefault();
			handleQuickReply(active, "reply");
			return;
		case "a":
		case "A":
			if (isOutgoingFolder.value) return;
			e.preventDefault();
			handleQuickReply(active, "reply-all");
			return;
		case "f":
		case "F":
			e.preventDefault();
			handleQuickReply(active, "forward");
			return;
	}
};

// ── Loading, refresh, infinite scroll ────────────────────────────────────────
const loadEmails = async () => {
	if (!mailboxId.value) return;
	try {
		await emailStore.fetchEmails(mailboxId.value, { folder: folderId.value });
	} catch (err) {
		console.error("Failed to load emails", err);
	}
};

const loadMore = async () => {
	if (!mailboxId.value) return;
	try {
		await emailStore.fetchMoreEmails(mailboxId.value, folderId.value);
		// Re-observe so a sentinel that is *still* visible (short pages / tall screens) keeps paging.
		await nextTick();
		setupObserver();
	} catch (err) {
		console.error("Failed to load more emails", err);
	}
};

let observer: IntersectionObserver | null = null;
const setupObserver = () => {
	observer?.disconnect();
	if (typeof IntersectionObserver === "undefined" || !sentinelEl.value) return;
	observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((en) => en.isIntersecting) && hasMore.value && !isFiltering.value && !isLoadingMore.value) {
				loadMore();
			}
		},
		{ root: listScrollEl.value, rootMargin: "400px 0px" },
	);
	observer.observe(sentinelEl.value);
};
watch(sentinelEl, () => setupObserver(), { flush: "post" });

let refreshInterval: ReturnType<typeof setInterval> | null = null;
const startAutoRefresh = () => {
	if (refreshInterval) clearInterval(refreshInterval);
	refreshInterval = setInterval(() => {
		if (!mailboxId.value || document.visibilityState === "hidden") return;
		loadEmails();
		folderStore.fetchFolders(mailboxId.value).catch(() => {});
		appBindingsStore.fetchBindings(true);
	}, 30000);
};
const stopAutoRefresh = () => {
	if (refreshInterval) {
		clearInterval(refreshInterval);
		refreshInterval = null;
	}
};
const onVisibilityChange = () => {
	if (document.visibilityState === "visible" && mailboxId.value) {
		loadEmails();
		folderStore.fetchFolders(mailboxId.value).catch(() => {});
	}
};

const handleRefresh = () => {
	loadEmails();
	folderStore.fetchFolders(mailboxId.value).catch(() => {});
	appBindingsStore.fetchBindings(true);
};

// Window title reflects folder + unread count.
watch(
	[folderName, folderUnread, () => route.fullPath],
	() => {
		const unread = !isOutgoingFolder.value && folderUnread.value > 0 ? ` (${folderUnread.value})` : "";
		document.title = `${folderName.value}${unread} — Reflect Mail`;
	},
	{ immediate: true, flush: "post" },
);

onMounted(() => {
	loadEmails();
	startAutoRefresh();
	window.addEventListener("keydown", handleKeyDown);
	window.addEventListener("resize", handleWindowResize);
	document.addEventListener("visibilitychange", onVisibilityChange);
});

onUnmounted(() => {
	stopAutoRefresh();
	cancelLongPress();
	observer?.disconnect();
	window.removeEventListener("keydown", handleKeyDown);
	window.removeEventListener("resize", handleWindowResize);
	document.removeEventListener("visibilitychange", onVisibilityChange);
	window.removeEventListener("mousemove", onMouseMove);
	window.removeEventListener("mouseup", onMouseUp);
	window.removeEventListener("touchmove", onTouchMove);
	window.removeEventListener("touchend", onTouchEnd);
	document.body.style.cursor = "";
	document.body.style.userSelect = "";
});

watch([mailboxId, folderId], () => {
	filterMode.value = "all";
	searchQuery.value = "";
	selectedEmailIds.value = [];
	lastSelectedIndex.value = -1;
	activeRowIndex.value = -1;
	activeEmailId.value = null;
	rowElements.value = [];
	listScrollEl.value?.scrollTo({ top: 0 });
	loadEmails();
});

watch(filterMode, () => {
	activeRowIndex.value = -1;
	selectedEmailIds.value = [];
});

watch(
	() => filteredEmails.value.length,
	(len) => {
		if (activeRowIndex.value >= len) activeRowIndex.value = len > 0 ? len - 1 : -1;
	},
);
</script>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Long-press = multi-select on touch screens: keep iOS/Android from starting a text selection or link callout. */
@media (pointer: coarse) {
  .touch-row {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
}

/* Bulk bar sits above the mobile bottom nav (+ safe area). */
.bulk-bar {
  bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
  transition-property: opacity, transform, translate, bottom;
  transition-duration: 0.18s;
}
@media (min-width: 640px) {
  .bulk-bar {
    bottom: 1.5rem;
  }
}

.bulk-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  color: rgb(229 231 235);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  white-space: nowrap;
}
.bulk-btn:hover {
  background-color: rgb(255 255 255 / 0.1);
  color: #fff;
}
</style>
