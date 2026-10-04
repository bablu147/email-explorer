<template>
  <div class="flex-1 flex flex-col min-h-full bg-gray-50/50 dark:bg-gray-950 transition-colors">
    <!-- Top Header & Action Bar -->
    <div class="px-5 py-4 sm:px-8 sm:py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Title & Stats -->
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Contacts Directory
            </h1>
            <span class="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              {{ contacts.length }} {{ contacts.length === 1 ? 'Contact' : 'Contacts' }}
            </span>
            <span v-if="boundContactsCount > 0" class="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
              <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              <span>{{ boundContactsCount }} App Bound</span>
            </span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage developer leads, game studio executives, and MMP client relationships.
          </p>
        </div>

        <!-- Controls: Search, View Mode, Export & Add Contact -->
        <div class="flex flex-wrap items-center gap-2.5">
          <!-- Live Search Input -->
          <div class="relative flex-grow sm:flex-grow-0 sm:w-64">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name, email, app..."
              class="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base sm:text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <svg class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <button
              v-if="searchQuery"
              type="button"
              @click="searchQuery = ''"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
              title="Clear search"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- View Mode Toggle (Grid / Table) -->
          <div class="hidden sm:flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              @click="viewMode = 'grid'"
              class="p-1.5 rounded-lg transition-all cursor-pointer"
              :class="viewMode === 'grid' ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'"
              title="Grid Cards View"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke-width="2" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke-width="2" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke-width="2" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke-width="2" />
              </svg>
            </button>
            <button
              type="button"
              @click="viewMode = 'table'"
              class="p-1.5 rounded-lg transition-all cursor-pointer"
              :class="viewMode === 'table' ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'"
              title="Dense Table View"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <!-- Export CSV -->
          <button
            type="button"
            @click="exportContactsCsv"
            :disabled="filteredContacts.length === 0"
            class="px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            title="Export contacts as CSV"
          >
            <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>

          <!-- Add Contact Button -->
          <button
            type="button"
            @click="openAddContactModal"
            class="px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 text-xs">
        <button
          type="button"
          @click="filterTab = 'all'"
          class="px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
          :class="filterTab === 'all' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
        >
          All Contacts ({{ contacts.length }})
        </button>
        <button
          type="button"
          @click="filterTab = 'bound'"
          class="px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
          :class="filterTab === 'bound' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
        >
          App Bound ({{ boundContactsCount }})
        </button>
        <button
          type="button"
          @click="filterTab = 'unbound'"
          class="px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
          :class="filterTab === 'unbound' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
        >
          Unbound ({{ contacts.length - boundContactsCount }})
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 p-5 sm:p-8">
      <!-- Loading Skeleton -->
      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
        <div v-for="i in 8" :key="i" class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-800"></div>
            <div class="space-y-1.5 flex-1">
              <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
              <div class="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
            </div>
          </div>
          <div class="h-14 bg-gray-100 dark:bg-gray-800/60 rounded-xl"></div>
          <div class="h-8 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
        </div>
      </div>

      <!-- Empty State: Zero contacts created yet -->
      <div
        v-else-if="contacts.length === 0"
        class="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg mx-auto mt-8 shadow-xs"
      >
        <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 class="text-base font-bold text-gray-900 dark:text-white mb-1">
          No contacts in this mailbox yet
        </h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-6 leading-relaxed">
          Create contacts to organize studio leads, bind target mobile apps, and launch targeted MMP outreach campaigns with one click.
        </p>
        <button
          type="button"
          @click="openAddContactModal"
          class="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Your First Contact</span>
        </button>
      </div>

      <!-- Empty State: Filter or Search returned 0 -->
      <div
        v-else-if="filteredContacts.length === 0"
        class="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md mx-auto mt-8"
      >
        <div class="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mb-3">
          <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-1">
          No matching contacts found
        </h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          No contacts match your current query "{{ searchQuery }}".
        </p>
        <button
          type="button"
          @click="searchQuery = ''; filterTab = 'all'"
          class="px-3.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors cursor-pointer"
        >
          Reset Filters
        </button>
      </div>

      <!-- 1. Grid Cards Layout -->
      <div
        v-else-if="viewMode === 'grid'"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        <div
          v-for="contact in filteredContacts"
          :key="contact.id"
          class="bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group hover:border-gray-300 dark:hover:border-gray-700"
        >
          <!-- Contact Top Info -->
          <div>
            <div class="flex items-start justify-between gap-3 mb-3.5">
              <!-- Avatar & Name -->
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs flex-shrink-0"
                  :style="{ background: getAvatarGradient(contact.name || contact.email) }"
                >
                  {{ getInitials(contact.name || contact.email) }}
                </div>
                <div class="min-w-0">
                  <h3 class="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {{ contact.name || "Unnamed Contact" }}
                  </h3>
                  <div class="flex items-center gap-1 mt-0.5">
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
                      {{ contact.email }}
                    </p>
                    <button
                      type="button"
                      @click="copyEmail(contact.email)"
                      class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-0.5 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy email address"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <!-- More Menu / Edit-Delete buttons -->
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  type="button"
                  @click="openEditContactModal(contact)"
                  class="p-1 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  title="Edit contact"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  type="button"
                  @click="confirmDeleteContact(contact)"
                  class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  title="Delete contact"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Linked App Card Section -->
            <div class="my-3">
              <div
                v-if="getBindingForEmail(contact.email)"
                class="p-2.5 rounded-xl bg-gray-50/80 dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-700/60 flex items-center justify-between gap-2.5"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <img
                    :src="getBindingForEmail(contact.email)!.app_icon_url"
                    :alt="getBindingForEmail(contact.email)!.app_name"
                    class="w-7 h-7 rounded-lg object-cover border border-gray-200 dark:border-gray-700 flex-shrink-0"
                    @error="onImgError"
                  />
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {{ getBindingForEmail(contact.email)!.app_name }}
                    </p>
                    <span class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      {{ getPlatformLabel(getBindingForEmail(contact.email)!.platform) }}
                    </span>
                  </div>
                </div>

                <a
                  :href="getBindingForEmail(contact.email)!.app_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-1 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  title="View Store Page"
                  @click.stop
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <!-- Unbound State: Button to Link App -->
              <button
                v-else
                type="button"
                @click="openLinkModalForContact(contact.email)"
                class="w-full p-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer group/btn"
              >
                <svg class="w-3.5 h-3.5 text-gray-400 group-hover/btn:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>+ Bind Mobile App</span>
              </button>
            </div>
          </div>

          <!-- Bottom Action: Quick Outreach Compose -->
          <button
            type="button"
            @click="composeOutreachToContact(contact)"
            class="w-full mt-2 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/20 group-hover:border-emerald-500/40"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      <!-- 2. Dense Table Layout -->
      <div
        v-else-if="viewMode === 'table'"
        class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th class="py-3 px-5">Contact</th>
                <th class="py-3 px-5">Email</th>
                <th class="py-3 px-5">Bound App Studio</th>
                <th class="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
              <tr
                v-for="contact in filteredContacts"
                :key="contact.id"
                class="hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors group"
              >
                <!-- Contact Name & Avatar -->
                <td class="py-3 px-5">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-xs flex-shrink-0"
                      :style="{ background: getAvatarGradient(contact.name || contact.email) }"
                    >
                      {{ getInitials(contact.name || contact.email) }}
                    </div>
                    <span class="font-bold text-gray-900 dark:text-white truncate">
                      {{ contact.name || "Unnamed" }}
                    </span>
                  </div>
                </td>

                <!-- Contact Email -->
                <td class="py-3 px-5 font-mono text-gray-600 dark:text-gray-300">
                  <div class="flex items-center gap-1.5">
                    <span>{{ contact.email }}</span>
                    <button
                      type="button"
                      @click="copyEmail(contact.email)"
                      class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-0.5 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy email"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </td>

                <!-- Bound App Studio -->
                <td class="py-3 px-5">
                  <div v-if="getBindingForEmail(contact.email)" class="flex items-center gap-2">
                    <img
                      :src="getBindingForEmail(contact.email)!.app_icon_url"
                      class="w-5 h-5 rounded-md object-cover border border-gray-200 dark:border-gray-700"
                      @error="onImgError"
                    />
                    <span class="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[180px]">
                      {{ getBindingForEmail(contact.email)!.app_name }}
                    </span>
                    <span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                      {{ getPlatformLabel(getBindingForEmail(contact.email)!.platform) }}
                    </span>
                  </div>
                  <button
                    v-else
                    type="button"
                    @click="openLinkModalForContact(contact.email)"
                    class="text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium cursor-pointer"
                  >
                    + Bind App
                  </button>
                </td>

                <!-- Actions -->
                <td class="py-3 px-5 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      @click="composeOutreachToContact(contact)"
                      class="px-2.5 py-1 text-xs font-bold rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                    >
                      Compose
                    </button>
                    <button
                      type="button"
                      @click="openEditContactModal(contact)"
                      class="p-1 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      @click="confirmDeleteContact(contact)"
                      class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Add / Edit Contact Modal -->
    <Teleport to="body">
      <div
        v-if="isContactModalOpen"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        @click.self="isContactModalOpen = false"
        @keydown.esc="isContactModalOpen = false"
      >
        <div class="w-full max-w-md bg-white dark:bg-gray-900 border-t sm:border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white">
              {{ editingContact ? "Edit Contact" : "Add New Contact" }}
            </h3>
            <button
              type="button"
              @click="isContactModalOpen = false"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg"
              title="Close modal"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form @submit.prevent="saveContact">
            <div class="space-y-4 mb-6">
              <div>
                <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Contact Name
                </label>
                <input
                  ref="contactNameInputRef"
                  v-model="contactForm.name"
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera, Supercell BD"
                  class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Email Address
                </label>
                <input
                  v-model="contactForm.email"
                  type="email"
                  required
                  placeholder="alex@supercell.com"
                  class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5">
              <button
                type="button"
                @click="isContactModalOpen = false"
                class="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSubmitting || !contactForm.name || !contactForm.email"
                class="px-4 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{{ editingContact ? "Update Contact" : "Create Contact" }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Custom Delete Confirmation Modal (Eliminating native confirm) -->
    <ConfirmModal
      :is-open="isDeleteConfirmOpen"
      title="Delete Contact"
      :message="`Are you sure you want to delete ${contactToDelete?.name || contactToDelete?.email || 'this contact'} from your directory?`"
      confirm-text="Delete Contact"
      :danger="true"
      :loading="isDeleting"
      @close="isDeleteConfirmOpen = false"
      @confirm="executeDeleteContact"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import ConfirmModal from "@/components/ConfirmModal.vue";
import { useToast } from "@/composables/useToast";
import { useAppBindingsStore, extractCleanEmail } from "@/stores/appBindings";
import { useContactStore } from "@/stores/contacts";
import { useUIStore } from "@/stores/ui";
import type { AppBinding, Contact } from "@/types";

const contactStore = useContactStore();
const { contacts } = storeToRefs(contactStore);
const appBindingsStore = useAppBindingsStore();
const uiStore = useUIStore();
const route = useRoute();
const { success: showSuccessToast, error: showErrorToast } = useToast();

const loading = ref(true);
const isSubmitting = ref(false);
const isDeleting = ref(false);
const searchQuery = ref("");
const filterTab = ref<"all" | "bound" | "unbound">("all");
const viewMode = ref<"grid" | "table">("grid");

// Add / Edit Modal state
const isContactModalOpen = ref(false);
const editingContact = ref<Contact | null>(null);
const contactNameInputRef = ref<HTMLInputElement | null>(null);
const contactForm = ref({
	name: "",
	email: "",
});

// Delete Confirmation state
const isDeleteConfirmOpen = ref(false);
const contactToDelete = ref<Contact | null>(null);

const mailboxId = computed(() => route.params.mailboxId as string);

onMounted(async () => {
	loading.value = true;
	try {
		await Promise.all([
			contactStore.fetchContacts(mailboxId.value),
			appBindingsStore.fetchBindings(),
		]);
	} catch (e) {
		console.error("Failed to fetch contacts", e);
	} finally {
		loading.value = false;
	}
});

const getBindingForEmail = (rawEmail: string): AppBinding | null => {
	return appBindingsStore.getBinding(rawEmail);
};

const boundContactsCount = computed(() => {
	return contacts.value.filter((c) => !!getBindingForEmail(c.email)).length;
});

const filteredContacts = computed(() => {
	let list = contacts.value;

	if (filterTab.value === "bound") {
		list = list.filter((c) => !!getBindingForEmail(c.email));
	} else if (filterTab.value === "unbound") {
		list = list.filter((c) => !getBindingForEmail(c.email));
	}

	const q = searchQuery.value.trim().toLowerCase();
	if (!q) return list;

	return list.filter((c) => {
		const nameMatch = c.name?.toLowerCase().includes(q);
		const emailMatch = c.email?.toLowerCase().includes(q);
		const binding = getBindingForEmail(c.email);
		const appMatch = binding?.app_name?.toLowerCase().includes(q);
		return nameMatch || emailMatch || appMatch;
	});
});

const getPlatformLabel = (platform: string) => {
	switch (platform) {
		case "playstore": return "Google Play";
		case "appstore": return "App Store";
		case "website": return "Website";
		default: return platform;
	}
};

const onImgError = (event: Event) => {
	const target = event.target as HTMLImageElement;
	target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%2310b981" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 18h.01"/></svg>';
};

const getInitials = (nameOrEmail: string): string => {
	if (!nameOrEmail) return "C";
	const parts = nameOrEmail.trim().split(" ");
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return nameOrEmail.slice(0, 2).toUpperCase();
};

const getAvatarGradient = (str: string): string => {
	const gradients = [
		"linear-gradient(135deg, #10b981 0%, #059669 100%)",
		"linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
		"linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
		"linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
		"linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
		"linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
	];
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
	}
	return gradients[Math.abs(hash) % gradients.length];
};

const copyEmail = async (email: string) => {
	try {
		await navigator.clipboard.writeText(email);
		showSuccessToast("Email copied to clipboard");
	} catch (e) {
		showErrorToast("Could not copy email");
	}
};

const openAddContactModal = () => {
	editingContact.value = null;
	contactForm.value = { name: "", email: "" };
	isContactModalOpen.value = true;
	nextTick(() => {
		contactNameInputRef.value?.focus();
	});
};

const openEditContactModal = (contact: Contact) => {
	editingContact.value = contact;
	contactForm.value = { name: contact.name, email: contact.email };
	isContactModalOpen.value = true;
	nextTick(() => {
		contactNameInputRef.value?.focus();
	});
};

const saveContact = async () => {
	const name = contactForm.value.name.trim();
	const email = extractCleanEmail(contactForm.value.email.trim());

	if (!name || !email) return;

	isSubmitting.value = true;
	try {
		if (editingContact.value) {
			await contactStore.updateContact(mailboxId.value, editingContact.value.id, {
				name,
				email,
			});
			showSuccessToast("Contact updated successfully");
		} else {
			await contactStore.createContact(mailboxId.value, {
				name,
				email,
			});
			showSuccessToast("Contact added successfully");
		}
		isContactModalOpen.value = false;
	} catch (e) {
		console.error("Failed to save contact", e);
		showErrorToast("Failed to save contact");
	} finally {
		isSubmitting.value = false;
	}
};

const confirmDeleteContact = (contact: Contact) => {
	contactToDelete.value = contact;
	isDeleteConfirmOpen.value = true;
};

const executeDeleteContact = async () => {
	if (!contactToDelete.value) return;
	isDeleting.value = true;
	try {
		await contactStore.deleteContact(mailboxId.value, contactToDelete.value.id);
		showSuccessToast("Contact deleted");
		isDeleteConfirmOpen.value = false;
		contactToDelete.value = null;
	} catch (e) {
		console.error("Failed to delete contact", e);
		showErrorToast("Failed to delete contact");
	} finally {
		isDeleting.value = false;
	}
};

const openLinkModalForContact = (email: string) => {
	appBindingsStore.openLinkModal(email, getBindingForEmail(email));
};

const composeOutreachToContact = (contact: Contact) => {
	const binding = getBindingForEmail(contact.email);
	uiStore.openComposeModal({
		mode: "new",
		initialTo: contact.email,
		initialSubject: binding ? `Attribution & Growth for ${binding.app_name} | Reflect MMP` : `Reflect MMP Partnership`,
		appBinding: binding,
	});
};

const exportContactsCsv = () => {
	const rows = [
		["Name", "Email", "Linked App", "Platform", "Store URL"],
	];

	for (const c of filteredContacts.value) {
		const binding = getBindingForEmail(c.email);
		rows.push([
			c.name || "",
			c.email || "",
			binding?.app_name || "",
			binding?.platform || "",
			binding?.app_url || "",
		]);
	}

	const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
	const encodedUri = encodeURI(csvContent);
	const link = document.createElement("a");
	link.setAttribute("href", encodedUri);
	link.setAttribute("download", `reflect_contacts_${new Date().toISOString().slice(0, 10)}.csv`);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	showSuccessToast(`Exported ${filteredContacts.value.length} contacts to CSV`);
};
</script>
