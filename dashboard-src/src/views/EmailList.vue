<template>
  <div class="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col">
    <!-- Header with Folder Name, Metrics, Filter Pills, and Refresh -->
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white capitalize tracking-tight flex items-center gap-2">
          {{ folderName }}
        </h1>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {{ filteredEmails.length }} {{ filteredEmails.length === 1 ? 'message' : 'messages' }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <!-- Quick Filter Pills -->
        <div class="flex items-center bg-gray-200 dark:bg-gray-700/60 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            @click="filterMode = 'all'"
            :class="filterMode === 'all' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer"
          >
            All
          </button>
          <button
            type="button"
            @click="filterMode = 'unread'"
            :class="filterMode === 'unread' ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Unread
          </button>
          <button
            type="button"
            @click="filterMode = 'starred'"
            :class="filterMode === 'starred' ? 'bg-white dark:bg-gray-800 text-yellow-500 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1"
          >
            ★ Starred
          </button>
          <button
            v-if="folderId === 'sent'"
            type="button"
            @click="filterMode = 'viewed'"
            :class="filterMode === 'viewed' ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1"
          >
            👁 Viewed
          </button>
        </div>

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

    <!-- Email List Table / Rows -->
    <ul v-if="filteredEmails.length > 0" class="divide-y divide-gray-100 dark:divide-gray-800/80">
      <li 
        v-for="email in filteredEmails" 
        :key="email.id" 
        class="group relative transition-all duration-150 border-l-4"
        :class="[
          !email.read 
            ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500 font-semibold' 
            : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/40',
          'hover:bg-gray-50 dark:hover:bg-gray-800/90'
        ]"
      >
        <router-link 
          :to="{ name: 'EmailDetail', params: { id: email.id }, query: { fromFolder: folderId } }" 
          class="block px-4 sm:px-6 py-3.5"
        >
          <div class="flex items-center gap-3 sm:gap-4">
            <!-- Left: Selection / Star / Unread Dot / Avatar -->
            <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <!-- Unread status dot -->
              <div 
                v-if="!email.read" 
                class="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 flex-shrink-0"
                title="Unread"
              ></div>
              <div v-else class="w-2.5 h-2.5 flex-shrink-0"></div>

              <!-- Quick Star Button -->
              <button 
                type="button"
                @click.stop.prevent="toggleStarStatus(email)" 
                class="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
                :class="{'text-yellow-500': email.starred}"
                :title="email.starred ? 'Unstar' : 'Star'"
              >
                <svg v-if="email.starred" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>

              <!-- Initials Avatar -->
              <div 
                class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 border"
                :class="folderId === 'sent' 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'"
              >
                {{ getAvatarInitial(email, folderId) }}
              </div>
            </div>

            <!-- Middle: Recipient/Sender Name, Subject & Preview Snippet, Tracking Badges -->
            <div class="flex-grow min-w-0 pr-2">
              <!-- Top Row: Recipient/Sender + Engagement & Deliverability Badges -->
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <!-- If Sent or Drafts: Show crisp "To:" pill + Bold Recipient Address -->
                <div v-if="folderId === 'sent' || folderId === 'drafts'" class="flex items-center gap-1.5 truncate max-w-[420px]">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {{ folderId === 'drafts' ? 'Draft to' : 'To' }}
                  </span>
                  <span 
                    class="text-sm truncate font-bold"
                    style="color: var(--fg) !important;"
                  >
                    {{ email.recipient || '(No recipient)' }}
                  </span>
                </div>
                <!-- If Inbox or other folders: Show bold Sender -->
                <div v-else class="flex items-center gap-1.5 truncate max-w-[420px]">
                  <span 
                    class="text-sm truncate"
                    :class="!email.read ? 'font-extrabold' : 'font-bold'"
                    style="color: var(--fg) !important;"
                  >
                    {{ email.sender }}
                  </span>
                </div>

                <!-- CC summary if present -->
                <span 
                  v-if="email.cc" 
                  class="text-xs truncate max-w-[200px]"
                  style="color: var(--fg-dim) !important;"
                  :title="'Cc: ' + email.cc"
                >
                  (Cc: {{ email.cc }})
                </span>

                <!-- 📬 Delivery Destination & Spam Placement Badges -->
                <template v-if="folderId === 'sent'">
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

                  <!-- Opened in Inbox -->
                  <span 
                    v-else-if="email.opened_count && email.opened_count > 0"
                    class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    :title="email.opened_at ? 'Delivered to recipient Inbox and opened: ' + formatTooltipDate(email.opened_at) : 'Recipient opened this email in their Inbox'"
                  >
                    <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Opened · Inbox ({{ email.opened_count }}x)
                  </span>

                  <!-- Delivered to Primary Inbox (Unopened yet) -->
                  <span 
                    v-else
                    class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                    title="Delivered to recipient primary Inbox (SPF/DKIM/DMARC verified)"
                  >
                    <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    Delivered · Inbox
                  </span>

                  <!-- 🔗 Click Tracking Badge -->
                  <span 
                    v-if="email.clicked_count && email.clicked_count > 0"
                    class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                    :title="email.clicked_at ? 'Links clicked ' + email.clicked_count + 'x (last: ' + formatTooltipDate(email.clicked_at) + ')' : 'Links clicked'"
                  >
                    <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Clicked ({{ email.clicked_count }}x)
                  </span>
                </template>

                <!-- Unread Badge Pill -->
                <span 
                  v-if="!email.read" 
                  class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
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
                  v-if="getSnippet(email.body)" 
                  class="font-normal ml-1.5"
                  style="color: var(--fg-dim) !important;"
                >
                  — {{ getSnippet(email.body) }}
                </span>
              </p>
            </div>

            <!-- Right: Date & Attachment Indicator & Hover Actions -->
            <div class="flex-shrink-0 flex items-center gap-3">
              <!-- Attachment paperclip icon if email has attachments -->
              <div v-if="email.attachments && email.attachments.length > 0" class="text-gray-400 dark:text-gray-500" title="Has attachments">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </div>

              <!-- Friendly Date (visible when not hovered) -->
              <p 
                class="text-xs text-gray-500 dark:text-gray-400 group-hover:hidden whitespace-nowrap font-medium"
                :title="formatTooltipDate(email.date)"
              >
                {{ formatFriendlyDate(email.date) }}
              </p>

              <!-- Quick Action Buttons (shown on hover) -->
              <div class="hidden group-hover:flex items-center gap-1">
                <button 
                  type="button"
                  @click.stop.prevent="toggleReadStatus(email)" 
                  class="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-all"
                  :title="email.read ? 'Mark as unread' : 'Mark as read'"
                >
                  <svg v-if="email.read" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <svg v-else class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </button>
                <button 
                  type="button"
                  @click.stop.prevent="handleDelete(email.id)" 
                  class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-gray-700/60 transition-all"
                  title="Delete message"
                >
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </router-link>
      </li>
    </ul>

    <!-- Empty State -->
    <div v-else class="p-16 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-1">
        {{ filterMode === 'all' ? 'No emails in this folder' : `No ${filterMode} emails found` }}
      </h2>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ filterMode === 'all' ? 'Any new messages will appear here.' : 'Try changing your filter above.' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import type { Email } from "@/types";

const emailStore = useEmailStore();
const { emails, isRefreshing } = storeToRefs(emailStore);
const folderStore = useFolderStore();
const { folders } = storeToRefs(folderStore);
const route = useRoute();

const filterMode = ref<"all" | "unread" | "starred" | "viewed">("all");
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const folderId = computed(() => route.params.folder as string);

const folderName = computed(() => {
	const foundFolder = folders.value.find((f) => f.id === folderId.value);
	return foundFolder ? foundFolder.name : folderId.value;
});

// Filter emails by current filter mode
const filteredEmails = computed(() => {
	if (!emails.value) return [];
	if (filterMode.value === "unread") {
		return emails.value.filter((e) => !e.read);
	}
	if (filterMode.value === "starred") {
		return emails.value.filter((e) => e.starred);
	}
	if (filterMode.value === "viewed") {
		return emails.value.filter((e) => e.opened_count && e.opened_count > 0);
	}
	return emails.value;
});

// Display sender or recipient depending on folder
const getDisplayAddress = (email: Email, folder: string): string => {
	if (folder === "sent") {
		return email.recipient ? `To: ${email.recipient}` : "To: (No recipient)";
	}
	if (folder === "drafts") {
		return email.recipient ? `Draft to: ${email.recipient}` : "Draft (No recipient)";
	}
	return email.sender || "Unknown Sender";
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

// Tooltip full date
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

const startAutoRefresh = () => {
	if (refreshInterval) clearInterval(refreshInterval);
	refreshInterval = setInterval(() => {
		emailStore.fetchEmails(route.params.mailboxId as string, {
			folder: folderId.value,
		});
	}, 30000);
};

const stopAutoRefresh = () => {
	if (refreshInterval) {
		clearInterval(refreshInterval);
		refreshInterval = null;
	}
};

const handleRefresh = () => {
	emailStore.fetchEmails(route.params.mailboxId as string, {
		folder: folderId.value,
	});
};

onMounted(() => {
	emailStore.fetchEmails(route.params.mailboxId as string, {
		folder: folderId.value,
	});
	startAutoRefresh();
});

onUnmounted(() => {
	stopAutoRefresh();
});

watch(folderId, (newFolderId) => {
	filterMode.value = "all";
	emailStore.fetchEmails(route.params.mailboxId as string, {
		folder: newFolderId,
	});
});

const toggleReadStatus = (email: Email) => {
	emailStore.updateEmail(route.params.mailboxId as string, email.id, {
		read: !email.read,
	});
};

const toggleStarStatus = (email: Email) => {
	emailStore.updateEmail(route.params.mailboxId as string, email.id, {
		starred: !email.starred,
	});
};

const handleDelete = (emailId: string) => {
	if (confirm("Are you sure you want to delete this email?")) {
		emailStore.deleteEmail(route.params.mailboxId as string, emailId);
	}
};
</script>
