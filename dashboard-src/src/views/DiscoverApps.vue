<template>
  <div ref="scrollContainer" @scroll="handleScroll" class="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 overflow-y-auto">
    <!-- Top Hub Header -->
    <div class="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs flex-shrink-0">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <!-- Radar / Compass Icon -->
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke-width="2" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" stroke-width="1.5" />
              </svg>
            </div>
            <div>
              <h1 class="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>App Discovery & MMP Outreach</span>
                <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Engine
                </span>
              </h1>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Target high-growth mobile games & apps, extract verified developer contacts, and pitch the Reflect MMP plan in 1 click.
              </p>
            </div>
          </div>
        </div>

        <!-- Right Quick Actions: Discovered vs Saved Tabs, View Mode, Export, Refresh -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Discover / Saved Tabs -->
          <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200/80 dark:border-gray-700/80 text-xs font-semibold">
            <button
              type="button"
              @click="setTab('discover')"
              :class="filters.activeTab === 'discover' ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
              class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" stroke-width="2" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v18m-9-9h18" />
              </svg>
              <span>Discovered</span>
            </button>

            <button
              type="button"
              @click="setTab('leads')"
              :class="filters.activeTab === 'leads' ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-xs font-bold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
              class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Saved Targets</span>
              <span v-if="stats.saved_targets > 0" class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                {{ stats.saved_targets }}
              </span>
            </button>
          </div>

          <!-- View Mode Toggle: Grid vs Table -->
          <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200/80 dark:border-gray-700/80">
            <button
              type="button"
              @click="filters.viewMode = 'grid'"
              :class="filters.viewMode === 'grid' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'"
              class="p-1.5 rounded-lg transition-all cursor-pointer"
              title="Cards Grid View"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke-width="2" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke-width="2" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke-width="2" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke-width="2" />
              </svg>
            </button>
            <button
              type="button"
              @click="filters.viewMode = 'table'"
              :class="filters.viewMode === 'table' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'"
              class="p-1.5 rounded-lg transition-all cursor-pointer"
              title="High-Density Table View"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          <!-- Export CSV -->
          <button
            type="button"
            @click="exportCsv"
            :disabled="displayedApps.length === 0"
            class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-gray-700/80 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Export filtered targets to CSV spreadsheet"
          >
            <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>

          <!-- Refresh -->
          <button
            type="button"
            @click="refreshData"
            :disabled="loading || leadsLoading"
            class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh app data"
          >
            <svg class="w-4 h-4" :class="{ 'animate-spin': loading || leadsLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Responsive Filter Control Bar -->
    <div class="relative px-4 sm:px-6 py-3.5 bg-white dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 shadow-xs flex-shrink-0">
      <!-- Loading Progress Shimmer Bar -->
      <div v-if="loading" class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-100 dark:bg-emerald-950 overflow-hidden z-10">
        <div class="h-full bg-emerald-500 animate-pulse w-full"></div>
      </div>

      <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <!-- Search Input -->
        <div class="relative flex-1 min-w-[220px]">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            v-model="searchInput"
            @input="onSearchInput"
            placeholder="Search by app title, developer name, package ID..."
            class="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          <button
            v-if="searchInput"
            @click="clearSearch"
            type="button"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
            title="Clear search"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Filter Dropdowns & Pills -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Platform Selector Pills -->
          <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200/80 dark:border-gray-700/80 text-xs font-semibold">
            <button
              type="button"
              @click="setPlatform('all')"
              :disabled="loading"
              :class="filters.platform === 'all' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
              class="px-2.5 py-1 rounded-lg transition-all cursor-pointer disabled:opacity-70"
            >
              All Stores
            </button>
            <button
              type="button"
              @click="setPlatform('playstore')"
              :disabled="loading"
              :class="filters.platform === 'playstore' ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
              class="px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
            >
              <svg class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.793 12 3.61 22.186a1.94 1.94 0 01-.21-.864V2.678c0-.317.075-.615.21-.864zm11.603 11.604l2.45-2.45-12.05-6.95 9.6 9.4zm0-2.836l-9.6 9.4 12.05-6.95-2.45-2.45zm1.414-1.414l3.197 1.846c.868.502.868 1.314 0 1.816l-3.197 1.846-2.121-2.12 2.121-1.888z"/></svg>
              <span>Google Play</span>
            </button>
            <button
              type="button"
              @click="setPlatform('appstore')"
              :disabled="loading"
              :class="filters.platform === 'appstore' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
              class="px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
            >
              <svg class="w-3.5 h-3.5 text-gray-800 dark:text-gray-200" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.66-.82 1.11-1.96.99-3.1-.97.04-2.14.65-2.83 1.46-.61.71-1.15 1.88-1.01 2.99 1.08.08 2.19-.53 2.85-1.35z"/></svg>
              <span>App Store</span>
            </button>
          </div>

          <!-- Country Dropdown -->
          <select
            v-model="filters.country"
            @change="onFilterChange"
            :disabled="loading"
            class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-70"
          >
            <option value="US">United States (US)</option>
            <option value="GB">United Kingdom (GB)</option>
            <option value="DE">Germany (DE)</option>
            <option value="JP">Japan (JP)</option>
            <option value="KR">South Korea (KR)</option>
            <option value="IN">India (IN)</option>
            <option value="BR">Brazil (BR)</option>
            <option value="CA">Canada (CA)</option>
            <option value="FR">France (FR)</option>
            <option value="AU">Australia (AU)</option>
            <option value="GLOBAL">Global (Worldwide)</option>
          </select>

          <!-- Category / Genre Dropdown -->
          <select
            v-model="filters.category"
            @change="onFilterChange"
            :disabled="loading"
            class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-70"
          >
            <option value="all">All Categories</option>
            <option value="Games">All Games</option>
            <option value="Action">Action Games</option>
            <option value="Casual">Casual Games</option>
            <option value="RPG">RPG Games</option>
            <option value="Strategy">Strategy Games</option>
            <option value="Finance">Finance & Fintech</option>
            <option value="Social">Social & Chat</option>
            <option value="Tools">Tools & Utilities</option>
          </select>

          <!-- Chart Type Selector -->
          <select
            v-model="filters.chart"
            @change="onFilterChange"
            :disabled="loading"
            class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-70"
          >
            <option value="topgrossing">Top Grossing (Monetizers)</option>
            <option value="topfree">Top Free (UA Spenders)</option>
            <option value="newfree">New Soft Launches</option>
            <option value="trending">Trending Breakouts</option>
          </select>

          <!-- Live Updating Indicator Badge -->
          <div
            v-if="loading"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-pulse"
          >
            <svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Loading...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Area: Apps Grid or Table -->
    <div class="flex-1 p-4 sm:p-6 relative min-h-[420px]">
      <!-- Active Loading State Glass Overlay (when changing filters or pagination with apps already rendered) -->
      <transition name="fade">
        <div
          v-if="loading && displayedApps.length > 0"
          class="absolute inset-0 z-30 bg-white/70 dark:bg-gray-900/70 backdrop-blur-[1.5px] flex flex-col items-center justify-center p-6 rounded-2xl"
        >
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl p-6 flex flex-col items-center gap-3.5 max-w-sm text-center">
            <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <svg class="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <div class="text-sm font-extrabold text-gray-900 dark:text-white">
                Loading Store Apps...
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Fetching {{ filters.chart === 'newfree' ? 'new soft launches & early access games' : filters.chart === 'topfree' ? 'top free apps' : filters.chart === 'trending' ? 'trending breakout apps' : 'top grossing apps' }} for {{ filters.country }}
              </p>
            </div>
          </div>
        </div>
      </transition>

      <!-- Loading Skeletons -->
      <div v-if="loading && displayedApps.length === 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        <div v-for="i in 8" :key="i" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 animate-pulse flex flex-col space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-2xl flex-shrink-0"></div>
            <div class="flex-1 min-w-0 space-y-2">
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
          <div class="space-y-2">
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
          <div class="h-9 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-500/30 rounded-2xl p-6 text-center max-w-lg mx-auto mt-8">
        <svg class="w-10 h-10 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 class="text-sm font-bold text-red-800 dark:text-red-300">{{ error }}</h3>
        <p class="text-xs text-red-600 dark:text-red-400 mt-1">Failed to fetch store apps. Check connection or retry.</p>
        <button
          type="button"
          @click="refreshData"
          class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          Retry Search
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="displayedApps.length === 0" class="text-center py-16 px-4">
        <div class="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3 text-gray-400">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke-width="2" />
            <line x1="8" y1="12" x2="16" y2="12" stroke-width="2" />
          </svg>
        </div>
        <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">
          {{ filters.activeTab === 'leads' ? 'No Saved Target Leads Yet' : 'No Apps Found' }}
        </h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
          {{ filters.activeTab === 'leads' ? 'Save promising apps from the Discover tab to build your team\'s high-priority outreach list.' : 'Try adjusting your search keywords, country, or category filters.' }}
        </p>
        <button
          v-if="filters.activeTab === 'leads'"
          type="button"
          @click="setTab('discover')"
          class="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          Browse Discovered Apps
        </button>
      </div>

      <!-- Mode 1: Cards Grid View -->
      <div v-else-if="filters.viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        <div
          v-for="app in displayedApps"
          :key="app.id"
          class="bg-white dark:bg-gray-800/95 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4.5 shadow-xs hover:shadow-md hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all flex flex-col justify-between group relative overflow-hidden"
        >
          <!-- Top Card Row: Icon, Title, Platform & Save Star -->
          <div>
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="flex items-center gap-3 min-w-0">
                <!-- HD App Icon with Error Fallback -->
                <a
                  :href="app.app_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="w-13 h-13 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-100 hover:scale-105 transition-transform shadow-xs"
                  :title="`Open ${app.app_name} on store`"
                >
                  <img
                    :src="app.app_icon_url"
                    :alt="app.app_name"
                    class="w-full h-full object-cover"
                    @error="onImgError($event, app.platform)"
                  />
                </a>

                <!-- App Title & Developer -->
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span
                      class="font-extrabold text-sm text-gray-900 dark:text-white truncate block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                      :title="app.app_name"
                    >
                      {{ app.app_name }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" :title="app.developer_name || ''">
                    {{ app.developer_name || 'Verified Developer' }}
                  </p>
                </div>
              </div>

              <!-- Quick Save Toggle Star Button -->
              <button
                type="button"
                @click="toggleSaveLead(app)"
                :disabled="savingLeadIds[app.id]"
                class="p-1.5 rounded-lg transition-all cursor-pointer flex-shrink-0"
                :class="isSaved(app.id, app.bundle_id, app.platform) ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-700'"
                :title="isSaved(app.id, app.bundle_id, app.platform) ? 'Remove from saved leads' : 'Save as target lead'"
              >
                <svg class="w-4 h-4" :fill="isSaved(app.id, app.bundle_id, app.platform) ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>

            <!-- Tags & Signals Row: Platform, Category, Installs, Rating -->
            <div class="flex items-center flex-wrap gap-1.5 mb-3 text-[11px]">
              <!-- Platform Badge -->
              <span
                class="px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 border"
                :class="app.platform === 'playstore' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'"
              >
                <span>{{ app.platform === 'playstore' ? 'Google Play' : 'App Store' }}</span>
              </span>

              <!-- Category -->
              <span v-if="app.category" class="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 font-semibold border border-gray-200/60 dark:border-gray-600/60">
                {{ app.category }}
              </span>

              <!-- Installs Tag -->
              <span v-if="app.installs_bracket" class="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/20 flex items-center gap-1">
                <svg class="w-3 h-3 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
                <span>{{ app.installs_bracket }}</span>
              </span>

              <!-- Star Rating -->
              <span v-if="app.rating" class="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 border border-amber-500/20">
                <svg class="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <span>{{ app.rating }}</span>
                <span v-if="app.reviews_count" class="text-[10px] font-normal opacity-70">
                  ({{ formatCompactNumber(app.reviews_count) }})
                </span>
              </span>

              <!-- Monetization Signals -->
              <span v-if="app.has_iap" class="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold text-[10px] border border-purple-500/20" title="Generates in-app purchase revenue">
                $ IAP
              </span>
              <span v-if="app.has_ads" class="px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-700 dark:text-orange-300 font-bold text-[10px] border border-orange-500/20" title="Monetizes with mobile ads">
                Ads
              </span>
            </div>

            <!-- Developer Contact Box -->
            <div class="bg-gray-50/80 dark:bg-gray-900/60 border border-gray-200/70 dark:border-gray-700/60 rounded-xl p-2.5 mb-3 flex items-center justify-between gap-2 text-xs">
              <div class="flex items-center gap-2 min-w-0">
                <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div class="min-w-0">
                  <span v-if="app.developer_email" class="font-mono text-gray-800 dark:text-gray-200 truncate block select-all font-semibold" :title="app.developer_email">
                    {{ app.developer_email }}
                  </span>
                  <span v-else class="text-gray-400 dark:text-gray-500 italic block">
                    No public email listed
                  </span>
                </div>
              </div>

              <!-- 1-Click Copy Email Button -->
              <button
                v-if="app.developer_email"
                type="button"
                @click="copyEmail(app.developer_email)"
                class="px-2 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                :title="`Copy ${app.developer_email}`"
              >
                <svg v-if="copiedEmail === app.developer_email" class="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                <span>{{ copiedEmail === app.developer_email ? 'Copied' : 'Copy' }}</span>
              </button>
            </div>
          </div>

          <!-- Card Bottom Actions & Outreach Status -->
          <div class="pt-2 border-t border-gray-100 dark:border-gray-700/60 flex flex-col gap-2">
            <!-- Outreach Status Badge & Store Links -->
            <div class="flex items-center justify-between text-xs">
              <!-- Status Badge -->
              <div>
                <span
                  v-if="app.status === 'bound'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                  title="App already bound to a verified email"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Bound
                </span>

                <span
                  v-else-if="app.status === 'opened'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25"
                  :title="`Recipient opened pitch email ${app.opened_count || 1} times`"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                  Opened ({{ app.opened_count || 1 }}x)
                </span>

                <span
                  v-else-if="app.status === 'contacted'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25"
                  title="Pitch email already delivered"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Contacted
                </span>

                <span
                  v-else
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  Uncontacted
                </span>
              </div>

              <!-- Quick Links: Store & Website -->
              <div class="flex items-center gap-2 text-[11px] font-semibold">
                <a
                  :href="app.app_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-0.5"
                  title="View on App Store / Play Store"
                >
                  <span>Store</span>
                  <span class="text-[9px]">↗</span>
                </a>
                <span v-if="app.developer_website" class="text-gray-300 dark:text-gray-600">·</span>
                <a
                  v-if="app.developer_website"
                  :href="app.developer_website"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-0.5"
                  title="Visit developer website"
                >
                  <span>Website</span>
                  <span class="text-[9px]">↗</span>
                </a>
              </div>
            </div>

            <!-- 1-Click Action: Pitch Reflect MMP Button -->
            <button
              type="button"
              @click="pitchApp(app)"
              class="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl shadow-xs hover:shadow-md transition-all font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              :title="`Open compose modal and pitch Reflect MMP to ${app.app_name}`"
            >
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Pitch Reflect MMP</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Mode 2: High-Density Table View -->
      <div v-else class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-gray-50 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none">
              <tr>
                <th scope="col" class="py-3 px-4">App & Bundle</th>
                <th scope="col" class="py-3 px-3">Platform</th>
                <th scope="col" class="py-3 px-3">Category</th>
                <th scope="col" class="py-3 px-3">Developer & Verified Contact</th>
                <th scope="col" class="py-3 px-3">Traction & Stats</th>
                <th scope="col" class="py-3 px-3">Monetization</th>
                <th scope="col" class="py-3 px-3">Outreach Status</th>
                <th scope="col" class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-750">
              <tr
                v-for="app in displayedApps"
                :key="app.id"
                class="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/15 transition-colors group"
              >
                <!-- App & Bundle -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <a
                      :href="app.app_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-100 shadow-xs hover:scale-105 transition-transform"
                    >
                      <img
                        :src="app.app_icon_url"
                        :alt="app.app_name"
                        class="w-full h-full object-cover"
                        @error="onImgError($event, app.platform)"
                      />
                    </a>
                    <div class="min-w-0 max-w-[200px] sm:max-w-[240px]">
                      <a
                        :href="app.app_url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="font-bold text-gray-900 dark:text-white truncate block hover:text-emerald-600 transition-colors"
                        :title="app.app_name"
                      >
                        {{ app.app_name }}
                      </a>
                      <span class="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate block">
                        {{ app.bundle_id }}
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Platform -->
                <td class="py-3 px-3 whitespace-nowrap">
                  <span
                    class="px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] border inline-flex items-center gap-1"
                    :class="app.platform === 'playstore' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'"
                  >
                    {{ app.platform === 'playstore' ? 'Play Store' : 'App Store' }}
                  </span>
                </td>

                <!-- Category -->
                <td class="py-3 px-3 whitespace-nowrap">
                  <span class="font-semibold text-gray-700 dark:text-gray-300">
                    {{ app.category || '—' }}
                  </span>
                </td>

                <!-- Developer & Contact -->
                <td class="py-3 px-3">
                  <div class="min-w-0 max-w-[220px]">
                    <span class="font-bold text-gray-900 dark:text-gray-100 truncate block">
                      {{ app.developer_name || '—' }}
                    </span>
                    <div v-if="app.developer_email" class="flex items-center gap-1.5 mt-0.5">
                      <span class="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 truncate block select-all">
                        {{ app.developer_email }}
                      </span>
                      <button
                        type="button"
                        @click="copyEmail(app.developer_email)"
                        class="text-[10px] font-semibold text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                        title="Copy email"
                      >
                        {{ copiedEmail === app.developer_email ? 'Copied' : 'Copy' }}
                      </button>
                    </div>
                    <span v-else class="text-[11px] text-gray-400 italic">No email</span>
                  </div>
                </td>

                <!-- Traction & Stats -->
                <td class="py-3 px-3 whitespace-nowrap">
                  <div class="flex flex-col gap-0.5">
                    <span v-if="app.installs_bracket" class="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                      <svg class="w-3 h-3 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
                      <span>{{ app.installs_bracket }}</span>
                    </span>
                    <span v-if="app.rating" class="text-amber-500 font-semibold text-[11px] flex items-center gap-1">
                      <svg class="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      <span>{{ app.rating }}</span>
                      <span v-if="app.reviews_count" class="text-gray-400 font-normal">
                        ({{ formatCompactNumber(app.reviews_count) }})
                      </span>
                    </span>
                  </div>
                </td>

                <!-- Monetization -->
                <td class="py-3 px-3 whitespace-nowrap">
                  <div class="flex items-center gap-1">
                    <span v-if="app.has_iap" class="px-1.5 py-0.5 rounded font-bold text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                      IAP
                    </span>
                    <span v-if="app.has_ads" class="px-1.5 py-0.5 rounded font-bold text-[10px] bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20">
                      Ads
                    </span>
                    <span v-if="!app.has_iap && !app.has_ads" class="text-gray-400 text-[11px]">—</span>
                  </div>
                </td>

                <!-- Outreach Status -->
                <td class="py-3 px-3 whitespace-nowrap">
                  <span
                    v-if="app.status === 'bound'"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Bound
                  </span>
                  <span
                    v-else-if="app.status === 'opened'"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                    Opened ({{ app.opened_count || 1 }}x)
                  </span>
                  <span
                    v-else-if="app.status === 'contacted'"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Contacted
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                    Uncontacted
                  </span>
                </td>

                <!-- Actions -->
                <td class="py-3 px-4 text-right whitespace-nowrap">
                  <div class="inline-flex items-center gap-1.5">
                    <!-- Store Page Link -->
                    <a
                      :href="app.app_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                      title="View on store"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>

                    <!-- Dev Website Link -->
                    <a
                      v-if="app.developer_website"
                      :href="app.developer_website"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                      title="Visit developer website"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </a>

                    <!-- Save Toggle -->
                    <button
                      type="button"
                      @click="toggleSaveLead(app)"
                      class="p-1.5 rounded-lg transition-all cursor-pointer"
                      :class="isSaved(app.id, app.bundle_id, app.platform) ? 'text-amber-500 bg-amber-500/10' : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-700'"
                      :title="isSaved(app.id, app.bundle_id, app.platform) ? 'Remove lead' : 'Save lead'"
                    >
                      <svg class="w-4 h-4" :fill="isSaved(app.id, app.bundle_id, app.platform) ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>

                    <!-- Pitch Button -->
                    <button
                      type="button"
                      @click="pitchApp(app)"
                      class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                      title="Pitch Reflect MMP"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>Pitch MMP</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Infinite Scroll & Endless Discovery Controls -->
      <div v-if="filters.activeTab === 'discover'" class="mt-8 mb-8 flex flex-col items-center justify-center gap-3">
        <!-- Observer Sentinel -->
        <div ref="infiniteScrollSentinel" class="h-4 w-full"></div>

        <!-- Animated Loading Spinner when fetching next batch -->
        <div
          v-if="loadingMore"
          class="py-3 px-6 rounded-2xl bg-white dark:bg-gray-800 border border-emerald-500/40 shadow-sm flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm animate-pulse"
        >
          <svg class="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Discovering more mobile apps & developer emails... ({{ apps.length }} loaded)</span>
        </div>

        <!-- Manual "Load More" Fallback Button -->
        <div v-else-if="hasMore && !loading && apps.length > 0" class="flex flex-col items-center gap-1.5">
          <button
            type="button"
            @click="discoverStore.loadMoreApps()"
            class="px-5 py-2.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-750 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs hover:shadow transition-all font-bold text-xs flex items-center gap-2 cursor-pointer group"
          >
            <svg class="w-4 h-4 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>Load More Apps ({{ apps.length }} loaded so far)</span>
          </button>
          <span class="text-[11px] text-gray-400">Scroll down to stream more continuously</span>
        </div>

        <!-- End of Stream Indicator -->
        <div
          v-else-if="!hasMore && apps.length > 0"
          class="py-3 px-5 rounded-xl bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs font-semibold flex items-center gap-2 border border-gray-200/60 dark:border-gray-700/60"
        >
          <svg class="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          <span>All {{ apps.length }} apps loaded for this filter. Switch country, platform, or category to uncover more targets.</span>
        </div>
      </div>

      <!-- Saved Targets (Leads) Tab Summary -->
      <div v-else-if="filters.activeTab === 'leads' && leads.length > 0" class="mt-6 mb-6 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs text-xs text-gray-500">
        <div>
          Total Saved Targets: <span class="font-bold text-gray-900 dark:text-white">{{ displayedApps.length }}</span>
        </div>
        <div class="text-[11px] text-gray-400">
          Saved targets are stored and accessible anytime.
        </div>
      </div>
    </div>

    <!-- Floating "Back to Top" Quick-Jump Button -->
    <transition name="fade">
      <button
        v-if="showBackToTop"
        type="button"
        @click="scrollToTop"
        class="fixed bottom-6 right-6 p-3 rounded-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer z-50 flex items-center gap-1.5 font-bold text-xs"
        title="Back to Top"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <span class="hidden sm:inline pr-1">Top</span>
      </button>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useToast } from "@/composables/useToast";
import { useDiscoverStore } from "@/stores/discover";
import type { DiscoveredApp, DiscoverPlatform } from "@/types";

const discoverStore = useDiscoverStore();
const { apps, leads, stats, filters, loading, leadsLoading, loadingMore, hasMore, savingLeadIds, error, displayedApps } =
	storeToRefs(discoverStore);
const { isSaved } = discoverStore;

const { success: showSuccessToast, error: showErrorToast } = useToast();

const searchInput = ref(filters.value.query);
const copiedEmail = ref<string | null>(null);

const scrollContainer = ref<HTMLElement | null>(null);
const infiniteScrollSentinel = ref<HTMLElement | null>(null);
const showBackToTop = ref(false);
let observer: IntersectionObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const scrollToTop = () => {
	scrollContainer.value?.scrollTo({ top: 0, behavior: "smooth" });
};

const handleScroll = () => {
	if (!scrollContainer.value) return;
	const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;
	showBackToTop.value = scrollTop > 350;

	// Fallback infinite scroll trigger if scrolled near bottom
	if (scrollHeight - scrollTop - clientHeight < 400) {
		if (!loading.value && !loadingMore.value && hasMore.value && filters.value.activeTab === "discover") {
			discoverStore.loadMoreApps();
		}
	}
};

const onSearchInput = () => {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		filters.value.query = searchInput.value;
		filters.value.page = 1;
		discoverStore.fetchApps();
	}, 400);
};

const clearSearch = () => {
	searchInput.value = "";
	filters.value.query = "";
	filters.value.page = 1;
	discoverStore.fetchApps();
};

const setPlatform = (p: DiscoverPlatform) => {
	filters.value.platform = p;
	filters.value.page = 1;
	discoverStore.fetchApps();
};

const setTab = (tab: "discover" | "leads") => {
	filters.value.activeTab = tab;
	filters.value.page = 1;
	if (tab === "leads") {
		discoverStore.fetchLeads();
	} else {
		discoverStore.fetchApps();
	}
};

const onFilterChange = () => {
	if (filters.value.activeTab !== "discover") {
		filters.value.activeTab = "discover";
	}
	filters.value.page = 1;
	discoverStore.fetchApps();
};

const refreshData = () => {
	if (filters.value.activeTab === "leads") {
		discoverStore.fetchLeads();
	} else {
		discoverStore.fetchApps();
	}
	showSuccessToast("Refreshed store discovery data");
};

const copyEmail = async (email: string) => {
	try {
		await navigator.clipboard.writeText(email);
		copiedEmail.value = email;
		showSuccessToast(`Copied developer email: ${email}`);
		setTimeout(() => {
			if (copiedEmail.value === email) copiedEmail.value = null;
		}, 2500);
	} catch {
		showErrorToast("Could not copy to clipboard");
	}
};

const toggleSaveLead = async (app: DiscoveredApp) => {
	try {
		const isNowSaved = await discoverStore.toggleSaveLead(app);
		if (isNowSaved) {
			showSuccessToast(`Saved "${app.app_name}" to target leads`);
		} else {
			showSuccessToast(`Removed "${app.app_name}" from saved leads`);
		}
	} catch (err: any) {
		showErrorToast(err?.message || "Failed to update lead");
	}
};

const pitchApp = async (app: DiscoveredApp) => {
	try {
		await discoverStore.pitchMMP(app);
		showSuccessToast(`Ready to pitch Reflect MMP for ${app.app_name}!`);
	} catch (err: any) {
		showErrorToast(err?.message || "Could not prepare pitch");
	}
};

const exportCsv = () => {
	discoverStore.exportCsv();
	showSuccessToast("Downloaded MMP target leads CSV");
};

const formatCompactNumber = (num: number): string => {
	if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
	if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
	return num.toString();
};

const onImgError = (event: Event, platform: string) => {
	const img = event.target as HTMLImageElement;
	if (img.dataset.hasError) return;
	img.dataset.hasError = "true";
	if (platform === "playstore") {
		img.src = "https://www.google.com/s2/favicons?domain=play.google.com&sz=128";
	} else {
		img.src = "https://www.google.com/s2/favicons?domain=apple.com&sz=128";
	}
};

onMounted(() => {
	discoverStore.fetchLeads();
	discoverStore.fetchApps();

	// Attach IntersectionObserver for seamless infinite scrolling
	if (typeof window !== "undefined" && "IntersectionObserver" in window) {
		observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry && entry.isIntersecting) {
					if (!loading.value && !loadingMore.value && hasMore.value && filters.value.activeTab === "discover") {
						discoverStore.loadMoreApps();
					}
				}
			},
			{
				root: null,
				rootMargin: "350px 0px",
				threshold: 0.01,
			},
		);

		if (infiniteScrollSentinel.value) {
			observer.observe(infiniteScrollSentinel.value);
		}
	}
});

watch(infiniteScrollSentinel, (newEl, oldEl) => {
	if (oldEl && observer) observer.unobserve(oldEl);
	if (newEl && observer) observer.observe(newEl);
});

onUnmounted(() => {
	if (observer) {
		observer.disconnect();
		observer = null;
	}
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
