<template>
  <div class="h-full flex flex-col bg-white dark:bg-gray-900 overflow-hidden select-none transition-colors border-l border-gray-200 dark:border-gray-800">
    <!-- State 1: No Email Selected Empty State -->
    <div 
      v-if="!emailId" 
      class="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-gray-900/50"
    >
      <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5 shadow-sm">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      <h3 class="text-base font-bold text-gray-900 dark:text-white mb-1.5">
        Select a conversation to read
      </h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        Use your arrow keys or shortcuts to rapidly triage and process your communications.
      </p>

      <!-- Superhuman Keyboard Shortcut Cheatsheet -->
      <div class="w-full max-w-xs bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 rounded-xl p-3.5 shadow-xs text-left">
        <div class="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">
          Speed Shortcuts
        </div>
        <div class="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
          <div class="flex items-center justify-between">
            <span>Next / Previous</span>
            <div class="flex items-center gap-1 font-mono text-[11px]">
              <kbd class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">j</kbd>
              <kbd class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">k</kbd>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <span>Archive</span>
            <kbd class="px-1.5 py-0.5 font-mono text-[11px] rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">e</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span>Star</span>
            <kbd class="px-1.5 py-0.5 font-mono text-[11px] rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">s</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span>Trash</span>
            <kbd class="px-1.5 py-0.5 font-mono text-[11px] rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">#</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span>Undo</span>
            <kbd class="px-1.5 py-0.5 font-mono text-[11px] rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">z</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span>Reply</span>
            <kbd class="px-1.5 py-0.5 font-mono text-[11px] rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">r</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span>Compose</span>
            <kbd class="px-1.5 py-0.5 font-mono text-[11px] rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">c</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span>Close Pane</span>
            <kbd class="px-1.5 py-0.5 font-mono text-[11px] rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">Esc</kbd>
          </div>
        </div>
      </div>
    </div>

    <!-- State 2: Loading Skeleton -->
    <div v-else-if="loading && !email" class="flex-1 flex flex-col p-6 animate-pulse">
      <div class="h-6 bg-gray-200 dark:bg-gray-800 rounded-lg w-3/4 mb-4"></div>
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800"></div>
        <div class="space-y-1.5 flex-1">
          <div class="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
          <div class="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
        </div>
      </div>
      <div class="space-y-3 flex-1">
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-4/6"></div>
        <div class="h-32 bg-gray-100 dark:bg-gray-800/60 rounded-xl mt-4"></div>
      </div>
    </div>

    <!-- State 3: Active Email Reading View -->
    <div v-else-if="email" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <!-- Toolbar Header -->
      <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3 flex-shrink-0 bg-white dark:bg-gray-900">
        <!-- Left: Navigation Arrows + Close Pane -->
        <div class="flex items-center gap-1">
          <button 
            type="button"
            @click="emit('close')"
            class="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Close reading pane (Esc)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

          <!-- Previous Email -->
          <button 
            type="button"
            :disabled="!canGoPrev"
            @click="emit('prev')"
            class="p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous conversation (k)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>

          <!-- Next Email -->
          <button 
            type="button"
            :disabled="!canGoNext"
            @click="emit('next')"
            class="p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next conversation (j)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <!-- Right: Action Buttons -->
        <div class="flex items-center gap-1">
          <!-- Follow-up or Reply -->
          <button 
            type="button"
            @click="handleReply"
            class="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
            title="Reply (r)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>

          <!-- Star -->
          <button 
            type="button"
            @click="handleToggleStar"
            class="p-1.5 text-gray-500 hover:text-amber-500 dark:text-gray-400 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
            :class="{ 'text-amber-500 dark:text-amber-400': email.starred }"
            :title="email.starred ? 'Unstar (s)' : 'Star (s)'"
          >
            <svg v-if="email.starred" class="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>

          <!-- Mark unread -->
          <button 
            type="button"
            @click="handleMarkUnread"
            class="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Mark unread (u)"
            aria-label="Mark unread"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          <!-- Archive (or Move to Inbox from Archive / Trash / Spam) -->
          <button 
            type="button"
            @click="email && emit('archive', email)"
            class="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            :title="isRestoreFolder ? 'Move to Inbox (e)' : 'Archive (e)'"
            :aria-label="isRestoreFolder ? 'Move to Inbox' : 'Archive'"
          >
            <svg v-if="isRestoreFolder" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>

          <!-- Trash (or Delete forever from Trash) -->
          <button 
            type="button"
            @click="email && emit('trash', email)"
            class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
            :title="fromFolder === 'trash' ? 'Delete forever (#)' : 'Move to Trash (#)'"
            :aria-label="fromFolder === 'trash' ? 'Delete forever' : 'Move to Trash'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <div class="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

          <!-- Expand to Full View -->
          <button 
            type="button"
            @click="emit('expand')"
            class="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
            title="Open in Full Window"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Scrollable Message Canvas with Conversation Thread -->
      <div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <!-- Subject Banner -->
        <div>
          <h2 class="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-snug">
            {{ email.subject || "(No subject)" }}
          </h2>
        </div>

        <!-- Stacked Conversation Thread -->
        <ThreadView 
          :mailbox-id="mailboxId" 
          :root-email="email" 
          :from-folder="fromFolder" 
          @star-changed="handleThreadStar" 
          @thread-updated="handleThreadUpdated" 
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ThreadView from "@/components/ThreadView.vue";
import { useToast } from "@/composables/useToast";
import { extractCleanEmail } from "@/stores/appBindings";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import { useUIStore } from "@/stores/ui";
import type { Email } from "@/types";

const props = defineProps<{
	mailboxId: string;
	emailId: string | null;
	fromFolder?: string;
	canGoPrev?: boolean;
	canGoNext?: boolean;
}>();

const emit = defineEmits<{
	(e: "close"): void;
	(e: "expand"): void;
	(e: "prev"): void;
	(e: "next"): void;
	/** Parent performs the move (optimistic + Undo) and advances to the next message. */
	(e: "archive", email: Email): void;
	(e: "trash", email: Email): void;
}>();

const emailStore = useEmailStore();
const folderStore = useFolderStore();
const uiStore = useUIStore();
const toast = useToast();

const email = ref<Email | null>(null);
const loading = ref(false);

const isRestoreFolder = computed(() => ["archive", "trash", "spam"].includes(props.fromFolder || ""));

// Inbound rows also carry opened_count = 0, so that column can't decide. A message is outgoing if it lives in
// Sent, was opened from Sent, or was sent by this mailbox (covers sent mail later archived / starred / searched).
const isSentEmail = computed(() => {
	if (!email.value) return false;
	if (email.value.folder_id === "sent" || props.fromFolder === "sent") return true;
	const own = (props.mailboxId || "").toLowerCase();
	return !!own && (extractCleanEmail(email.value.sender) || "").toLowerCase() === own;
});

const loadEmail = async (id: string) => {
	if (!id || !props.mailboxId) {
		email.value = null;
		return;
	}

	loading.value = true;
	try {
		await emailStore.fetchEmail(props.mailboxId, id);
		// Rapid j/k: ignore responses for a message the user has already moved past.
		if (props.emailId !== id) return;
		email.value = emailStore.currentEmail;

		// If unread, mark read in background (optimistic: list row updates instantly)
		if (email.value && !email.value.read) {
			email.value = { ...email.value, read: true };
			emailStore
				.patchFlags(props.mailboxId, id, { read: true })
				.then(() => folderStore.fetchFolders(props.mailboxId))
				.catch(() => {});
		}
	} catch (err) {
		console.error("Failed to load email in reading pane", err);
		if (props.emailId === id) email.value = null;
	} finally {
		if (props.emailId === id) loading.value = false;
	}
};

watch(
	() => props.emailId,
	(newId) => {
		if (newId) {
			loadEmail(newId);
		} else {
			email.value = null;
			loading.value = false;
		}
	},
	{ immediate: true },
);

const handleThreadStar = (msgId: string, starred: boolean) => {
	if (email.value && email.value.id === msgId) {
		email.value.starred = starred;
	}
};

const handleThreadUpdated = () => {
	folderStore.fetchFolders(props.mailboxId);
};

const handleToggleStar = async () => {
	if (!email.value) return;
	const id = email.value.id;
	const nextStar = !email.value.starred;
	email.value.starred = nextStar;
	try {
		await emailStore.patchFlags(props.mailboxId, id, { starred: nextStar });
	} catch {
		if (email.value?.id === id) email.value.starred = !nextStar;
		toast.error(nextStar ? "Couldn't star" : "Couldn't unstar");
	}
};

const handleMarkUnread = async () => {
	if (!email.value) return;
	const id = email.value.id;
	try {
		await emailStore.patchFlags(props.mailboxId, id, { read: false });
		folderStore.fetchFolders(props.mailboxId);
		// Close the pane so the message isn't immediately re-marked as read.
		emit("close");
	} catch {
		toast.error("Couldn't mark as unread");
	}
};

const handleReply = () => {
	if (!email.value) return;
	uiStore.openComposeModal({
		mode: isSentEmail.value ? "new" : "reply",
		originalEmail: email.value,
		initialTo: isSentEmail.value ? email.value.recipient : email.value.sender,
		initialSubject: (email.value.subject || "").startsWith("Re:")
			? email.value.subject
			: `Re: ${email.value.subject || ""}`,
	});
};
</script>
