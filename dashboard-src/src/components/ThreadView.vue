<template>
  <div class="thread-view flex flex-col space-y-4">
    <!-- Thread Header Banner (only when > 1 message or multi-participant) -->
    <div 
      v-if="messages.length > 1" 
      class="px-4 py-2.5 rounded-xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-200/70 dark:border-gray-700/60 flex items-center justify-between gap-3 text-xs"
    >
      <!-- Left: Participants stack + message count -->
      <div class="flex items-center gap-2.5 min-w-0">
        <!-- Stacked participant avatars -->
        <div class="flex -space-x-1.5 overflow-hidden flex-shrink-0">
          <AppAvatar 
            v-for="p in uniqueParticipants.slice(0, 4)" 
            :key="p.email"
            :email="p.email"
            size="sm"
            class="inline-block ring-2 ring-white dark:ring-gray-800 rounded-full"
          />
        </div>

        <div class="flex items-center gap-1.5 truncate text-gray-600 dark:text-gray-300">
          <span class="font-bold text-gray-900 dark:text-white">
            {{ messages.length }} messages
          </span>
          <span class="text-gray-400">in conversation with</span>
          <span class="font-semibold truncate max-w-[200px]">
            {{ participantSummary }}
          </span>
        </div>
      </div>

      <!-- Right: Expand All / Collapse All -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          @click="toggleAllMessages"
          class="px-2 py-1 text-[11px] font-semibold rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 transition-colors cursor-pointer"
        >
          {{ allExpanded ? 'Collapse Earlier' : 'Expand All' }}
        </button>
      </div>
    </div>

    <!-- Messages Accordion List -->
    <div class="space-y-3.5">
      <div
        v-for="(msg, index) in messages"
        :key="msg.id"
        class="border transition-all duration-200 rounded-2xl overflow-hidden bg-white dark:bg-gray-900"
        :class="[
          isExpanded(msg.id) 
            ? 'border-gray-200 dark:border-gray-700/80 shadow-xs' 
            : 'border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30'
        ]"
      >
        <!-- Collapsed Message Header Bar (Click to Toggle) -->
        <div 
          @click="toggleExpand(msg.id)"
          class="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors"
          :class="isExpanded(msg.id) ? 'bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800' : 'hover:bg-gray-100/60 dark:hover:bg-gray-800/60'"
        >
          <!-- Left: Avatar + Sender + Snippet -->
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <AppAvatar 
              :email="isSentMessage(msg) ? (msg.recipient || '') : (msg.sender || '')"
              :opened-count="msg.opened_count"
              :clicked-count="msg.clicked_count"
              size="sm"
              class="flex-shrink-0"
            />

            <div class="min-w-0 flex-1 flex items-baseline gap-2">
              <span class="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[160px] sm:max-w-[220px]">
                {{ isSentMessage(msg) ? 'You' : msg.sender }}
              </span>

              <AppBadge :email="isSentMessage(msg) ? msg.recipient : msg.sender" />

              <!-- Snippet preview when collapsed -->
              <span 
                v-if="!isExpanded(msg.id)" 
                class="text-xs text-gray-500 dark:text-gray-400 truncate flex-1 font-normal ml-1"
              >
                — {{ getSnippet(msg.body) }}
              </span>
            </div>
          </div>

          <!-- Right: Date + Attachments indicator + Chevron -->
          <div class="flex items-center gap-2 flex-shrink-0 text-right">
            <!-- Attachment paperclip icon if has files -->
            <span 
              v-if="msg.attachments && msg.attachments.length > 0" 
              class="text-gray-400 flex items-center gap-0.5 text-[11px]" 
              :title="`${msg.attachments.length} attachment(s)`"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span>{{ msg.attachments.length }}</span>
            </span>

            <!-- Open tracking if sent -->
            <span 
              v-if="isSentMessage(msg) && msg.opened_count" 
              class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full bg-emerald-500/10"
            >
              Opened {{ msg.opened_count }}x
            </span>

            <span class="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
              {{ formatFriendlyDate(msg.date) }}
            </span>

            <!-- Chevron indicator -->
            <svg 
              class="w-4 h-4 text-gray-400 transition-transform duration-200" 
              :class="{ 'rotate-180': isExpanded(msg.id) }" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <!-- Expanded Full Message Content -->
        <div v-if="isExpanded(msg.id)" class="p-5 sm:p-6 space-y-4">
          <!-- Expanded Metadata (To, Cc, Actions) -->
          <div class="flex items-start justify-between gap-3 text-xs border-b border-gray-100 dark:border-gray-800 pb-3">
            <div class="text-gray-500 dark:text-gray-400 space-y-0.5">
              <div><span class="font-bold text-gray-700 dark:text-gray-300">From:</span> {{ msg.sender }}</div>
              <div><span class="font-bold text-gray-700 dark:text-gray-300">To:</span> {{ msg.recipient }}</div>
              <div v-if="msg.cc"><span class="font-bold text-gray-700 dark:text-gray-300">Cc:</span> {{ msg.cc }}</div>
            </div>

            <!-- Message Action Buttons (reply, forward, star) -->
            <div v-if="canWrite" class="flex items-center gap-1">
              <!-- Reply -->
              <button 
                type="button" 
                @click.stop="handleReplySingle(msg)"
                class="px-2 py-1 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                title="Reply to this message (r)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span class="hidden sm:inline">Reply</span>
              </button>

              <!-- Reply All (if multiple recipients) -->
              <button 
                v-if="msg.cc || (msg.recipient && msg.recipient.includes(','))"
                type="button" 
                @click.stop="handleReplyAllSingle(msg)"
                class="px-2 py-1 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                title="Reply All to this message (a)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span class="hidden sm:inline">Reply all</span>
              </button>

              <!-- Forward -->
              <button 
                type="button" 
                @click.stop="handleForwardSingle(msg)"
                class="px-2 py-1 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                title="Forward this message (f)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                </svg>
                <span class="hidden sm:inline">Forward</span>
              </button>

              <!-- Star -->
              <button 
                type="button" 
                @click.stop="handleStarSingle(msg)"
                class="p-1.5 text-gray-500 hover:text-amber-500 dark:text-gray-400 dark:hover:text-amber-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                :title="msg.starred ? 'Unstar' : 'Star'"
              >
                <svg v-if="msg.starred" class="w-3.5 h-3.5 text-amber-500 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Email Body Iframe -->
          <div class="w-full">
            <EmailIframe :body="formatMessageBody(msg)" />
          </div>

          <!-- Inline Quoted Text Folding Toggle (if quote detected) -->
          <div v-if="hasQuotedContent(msg.body)" class="pt-2">
            <button
              type="button"
              @click="toggleQuoteFold(msg.id)"
              class="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200/70 dark:border-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Toggle quoted text history"
            >
              <span class="tracking-widest font-black leading-none">···</span>
              <span>{{ showQuotes[msg.id] ? 'Hide trimmed history' : 'Show trimmed history' }}</span>
            </button>

            <!-- Render folded quote if expanded -->
            <div 
              v-if="showQuotes[msg.id]" 
              class="mt-2.5 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60"
            >
              <EmailIframe :body="extractQuotedContent(msg.body)" />
            </div>
          </div>

          <!-- Attachments List for this message -->
          <div v-if="msg.attachments && msg.attachments.length > 0" class="pt-3 border-t border-gray-100 dark:border-gray-800">
            <div class="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span>Attachments ({{ msg.attachments.length }})</span>
            </div>

            <div class="flex flex-wrap gap-2">
              <a 
                v-for="att in msg.attachments" 
                :key="att.id"
                :href="getAttachmentUrl(msg.id, att.id)"
                target="_blank"
                download
                class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-xs font-medium text-gray-800 dark:text-gray-200 group"
              >
                <svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span class="truncate max-w-[180px]">{{ att.filename }}</span>
                <span class="text-[10px] text-gray-400">({{ formatBytes(att.size) }})</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Reply Composer (Anchored at Bottom of Thread; a view-only user cannot send) -->
    <div v-if="canWrite" class="pt-3">
      <div class="bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-700/60 rounded-2xl p-4 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-gray-700 dark:text-gray-300">
              Reply to {{ replyTargetEmail }}
            </span>
            <AppBadge :email="replyTargetEmail" />
          </div>

          <div class="flex items-center gap-1.5">
            <!-- Canned Responses Dropdown -->
            <select 
              v-model="selectedCannedSnippet"
              @change="applyCannedSnippet"
              class="text-[11px] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-0.5 text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="">Insert template...</option>
              <option v-for="t in templatesStore.replies" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <span class="text-[10px] text-gray-400 font-mono hidden sm:inline">⌘+Enter</span>
          </div>
        </div>

        <textarea 
          ref="quickReplyInput"
          v-model="quickReplyText"
          rows="3"
          placeholder="Write a quick reply... (Cmd+Enter to send)"
          @keydown.meta.enter="dispatchQuickReply"
          @keydown.ctrl.enter="dispatchQuickReply"
          class="w-full bg-transparent text-base sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none resize-none leading-relaxed"
        ></textarea>

        <div class="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-gray-700/40 mt-1">
          <div class="flex items-center gap-3">
            <button 
              type="button" 
              @click="openFullComposer" 
              class="text-xs font-semibold text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Expand in full editor &rarr;
            </button>
            <span class="text-gray-300 dark:text-gray-600">·</span>
            <button 
              type="button" 
              @click="handleForwardThread" 
              class="text-xs font-semibold text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
              title="Forward conversation (f)"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
              </svg>
              <span>Forward</span>
            </button>
          </div>

          <button 
            type="button" 
            :disabled="sendingReply || !quickReplyText.trim()"
            @click="dispatchQuickReply" 
            class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg v-if="sendingReply" class="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Send Reply</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import AppAvatar from "@/components/AppAvatar.vue";
import AppBadge from "@/components/AppBadge.vue";
import EmailIframe from "@/components/EmailIframe.vue";
import { useToast } from "@/composables/useToast";
import api, { apiErrorMessage } from "@/services/api";
import { useEmailStore } from "@/stores/emails";
import { useMailboxStore } from "@/stores/mailboxes";
import { firstNameFromSender, renderTemplate, useTemplatesStore } from "@/stores/templates";
import { useUIStore } from "@/stores/ui";
import type { Email } from "@/types";

const props = defineProps<{
  mailboxId: string;
  rootEmail: Email;
  fromFolder?: string;
}>();

const emit = defineEmits<{
  (e: "reply", email: Email): void;
  (e: "reply-all", email: Email): void;
  (e: "forward", email: Email): void;
  (e: "star-changed", id: string, starred: boolean): void;
  (e: "thread-updated"): void;
}>();

const uiStore = useUIStore();
const emailStore = useEmailStore();
const { canWrite } = storeToRefs(useMailboxStore());
const toast = useToast();

const messages = ref<Email[]>([]);
const loadingThread = ref(false);
const expandedMessageIds = ref<Set<string>>(new Set());
const showQuotes = ref<Record<string, boolean>>({});

const quickReplyText = ref("");
const sendingReply = ref(false);
const quickReplyInput = ref<HTMLTextAreaElement | null>(null);
const selectedCannedSnippet = ref("");

const templatesStore = useTemplatesStore();
templatesStore.load().catch(() => {
  /* the dropdown simply stays empty if templates can't be loaded */
});

/** Bare, lower-cased address of `Name <a@b>` or `a@b`, for exact comparison. */
const addressOf = (value?: string | null): string =>
  ((value || "").match(/<([^>]+)>/)?.[1] || value || "").trim().toLowerCase();

// Per message, by its own folder first. The folder the thread was opened from can't decide it: a
// thread opened from Sent also holds the replies we received, and answering one of those must not
// address our own mailbox. In Inbox and Spam the From header is whatever the outside sender wrote,
// so spam that names our own address is not ours: it must not be labelled "You", and a reply must
// not go to the To header it chose. The sender's exact address (a mailbox's id is its address) is
// only used where the folder says nothing: Archive, Trash, custom folders, rows without a folder.
const isSentMessage = (msg: Email): boolean => {
  const folder = msg.folder_id || "";
  if (["sent", "drafts", "scheduled"].includes(folder)) return true;
  if (folder === "inbox" || folder === "spam") return false;
  const own = addressOf(props.mailboxId);
  return !!own && addressOf(msg.sender) === own;
};

const isExpanded = (id: string): boolean => {
  return expandedMessageIds.value.has(id);
};

const toggleExpand = (id: string) => {
  const next = new Set(expandedMessageIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  expandedMessageIds.value = next;
};

const allExpanded = computed(() => {
  return messages.value.length > 0 && messages.value.every((m) => expandedMessageIds.value.has(m.id));
});

const toggleAllMessages = () => {
  if (allExpanded.value) {
    // Collapse all except latest
    const latest = messages.value[messages.value.length - 1];
    expandedMessageIds.value = new Set(latest ? [latest.id] : []);
  } else {
    // Expand all
    expandedMessageIds.value = new Set(messages.value.map((m) => m.id));
  }
};

const uniqueParticipants = computed(() => {
  const map = new Map<string, { email: string; name: string }>();
  for (const m of messages.value) {
    if (m.sender && !map.has(m.sender)) {
      map.set(m.sender, { email: m.sender, name: m.sender.split("@")[0] });
    }
    if (m.recipient && !map.has(m.recipient)) {
      map.set(m.recipient, { email: m.recipient, name: m.recipient.split("@")[0] });
    }
  }
  return Array.from(map.values());
});

const participantSummary = computed(() => {
  const list = uniqueParticipants.value.map((p) => p.name);
  if (list.length <= 2) return list.join(", ");
  return `${list.slice(0, 2).join(", ")} +${list.length - 2} more`;
});

const latestMessage = computed(() => {
  return messages.value.length > 0 
    ? messages.value[messages.value.length - 1] 
    : props.rootEmail;
});

// The message the reply box answers: the latest one we received, so a second reply in a row still
// answers the correspondent (and still threads with their message) instead of our own last message.
// A conversation with nothing received yet falls back to its latest message.
const replyOriginal = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (!isSentMessage(messages.value[i])) return messages.value[i];
  }
  return latestMessage.value;
});

const replyTargetEmail = computed(() => {
  const original = replyOriginal.value;
  if (!original) return "";
  return isSentMessage(original) ? original.recipient : original.sender;
});

/** The reply box holds plain text; this is its HTML form (escaped, line breaks kept). */
const quickReplyHtml = (text: string): string =>
  `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`;

const loadThread = async () => {
  if (!props.mailboxId || !props.rootEmail) {
    messages.value = [];
    return;
  }

  loadingThread.value = true;
  try {
    const threadTargetId = props.rootEmail.thread_id || props.rootEmail.id;
    const res = await api.getThread(props.mailboxId, threadTargetId);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      // Drafts and scheduled messages (both live in Drafts) are not part of the conversation yet.
      // Listed here they looked sent, and the reply box answered them instead of the last real message.
      const delivered = res.data.filter((m: Email) => m.folder_id !== "drafts" || m.id === props.rootEmail.id);
      messages.value = delivered.length > 0 ? delivered : [props.rootEmail];
    } else {
      messages.value = [props.rootEmail];
    }
  } catch (err) {
    // Fallback to single root email if thread endpoint fails
    messages.value = [props.rootEmail];
  } finally {
    loadingThread.value = false;
    // Set default expansion: latest message expanded, earlier collapsed
    if (messages.value.length > 0) {
      const latest = messages.value[messages.value.length - 1];
      expandedMessageIds.value = new Set([latest.id]);
    }
  }
};

watch(
  () => props.rootEmail?.id,
  () => {
    loadThread();
  },
  { immediate: true }
);

const getAttachmentUrl = (emailId: string, attachmentId: string) => {
  return `/api/v1/mailboxes/${props.mailboxId}/emails/${emailId}/attachments/${attachmentId}`;
};

const formatMessageBody = (msg: Email): string => {
  if (!msg.body) return "";
  let body = msg.body;
  // Replace inline images
  if (msg.attachments && msg.attachments.length > 0) {
    for (const att of msg.attachments) {
      if (att.disposition === "inline" && att.content_id) {
        const url = getAttachmentUrl(msg.id, att.id);
        const cid = att.content_id.startsWith("<")
          ? att.content_id.slice(1, -1)
          : att.content_id;
        const regex = new RegExp(`cid:${cid}`, "g");
        body = body.replace(regex, url);
      }
    }
  }
  // Trim quoted block from main view if quoted fold toggle is active
  if (hasQuotedContent(body)) {
    body = stripQuotedContent(body);
  }
  return body;
};

// Quoted content detection and separation
const quoteRegex = /(<blockquote[\s\S]*?<\/blockquote>|<div class="gmail_quote"[\s\S]*?<\/div>|On\s+[\s\S]+?wrote:[\s\S]+)/i;

const hasQuotedContent = (html?: string | null): boolean => {
  if (!html) return false;
  return quoteRegex.test(html);
};

const stripQuotedContent = (html: string): string => {
  return html.replace(quoteRegex, "").trim();
};

const extractQuotedContent = (html?: string | null): string => {
  if (!html) return "";
  const match = html.match(quoteRegex);
  return match ? match[0] : "";
};

const toggleQuoteFold = (msgId: string) => {
  showQuotes.value[msgId] = !showQuotes.value[msgId];
};

const getSnippet = (body?: string | null): string => {
  if (!body) return "";
  const text = body
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 90 ? text.slice(0, 90) + "..." : text;
};

const applyCannedSnippet = () => {
  const template = templatesStore.replies.find((t) => t.id === selectedCannedSnippet.value);
  if (template) {
    quickReplyText.value = renderTemplate(template.body, {
      first_name: firstNameFromSender(replyTargetEmail.value),
    });
    nextTick(() => {
      quickReplyInput.value?.focus();
    });
  }
};

const handleReplySingle = (msg: Email) => {
  uiStore.openComposeModal({
    mode: isSentMessage(msg) ? "new" : "reply",
    originalEmail: msg,
    initialTo: isSentMessage(msg) ? msg.recipient : msg.sender,
    initialSubject: msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`,
  });
  emit("reply", msg);
};

const handleReplyAllSingle = (msg: Email) => {
  uiStore.openComposeModal({
    mode: "reply-all",
    originalEmail: msg,
    initialTo: isSentMessage(msg) ? msg.recipient : msg.sender,
    initialSubject: msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`,
  });
  emit("reply-all", msg);
};

const handleForwardSingle = (msg: Email) => {
  uiStore.openComposeModal({
    mode: "forward",
    originalEmail: msg,
    initialSubject: msg.subject.startsWith("Fwd:") ? msg.subject : `Fwd: ${msg.subject}`,
  });
  emit("forward", msg);
};

const handleForwardThread = () => {
  const original = replyOriginal.value || props.rootEmail;
  uiStore.openComposeModal({
    mode: "forward",
    originalEmail: original,
    initialSubject: original.subject.startsWith("Fwd:") ? original.subject : `Fwd: ${original.subject}`,
  });
  emit("forward", original);
};

const handleStarSingle = async (msg: Email) => {
  const nextStarred = !msg.starred;
  await emailStore.updateEmail(props.mailboxId, msg.id, { starred: nextStarred });
  msg.starred = nextStarred;
  emit("star-changed", msg.id, nextStarred);
};

const openFullComposer = () => {
  const original = replyOriginal.value;
  const typed = quickReplyText.value.trim();
  uiStore.openComposeModal({
    mode: isSentMessage(original) ? "new" : "reply",
    originalEmail: original,
    initialTo: replyTargetEmail.value,
    initialSubject: original.subject.startsWith("Re:") ? original.subject : `Re: ${original.subject}`,
    // The composer takes HTML. Handed the raw text, "<john@x.com>" vanished as an unknown tag and
    // line breaks collapsed.
    initialBody: typed ? quickReplyHtml(quickReplyText.value) : "",
    initialBodyUnsaved: !!typed,
  });
  // The text now lives in the composer. Left here too, with Send Reply enabled, the same reply
  // could be sent a second time from this box.
  quickReplyText.value = "";
  selectedCannedSnippet.value = "";
};

const dispatchQuickReply = async () => {
  if (!quickReplyText.value.trim() || sendingReply.value) return;

  const original = replyOriginal.value;
  sendingReply.value = true;
  try {
    const replySubject = original.subject.startsWith("Re:")
      ? original.subject
      : `Re: ${original.subject}`;

    // Through the reply endpoint, which derives In-Reply-To, References and the thread from the
    // message being answered. The box holds plain text, so it is escaped before it becomes HTML.
    const text = quickReplyText.value;
    await api.replyToEmail(props.mailboxId, original.id, {
      to: replyTargetEmail.value,
      subject: replySubject,
      html: quickReplyHtml(text),
      text,
    });

    toast.success("Reply dispatched to conversation");
    quickReplyText.value = "";
    selectedCannedSnippet.value = "";

    // Refresh conversation thread
    await loadThread();
    emit("thread-updated");
  } catch (err: any) {
    toast.error(apiErrorMessage(err, "Failed to dispatch reply"));
  } finally {
    sendingReply.value = false;
  }
};

const formatFriendlyDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};
</script>
