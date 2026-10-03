<template>
  <div
    v-if="isModalOpen"
    class="fixed inset-0 bg-slate-950/65 backdrop-blur-md flex items-center justify-center z-[80] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    @click.self="closeModal"
    @keydown.esc="closeModal"
  >
    <div
      class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 overflow-hidden transform transition-all flex flex-col max-h-[92vh]"
    >
      <!-- Modal Header -->
      <div
        class="flex justify-between items-center bg-gray-50/80 dark:bg-gray-900/90 px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0"
          >
            <!-- Mobile App / Device Icon -->
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{{ isEditing ? 'Edit App Binding' : 'Link App / Website' }}</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              >
                Team Shared
              </span>
            </h2>
            <p v-if="targetEmail" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-sm sm:max-w-md">
              Bind <span class="font-semibold text-gray-800 dark:text-gray-200 font-mono">{{ targetEmail }}</span> to an App or Website identity
            </p>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Bind a contact email to a verified mobile app or website identity
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="closeModal"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg p-1.5 transition-colors cursor-pointer"
          title="Close modal"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 overflow-y-auto flex-grow space-y-5">
        <!-- 1. Target Email Input Section -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <span>Target Contact Email Address</span>
              <span class="text-emerald-500">*</span>
            </label>

            <!-- Real-time Validation Status Badge -->
            <span
              v-if="isValidEmail"
              class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in duration-150"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>Valid contact email</span>
            </span>
            <span
              v-else-if="targetEmail.trim()"
              class="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Enter a full email (name@company.com)</span>
            </span>
            <span
              v-else
              class="text-[11px] font-medium text-gray-400 dark:text-gray-500"
            >
              Required
            </span>
          </div>

          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>

            <input
              v-model="targetEmail"
              @input="onEmailInput"
              type="text"
              placeholder="e.g. contact@gamestudio.com or publisher@studio.io"
              class="block w-full bg-gray-50 dark:bg-gray-900/60 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 transition-all font-mono"
              :class="isValidEmail 
                ? 'border-emerald-500/60 focus:ring-emerald-500/30 focus:border-emerald-500' 
                : targetEmail.trim() 
                  ? 'border-amber-400 dark:border-amber-600/70 focus:ring-amber-500/20' 
                  : 'border-gray-300 dark:border-gray-700 focus:ring-emerald-500/20 focus:border-emerald-500'"
            />

            <div class="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
              <button
                v-if="targetEmail"
                type="button"
                @click="clearEmail"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                title="Clear email"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span v-if="isValidEmail" class="text-emerald-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>
          </div>

          <!-- Suggested Contacts Chips -->
          <div
            v-if="suggestedContacts.length > 0 && !isValidEmail"
            class="flex items-center gap-1.5 flex-wrap pt-1 animate-in fade-in duration-150"
          >
            <span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Recent contacts:</span>
            <button
              v-for="contact in suggestedContacts"
              :key="contact"
              type="button"
              @click="selectSuggestedContact(contact)"
              class="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-emerald-50 dark:bg-gray-800 dark:hover:bg-emerald-950/30 text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-gray-200 dark:border-gray-700 hover:border-emerald-500/30 transition-all cursor-pointer font-mono"
            >
              {{ contact }}
            </button>
          </div>

          <!-- 1-Click Domain Quick Actions -->
          <div
            v-if="targetEmailDomain && !selectedItem"
            class="mt-2 p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-200"
          >
            <div class="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <span class="text-base">🏢</span>
              <span>Organization domain detected: <strong class="font-mono text-emerald-900 dark:text-emerald-200">{{ targetEmailDomain }}</strong></span>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="linkDomainAsWebsite"
                class="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <span>🌐 Link Official Website</span>
              </button>
              <button
                type="button"
                @click="searchDomainApps"
                class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <span>🔍 Search App Stores</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Search & Lookup Section -->
        <div class="space-y-3 pt-1 border-t border-gray-100 dark:border-gray-800">
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Search App or Enter Store / Website URL
          </label>

          <!-- Platform Selector Tabs -->
          <div class="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              v-for="plat in platformTabs"
              :key="plat.id"
              @click="selectPlatformTab(plat.id)"
              class="flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer select-none"
              :class="activePlatformTab === plat.id 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold border border-gray-200/50 dark:border-gray-600/50' 
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'"
            >
              <component :is="plat.icon" class="w-3.5 h-3.5 flex-shrink-0" />
              <span>{{ plat.label }}</span>
            </button>
          </div>

          <!-- Search Input Box with Instant URL Detection -->
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <svg v-if="!isSearching" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <svg v-else class="w-4 h-4 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>

            <input
              ref="searchInputRef"
              v-model="searchQuery"
              @input="onSearchInput"
              @paste="onSearchPaste"
              @keydown.enter.prevent="executeLookup"
              type="text"
              placeholder="e.g. Clash of Clans, Slack, play.google.com/..., apps.apple.com/..., or domain.com"
              class="w-full pl-10 pr-24 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 placeholder-gray-400 text-gray-900 dark:text-gray-100 transition-all"
            />

            <div class="absolute inset-y-0 right-1.5 flex items-center gap-1">
              <button
                v-if="searchQuery"
                type="button"
                @click="clearSearch"
                class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title="Clear input"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                type="button"
                @click="executeLookup"
                :disabled="!searchQuery.trim() || isSearching"
                class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
              >
                {{ isSearching ? 'Searching...' : 'Search' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Search Results List (if search has results) -->
        <div v-if="searchResults.length > 0" class="space-y-2 animate-in fade-in duration-150">
          <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-semibold px-1">
            <span>Results ({{ searchResults.length }})</span>
            <span>Click any card to select</span>
          </div>

          <div class="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-gray-200 dark:border-gray-700/80 rounded-xl p-1.5 bg-gray-50/50 dark:bg-gray-900/40 divide-y divide-gray-100 dark:divide-gray-800">
            <div
              v-for="(item, index) in searchResults"
              :key="index"
              @click="selectResult(item)"
              class="flex items-center justify-between p-2.5 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer group border border-transparent hover:border-emerald-500/30 hover:shadow-xs"
              :class="{'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/40 shadow-xs': selectedItem?.app_url === item.app_url}"
            >
              <div class="flex items-center gap-3 min-w-0 pr-2">
                <img
                  :src="item.app_icon_url"
                  :alt="item.app_name"
                  class="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700 bg-white flex-shrink-0 shadow-xs"
                  @error="onImgError($event, item.platform)"
                />
                <div class="min-w-0">
                  <p class="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {{ item.app_name }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {{ item.developer_name || formatPlatformName(item.platform) }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 flex-shrink-0">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border"
                  :class="getPlatformBadgeClass(item.platform)"
                >
                  {{ formatPlatformName(item.platform) }}
                </span>
                <button
                  type="button"
                  class="px-3 py-1 text-xs font-semibold rounded-lg transition-all shadow-xs"
                  :class="selectedItem?.app_url === item.app_url 
                    ? 'bg-emerald-600 text-white font-bold' 
                    : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-emerald-600 group-hover:text-white text-gray-700 dark:text-gray-300'"
                >
                  {{ selectedItem?.app_url === item.app_url ? 'Selected ✓' : 'Select' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Selected App Card (Executive Preview & Optional Overrides) -->
        <div v-if="selectedItem" class="bg-emerald-50/40 dark:bg-emerald-950/15 rounded-2xl p-4 sm:p-5 border border-emerald-500/30 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div class="flex items-center justify-between border-b border-emerald-500/15 pb-3">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shadow-xs">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span class="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Selected App Identity
              </span>
            </div>

            <div class="flex items-center gap-3">
              <a
                :href="selectedItem.app_url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 inline-flex items-center gap-1 font-semibold hover:underline"
                title="Test destination URL in a new tab"
              >
                <span>Visit Store / Site</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              <button
                type="button"
                @click="clearSelectedItem"
                class="text-xs font-semibold px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Choose a different app"
              >
                Change App
              </button>
            </div>
          </div>

          <!-- App Profile Summary Card -->
          <div class="flex items-start gap-4">
            <div class="relative flex-shrink-0">
              <img
                :src="selectedItem.app_icon_url"
                :alt="selectedItem.app_name"
                class="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/40 bg-white shadow-md"
                @error="onImgError($event, selectedItem.platform)"
              />
              <span
                class="absolute -bottom-1 -right-1 p-1 rounded-full text-white shadow-xs"
                :class="selectedItem.platform === 'playstore' ? 'bg-emerald-600' : selectedItem.platform === 'appstore' ? 'bg-blue-600' : 'bg-teal-600'"
                :title="formatPlatformName(selectedItem.platform)"
              >
                <component :is="getPlatformIcon(selectedItem.platform)" class="w-3 h-3" />
              </span>
            </div>

            <div class="flex-grow min-w-0">
              <div class="flex items-baseline justify-between gap-2">
                <h3 class="text-base font-extrabold text-gray-900 dark:text-white truncate">
                  {{ selectedItem.app_name }}
                </h3>
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex-shrink-0"
                  :class="getPlatformBadgeClass(selectedItem.platform)"
                >
                  {{ formatPlatformName(selectedItem.platform) }}
                </span>
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                {{ selectedItem.developer_name || 'Verified Identity' }}
              </p>
              <p class="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-1 truncate max-w-md">
                {{ selectedItem.app_url }}
              </p>
            </div>
          </div>

          <!-- Collapsible Fine-Tuning Details -->
          <div class="pt-2 border-t border-emerald-500/15">
            <button
              type="button"
              @click="showAdvanced = !showAdvanced"
              class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>{{ showAdvanced ? 'Hide customization options' : 'Customize app name, developer, or icon URL' }}</span>
              <svg class="w-3.5 h-3.5 transform transition-transform" :class="{'rotate-180': showAdvanced}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div v-if="showAdvanced" class="mt-3 space-y-3 text-xs animate-in fade-in duration-150">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-gray-600 dark:text-gray-300 font-semibold mb-1">Display App Name</label>
                  <input
                    v-model="selectedItem.app_name"
                    type="text"
                    required
                    placeholder="App Name"
                    class="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label class="block text-gray-600 dark:text-gray-300 font-semibold mb-1">Platform</label>
                  <select
                    v-model="selectedItem.platform"
                    class="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 font-semibold focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="playstore">Google Play Store</option>
                    <option value="appstore">Apple App Store</option>
                    <option value="website">Official Website</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-gray-600 dark:text-gray-300 font-semibold mb-1">Developer / Organization Name</label>
                <input
                  v-model="selectedItem.developer_name"
                  type="text"
                  placeholder="Optional Studio / Developer"
                  class="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div class="space-y-2">
                <div>
                  <label class="block text-gray-600 dark:text-gray-300 font-semibold mb-0.5">App / Store Destination URL</label>
                  <input
                    v-model="selectedItem.app_url"
                    type="url"
                    required
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label class="block text-gray-600 dark:text-gray-300 font-semibold mb-0.5">App Icon URL</label>
                  <input
                    v-model="selectedItem.app_icon_url"
                    type="url"
                    required
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Empty State Overhaul: Quick Presets & Recently Linked Team Apps -->
        <div v-else-if="!isSearching && searchResults.length === 0" class="space-y-4">
          <!-- When a query was typed but yielded no results -->
          <div v-if="searchQuery.trim()" class="text-center py-6 px-4 bg-gray-50/80 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 space-y-3">
            <div>
              <p class="text-sm font-bold text-gray-900 dark:text-white">No apps found for "{{ searchQuery.trim() }}"</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                You can link this directly as an official website or custom app:
              </p>
            </div>

            <div class="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                @click="createFallbackWebsite"
                class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🌐 Link as Website</span>
              </button>
              <button
                type="button"
                @click="createFallbackCustomApp"
                class="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold border border-gray-200 dark:border-gray-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>📱 Link as Custom App</span>
              </button>
            </div>
          </div>

          <!-- When query is empty: Show Presets & Team Library -->
          <div v-else class="space-y-4">
            <!-- Recently Linked by Team (if available) -->
            <div v-if="recentTeamApps.length > 0" class="space-y-2">
              <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 px-1">
                <span>Recently Linked by Your Team</span>
                <span class="text-[11px] font-normal text-gray-400">1-click select</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="(teamApp, i) in recentTeamApps"
                  :key="i"
                  type="button"
                  @click="selectResult(teamApp)"
                  class="flex items-center gap-2.5 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25 border border-gray-200 dark:border-gray-700 hover:border-emerald-500/30 transition-all text-left group cursor-pointer"
                >
                  <img
                    :src="teamApp.app_icon_url"
                    :alt="teamApp.app_name"
                    class="w-8 h-8 rounded-lg object-cover border border-gray-200 dark:border-gray-700 bg-white flex-shrink-0"
                    @error="onImgError($event, teamApp.platform)"
                  />
                  <div class="min-w-0 flex-grow">
                    <p class="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {{ teamApp.app_name }}
                    </p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {{ formatPlatformName(teamApp.platform) }}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <!-- Helpful Guidance Note -->
            <div class="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2.5">
              <span class="text-base flex-shrink-0">💡</span>
              <p class="leading-relaxed">
                <strong>Fast lookup:</strong> Enter an app title, Android package ID (e.g. <code class="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">com.example.app</code>), or paste any direct Google Play (<code class="font-mono text-[11px]">play.google.com/...</code>) or Apple App Store (<code class="font-mono text-[11px]">apps.apple.com/...</code>) link.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div
        class="flex items-center justify-between bg-gray-50/80 dark:bg-gray-900/90 px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0"
      >
        <!-- Left: Unlink Action OR Step Status -->
        <div>
          <button
            v-if="isEditing"
            type="button"
            @click="handleUnlink"
            :disabled="isSaving"
            class="px-3.5 py-2 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all border border-red-200 dark:border-red-900/40 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Unlink App</span>
          </button>
          <div v-else class="flex items-center gap-2 text-xs">
            <span
              class="flex items-center gap-1 font-semibold transition-colors"
              :class="isValidEmail ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'"
            >
              <span
                class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors"
                :class="isValidEmail ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-gray-300 dark:border-gray-600 text-gray-400'"
              >
                1
              </span>
              <span>Email {{ isValidEmail ? '✓' : '' }}</span>
            </span>
            <span class="text-gray-300 dark:text-gray-600">→</span>
            <span
              class="flex items-center gap-1 font-semibold transition-colors"
              :class="selectedItem ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'"
            >
              <span
                class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors"
                :class="selectedItem ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-gray-300 dark:border-gray-600 text-gray-400'"
              >
                2
              </span>
              <span>App {{ selectedItem ? '✓' : '' }}</span>
            </span>
          </div>
        </div>

        <!-- Right: Cancel and Save Action -->
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            @click="closeModal"
            class="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            @click="handleSave"
            :disabled="!canSave || isSaving"
            class="px-5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2"
            :class="canSave && !isSaving 
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-500/20 active:scale-[0.98] cursor-pointer' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed shadow-none'"
          >
            <svg v-if="isSaving" class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else-if="canSave" class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ saveButtonText }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Unlink Confirmation Modal (Eliminating native confirm) -->
    <ConfirmModal
      :is-open="isUnlinkConfirmOpen"
      title="Unlink App Identity"
      :message="`Are you sure you want to unlink the app identity from ${extractCleanEmail(targetEmail || modalEmail)}?`"
      confirm-text="Unlink App"
      :danger="true"
      :loading="isSaving"
      @close="isUnlinkConfirmOpen = false"
      @confirm="executeUnlink"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h, nextTick, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import api from "@/services/api";
import ConfirmModal from "@/components/ConfirmModal.vue";
import { useToast } from "@/composables/useToast";
import { extractCleanEmail, useAppBindingsStore } from "@/stores/appBindings";
import { useEmailStore } from "@/stores/emails";
import { useMailboxStore } from "@/stores/mailboxes";
import type { AppPlatform } from "@/types";

const appBindingsStore = useAppBindingsStore();
const emailStore = useEmailStore();
const mailboxStore = useMailboxStore();
const { isModalOpen, modalEmail, modalBinding, bindings } = storeToRefs(appBindingsStore);
const { success, error: toastError } = useToast();

const isUnlinkConfirmOpen = ref(false);
const targetEmail = ref("");
const searchInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref("");
const isSearching = ref(false);
const isSaving = ref(false);
const showAdvanced = ref(false);
const activePlatformTab = ref<"all" | "playstore" | "appstore" | "website">("all");

export interface LookupItem {
	app_name: string;
	app_icon_url: string;
	app_url: string;
	platform: AppPlatform;
	developer_name?: string | null;
}

const searchResults = ref<LookupItem[]>([]);
const selectedItem = ref<LookupItem | null>(null);

let debounceTimeout: any = null;

// Platform tab icons
const AllIcon = () =>
	h("svg", { class: "w-3.5 h-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, [
		h("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M4 6h16M4 10h16M4 14h16M4 18h16" }),
	]);

const PlayIcon = () =>
	h("svg", { class: "w-3.5 h-3.5 text-emerald-500", viewBox: "0 0 24 24", fill: "currentColor" }, [
		h("path", { d: "M3.609 1.814L13.792 12 3.61 22.186a2.03 2.03 0 01-.61-1.467V3.28c0-.573.225-1.096.609-1.466zM15.206 13.414l2.457-2.457a1.99 1.99 0 000-2.814l-2.457-2.457-3.007 3.007 3.007 2.921zM4.75 23.327l9.043-9.043 2.127 2.127-9.704 5.539a1.97 1.97 0 01-1.466.377zM4.75.673a1.97 1.97 0 011.466.377l9.704 5.539-2.127 2.127L4.75.673z" }),
	]);

const AppleIcon = () =>
	h("svg", { class: "w-3.5 h-3.5 text-blue-500", viewBox: "0 0 24 24", fill: "currentColor" }, [
		h("path", { d: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.79 1.06-1.88.94-2.97-.93.04-2.03.62-2.68 1.41-.57.66-.99 1.77-.85 2.84 1.03.08 2.05-.53 2.59-1.28z" }),
	]);

const WebIcon = () =>
	h("svg", { class: "w-3.5 h-3.5 text-teal-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, [
		h("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" }),
	]);

const platformTabs = [
	{ id: "all" as const, label: "All Platforms", icon: AllIcon },
	{ id: "playstore" as const, label: "Google Play", icon: PlayIcon },
	{ id: "appstore" as const, label: "App Store", icon: AppleIcon },
	{ id: "website" as const, label: "Website", icon: WebIcon },
];


// Clean email validation
const isValidEmail = computed(() => {
	const clean = extractCleanEmail(targetEmail.value);
	if (!clean) return false;
	return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean);
});

// Domain extractor (excluding public webmail)
const targetEmailDomain = computed(() => {
	const clean = extractCleanEmail(targetEmail.value);
	if (!clean) return null;
	const parts = clean.split("@");
	if (parts.length === 2 && parts[1].includes(".")) {
		const domain = parts[1].toLowerCase().trim();
		const publicProviders = [
			"gmail.com",
			"yahoo.com",
			"hotmail.com",
			"outlook.com",
			"icloud.com",
			"proton.me",
			"protonmail.com",
			"aol.com",
			"zoho.com",
			"mail.com",
		];
		if (!publicProviders.includes(domain)) {
			return domain;
		}
	}
	return null;
});

// Suggested contacts from recent emails in active folder/mailbox
const suggestedContacts = computed(() => {
	const set = new Set<string>();
	const currentMb = mailboxStore.currentMailbox?.email?.toLowerCase();

	for (const e of emailStore.emails.slice(0, 15)) {
		if (e.recipient) {
			const cleanTo = extractCleanEmail(e.recipient);
			if (cleanTo && cleanTo !== currentMb) set.add(cleanTo);
		}
		if (e.sender) {
			const cleanFrom = extractCleanEmail(e.sender);
			if (cleanFrom && cleanFrom !== currentMb) set.add(cleanFrom);
		}
		if (set.size >= 5) break;
	}
	return Array.from(set);
});

// Recently linked apps across team
const recentTeamApps = computed(() => {
	const seen = new Set<string>();
	const list: LookupItem[] = [];
	for (const b of bindings.value) {
		const key = `${b.platform}:${b.app_name}:${b.app_url}`;
		if (!seen.has(key) && b.app_name) {
			seen.add(key);
			list.push({
				app_name: b.app_name,
				app_icon_url: b.app_icon_url,
				app_url: b.app_url,
				platform: b.platform,
				developer_name: b.developer_name,
			});
			if (list.length >= 6) break;
		}
	}
	return list;
});

const isEditing = computed(() => {
	const clean = extractCleanEmail(targetEmail.value || modalEmail.value);
	return !!appBindingsStore.getBinding(clean) || !!modalBinding.value;
});

const canSave = computed(() => {
	return (
		isValidEmail.value &&
		!!selectedItem.value &&
		!!selectedItem.value.app_name?.trim() &&
		!!selectedItem.value.app_icon_url?.trim() &&
		!!selectedItem.value.app_url?.trim()
	);
});

const saveButtonText = computed(() => {
	if (isSaving.value) return "Saving App Binding...";
	if (!targetEmail.value.trim()) return "Enter Contact Email";
	if (!isValidEmail.value) return "Enter Valid Email";
	if (!selectedItem.value) return "Select an App to Link";
	return isEditing.value ? "Update App Binding" : "Save App Binding";
});

// Watch when modal opens or closes
watch(
	() => isModalOpen.value,
	(open) => {
		if (open) {
			targetEmail.value = modalEmail.value || "";
			searchResults.value = [];
			showAdvanced.value = false;
			activePlatformTab.value = "all";

			const existing = modalBinding.value || appBindingsStore.getBinding(targetEmail.value);
			if (existing) {
				selectedItem.value = {
					app_name: existing.app_name,
					app_icon_url: existing.app_icon_url,
					app_url: existing.app_url,
					platform: existing.platform,
					developer_name: existing.developer_name,
				};
				searchQuery.value = existing.app_name;
			} else {
				selectedItem.value = null;
				// Auto-populate search with domain if available
				const domain = targetEmailDomain.value;
				if (domain) {
					searchQuery.value = domain;
				} else {
					searchQuery.value = "";
				}
			}

			nextTick(() => {
				if (!targetEmail.value) {
					// focus email input if empty
				} else {
					searchInputRef.value?.focus();
				}
				if (searchQuery.value && !modalBinding.value && !selectedItem.value) {
					executeLookup();
				}
			});
		} else {
			searchQuery.value = "";
			searchResults.value = [];
			selectedItem.value = null;
		}
	},
);

const onEmailInput = () => {
	// If domain becomes available and no app is selected, suggest domain search
	if (targetEmailDomain.value && !selectedItem.value && !searchQuery.value) {
		searchQuery.value = targetEmailDomain.value;
	}
};

const clearEmail = () => {
	targetEmail.value = "";
};

const selectSuggestedContact = (email: string) => {
	targetEmail.value = email;
	if (targetEmailDomain.value && !selectedItem.value) {
		searchQuery.value = targetEmailDomain.value;
		executeLookup();
	}
};

const linkDomainAsWebsite = () => {
	const domain = targetEmailDomain.value;
	if (!domain) return;

	const parts = domain.split(".");
	const cleanName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);

	selectedItem.value = {
		app_name: cleanName,
		app_icon_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
		app_url: `https://${domain}`,
		platform: "website",
		developer_name: domain,
	};
};

const searchDomainApps = () => {
	const domain = targetEmailDomain.value;
	if (!domain) return;
	searchQuery.value = domain;
	activePlatformTab.value = "all";
	executeLookup();
};

const selectPlatformTab = (tab: "all" | "playstore" | "appstore" | "website") => {
	activePlatformTab.value = tab;
	if (searchQuery.value.trim()) {
		executeLookup();
	}
};

// URL Detection on Input or Paste
const detectStoreUrl = (query: string): boolean => {
	const trimmed = query.trim();
	if (!trimmed) return false;

	// 1. Play Store URL
	if (/play\.google\.com\/store\/apps\/details/i.test(trimmed)) {
		activePlatformTab.value = "playstore";
		return true;
	}

	// 2. App Store URL
	if (/(?:apps|itunes)\.apple\.com\//i.test(trimmed)) {
		activePlatformTab.value = "appstore";
		return true;
	}

	// 3. Web URL
	if (/^https?:\/\//i.test(trimmed)) {
		activePlatformTab.value = "website";
		return true;
	}

	return false;
};

const onSearchInput = () => {
	if (debounceTimeout) clearTimeout(debounceTimeout);
	const q = searchQuery.value.trim();
	if (!q) {
		searchResults.value = [];
		return;
	}

	detectStoreUrl(q);

	if (q.length >= 2) {
		debounceTimeout = setTimeout(() => {
			executeLookup();
		}, 350);
	}
};

const onSearchPaste = () => {
	nextTick(() => {
		const q = searchQuery.value.trim();
		detectStoreUrl(q);
		executeLookup();
	});
};

const clearSearch = () => {
	searchQuery.value = "";
	searchResults.value = [];
	searchInputRef.value?.focus();
};

const executeLookup = async () => {
	const query = searchQuery.value.trim();
	if (!query) return;

	detectStoreUrl(query);

	isSearching.value = true;
	try {
		const res = await api.lookupApp(query, activePlatformTab.value);
		const list: LookupItem[] = res.data?.results || [];
		searchResults.value = list;

		// If single exact match from URL/ID lookup, auto-select it immediately
		if (list.length === 1 && !selectedItem.value) {
			selectResult(list[0]);
		}
	} catch (e: any) {
		console.error("App lookup failed", e);
		toastError("Failed to lookup app metadata");
	} finally {
		isSearching.value = false;
	}
};

const selectResult = (item: LookupItem) => {
	selectedItem.value = { ...item };
};

const clearSelectedItem = () => {
	selectedItem.value = null;
	nextTick(() => {
		searchInputRef.value?.focus();
	});
};


const createFallbackWebsite = () => {
	let domain = searchQuery.value.trim();
	if (!domain) domain = targetEmailDomain.value || "company.com";
	domain = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
	const name = domain.split(".")[0];
	const capitalized = name.charAt(0).toUpperCase() + name.slice(1);

	selectedItem.value = {
		app_name: capitalized,
		app_icon_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
		app_url: `https://${domain}`,
		platform: "website",
		developer_name: domain,
	};
};

const createFallbackCustomApp = () => {
	const name = searchQuery.value.trim() || "Custom App";
	selectedItem.value = {
		app_name: name,
		app_icon_url: "https://www.google.com/s2/favicons?domain=reflect.cloud&sz=128",
		app_url: "https://reflect.cloud",
		platform: activePlatformTab.value === "appstore" ? "appstore" : "playstore",
		developer_name: "Mobile Publisher",
	};
	showAdvanced.value = true;
};

const getPlatformBadgeClass = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore":
			return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
		case "appstore":
			return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
		case "website":
			return "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20";
		default:
			return "bg-gray-100 text-gray-700 dark:text-gray-300 border-gray-200";
	}
};

const formatPlatformName = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore":
			return "Google Play";
		case "appstore":
			return "App Store";
		case "website":
			return "Website";
	}
};

const getPlatformIcon = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore":
			return PlayIcon;
		case "appstore":
			return AppleIcon;
		case "website":
			return WebIcon;
	}
};

const onImgError = (event: Event, platform: AppPlatform) => {
	const img = event.target as HTMLImageElement;
	if (img.dataset.hasError) return;
	img.dataset.hasError = "true";
	if (platform === "playstore") {
		img.src = "https://www.google.com/s2/favicons?domain=play.google.com&sz=128";
	} else if (platform === "appstore") {
		img.src = "https://www.google.com/s2/favicons?domain=apple.com&sz=128";
	} else {
		try {
			const u = new URL(selectedItem.value?.app_url || "");
			img.src = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
		} catch {
			img.src = "https://www.google.com/s2/favicons?domain=reflect.cloud&sz=128";
		}
	}
};

const closeModal = () => {
	appBindingsStore.closeLinkModal();
};

const handleSave = async () => {
	if (!canSave.value || isSaving.value) {
		if (!targetEmail.value.trim()) {
			toastError("Please enter a target contact email address");
		} else if (!isValidEmail.value) {
			toastError("Please enter a valid email address (e.g. name@company.com)");
		} else if (!selectedItem.value) {
			toastError("Please select or search an app to link");
		}
		return;
	}

	const clean = extractCleanEmail(targetEmail.value || modalEmail.value);
	if (!clean || !selectedItem.value) return;

	let appUrl = selectedItem.value.app_url.trim();
	if (!/^https?:\/\//i.test(appUrl)) {
		appUrl = "https://" + appUrl;
	}

	let appIconUrl = selectedItem.value.app_icon_url.trim();
	if (!/^https?:\/\//i.test(appIconUrl)) {
		appIconUrl = "https://" + appIconUrl;
	}

	isSaving.value = true;
	try {
		await appBindingsStore.saveBinding({
			email: clean,
			app_name: selectedItem.value.app_name.trim(),
			app_icon_url: appIconUrl,
			app_url: appUrl,
			platform: selectedItem.value.platform,
			developer_name: selectedItem.value.developer_name?.trim() || null,
		});

		success(`Bound ${clean} to ${selectedItem.value.app_name}`);
		closeModal();
	} catch (e: any) {
		console.error("Failed to save app binding", e);
		toastError(e.response?.data?.error || "Failed to save binding");
	} finally {
		isSaving.value = false;
	}
};

const handleUnlink = () => {
	const clean = extractCleanEmail(targetEmail.value || modalEmail.value);
	if (!clean) return;
	isUnlinkConfirmOpen.value = true;
};

const executeUnlink = async () => {
	const clean = extractCleanEmail(targetEmail.value || modalEmail.value);
	if (!clean) return;

	isSaving.value = true;
	try {
		await appBindingsStore.deleteBinding(clean);
		success(`Unlinked app identity from ${clean}`);
		isUnlinkConfirmOpen.value = false;
		closeModal();
	} catch (e: any) {
		console.error("Failed to delete binding", e);
		toastError("Failed to unlink app");
	} finally {
		isSaving.value = false;
	}
};
</script>
