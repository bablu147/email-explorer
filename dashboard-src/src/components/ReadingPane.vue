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
            <span>Delete</span>
            <kbd class="px-1.5 py-0.5 font-mono text-[11px] rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">#</kbd>
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

          <div class="h-4 w-px bg-gray-200 dark:border-gray-700 mx-1"></div>

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

          <!-- Archive -->
          <button 
            type="button"
            @click="handleArchive"
            class="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
            title="Archive (e)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>

          <!-- Delete -->
          <button 
            type="button"
            @click="handleDelete"
            class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
            title="Delete (# or d)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <div class="h-4 w-px bg-gray-200 dark:border-gray-700 mx-1"></div>

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

      <!-- Scrollable Message Canvas -->
      <div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
        <!-- Subject Banner -->
        <div>
          <h2 class="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-snug">
            {{ email.subject || "(No subject)" }}
          </h2>
        </div>

        <!-- Sender / Recipient Banner -->
        <div class="flex items-start justify-between gap-3 p-3.5 bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-700/60 rounded-2xl">
          <div class="flex items-start gap-3 min-w-0">
            <!-- Avatar -->
            <AppAvatar 
              :email="isSentEmail ? (email.recipient || '') : (email.sender || '')" 
              :opened-count="email.opened_count"
              :clicked-count="email.clicked_count"
              size="md"
            />

            <!-- Names & Recipient -->
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {{ isSentEmail ? 'You' : email.sender }}
                </span>
                <AppBadge :email="isSentEmail ? email.recipient : email.sender" />
              </div>

              <!-- Recipient Line -->
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                <span class="text-gray-400">to:</span> {{ email.recipient }}
                <span v-if="email.cc" class="ml-2"><span class="text-gray-400">cc:</span> {{ email.cc }}</span>
              </div>
            </div>
          </div>

          <!-- Date & Engagement Stats -->
          <div class="text-right flex-shrink-0">
            <span class="text-xs font-semibold text-gray-500 dark:text-gray-400" :title="email.date">
              {{ formatFriendlyDate(email.date) }}
            </span>
            <div v-if="isSentEmail && email.opened_count" class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              Opened {{ email.opened_count }}x
            </div>
          </div>
        </div>

        <!-- Body Rendered via EmailIframe -->
        <div class="w-full">
          <EmailIframe :body="emailBodyWithInlineImages" />
        </div>

        <!-- Attachments List -->
        <div v-if="email.attachments && email.attachments.length > 0" class="pt-3 border-t border-gray-100 dark:border-gray-800">
          <div class="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span>Attachments ({{ email.attachments.length }})</span>
          </div>

          <div class="flex flex-wrap gap-2">
            <a 
              v-for="att in email.attachments" 
              :key="att.id"
              :href="getAttachmentUrl(att.id)"
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

        <!-- Quick Reply Box -->
        <div class="pt-4 border-t border-gray-200 dark:border-gray-800">
          <div class="bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-700/60 rounded-2xl p-3.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-gray-700 dark:text-gray-300">
                Reply to {{ isSentEmail ? email.recipient : email.sender }}
              </span>
              <div class="flex items-center gap-1.5">
                <!-- Preset Canned Responses -->
                <select 
                  v-model="selectedCannedSnippet"
                  @change="applyCannedSnippet"
                  class="text-[11px] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-0.5 text-gray-700 dark:text-gray-300 focus:outline-none"
                >
                  <option value="">Insert Canned Snippet...</option>
                  <option value="sdk_setup">Unity SDK Setup Guide</option>
                  <option value="postback_test">Attribution Postback Verification</option>
                  <option value="outreach_pitch">MMP Switch & Lower Fee Pitch</option>
                </select>
                <span class="text-[10px] text-gray-400 font-mono hidden sm:inline">⌘+Enter</span>
              </div>
            </div>

            <textarea 
              ref="quickReplyInput"
              v-model="quickReplyBody"
              rows="3"
              placeholder="Type your message... (Cmd+Enter to send)"
              @keydown.meta.enter="submitQuickReply"
              @keydown.ctrl.enter="submitQuickReply"
              class="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none resize-none leading-relaxed"
            ></textarea>

            <div class="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-gray-700/40">
              <button 
                type="button" 
                @click="openFullComposerWithReply" 
                class="text-xs font-semibold text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Expand in full editor &rarr;
              </button>
              <button 
                type="button" 
                :disabled="sendingQuickReply || !quickReplyBody.trim()"
                @click="submitQuickReply" 
                class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg v-if="sendingQuickReply" class="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import AppAvatar from "@/components/AppAvatar.vue";
import AppBadge from "@/components/AppBadge.vue";
import EmailIframe from "@/components/EmailIframe.vue";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
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
	(e: "archived", email: Email): void;
	(e: "deleted", emailId: string): void;
	(e: "starred-changed", starred: boolean): void;
	(e: "read-changed", read: boolean): void;
}>();

const emailStore = useEmailStore();
const folderStore = useFolderStore();
const uiStore = useUIStore();
const toast = useToast();

const email = ref<Email | null>(null);
const loading = ref(false);

const quickReplyBody = ref("");
const sendingQuickReply = ref(false);
const quickReplyInput = ref<HTMLTextAreaElement | null>(null);
const selectedCannedSnippet = ref("");

const isSentEmail = computed(() => {
	if (!email.value) return false;
	return (
		props.fromFolder === "sent" ||
		(email.value.opened_count !== undefined && email.value.opened_count !== null)
	);
});

const cannedSnippets: Record<string, string> = {
	sdk_setup:
		"Hi team,\n\nHere is the quick setup guide for Reflect Unity SDK:\n1. Import the reflect-sdk.unitypackage into your project.\n2. Ensure EDM4U resolves native dependencies.\n3. Initialize in your game bootstrap:\nReflect.Initialize(\"YOUR_APP_KEY\");\n\nLet us know if you hit any build warnings!\n\nBest regards,\nReflect MMP Support",
	postback_test:
		"Hi,\n\nWe verified your postback configuration. Raw installs and SAN attribution events are recording cleanly on api.reflect.cloud with valid signatures.\n\nCould you trigger a test purchase event to verify in-app event postbacks?\n\nThanks,\nReflect MMP Engineering",
	outreach_pitch:
		"Hi,\n\nI noticed your recent launch on the store! Reflect is a modern, transparent mobile measurement platform (MMP) built specifically for mobile game studios.\n\nWe offer zero-data sampling, real-time raw event streaming to your own S3/R2/BigQuery, and flat pricing without punitive MAU penalties.\n\nWould you have 10 minutes next week for a quick sandbox walkthrough?\n\nBest,\nReflect Growth Team",
};

const applyCannedSnippet = () => {
	if (selectedCannedSnippet.value && cannedSnippets[selectedCannedSnippet.value]) {
		quickReplyBody.value = cannedSnippets[selectedCannedSnippet.value];
		nextTick(() => {
			quickReplyInput.value?.focus();
		});
	}
};

const getAttachmentUrl = (attachmentId: string) => {
	return `/api/v1/mailboxes/${props.mailboxId}/emails/${props.emailId}/attachments/${attachmentId}`;
};

const emailBodyWithInlineImages = computed(() => {
	if (!email.value || !email.value.body) return "";
	let body = email.value.body;
	if (email.value.attachments && email.value.attachments.length > 0) {
		for (const att of email.value.attachments) {
			if (att.disposition === "inline" && att.content_id) {
				const url = getAttachmentUrl(att.id);
				const cid = att.content_id.startsWith("<")
					? att.content_id.slice(1, -1)
					: att.content_id;
				const regex = new RegExp(`cid:${cid}`, "g");
				body = body.replace(regex, url);
			}
		}
	}
	return body;
});

const loadEmail = async (id: string) => {
	if (!id || !props.mailboxId) {
		email.value = null;
		return;
	}

	loading.value = true;
	try {
		await emailStore.fetchEmail(props.mailboxId, id);
		email.value = emailStore.currentEmail;

		// If unread, mark read in background
		if (email.value && !email.value.read) {
			await emailStore.updateEmail(props.mailboxId, id, { read: true });
			emit("read-changed", true);
			folderStore.fetchFolders(props.mailboxId);
		}
	} catch (err) {
		console.error("Failed to load email in reading pane", err);
	} finally {
		loading.value = false;
	}
};

watch(
	() => props.emailId,
	(newId) => {
		if (newId) {
			loadEmail(newId);
		} else {
			email.value = null;
		}
	},
	{ immediate: true },
);

const handleToggleStar = async () => {
	if (!email.value) return;
	const nextStar = !email.value.starred;
	await emailStore.updateEmail(props.mailboxId, email.value.id, { starred: nextStar });
	email.value.starred = nextStar;
	emit("starred-changed", nextStar);
};

const handleArchive = async () => {
	if (!email.value) return;
	try {
		await emailStore.moveEmail(props.mailboxId, email.value.id, "archive");
		toast.success("Conversation archived");
		emit("archived", email.value);
	} catch (e) {
		toast.error("Failed to archive");
	}
};

const handleDelete = async () => {
	if (!email.value) return;
	try {
		await emailStore.deleteEmail(props.mailboxId, email.value.id);
		toast.success("Moved to Trash");
		emit("deleted", email.value.id);
	} catch (e) {
		toast.error("Failed to delete");
	}
};

const handleReply = () => {
	if (!email.value) return;
	uiStore.openComposeModal({
		mode: isSentEmail.value ? "new" : "reply",
		originalEmail: email.value,
		initialTo: isSentEmail.value ? email.value.recipient : email.value.sender,
		initialSubject: email.value.subject.startsWith("Re:")
			? email.value.subject
			: `Re: ${email.value.subject}`,
	});
};

const openFullComposerWithReply = () => {
	if (!email.value) return;
	uiStore.openComposeModal({
		mode: isSentEmail.value ? "new" : "reply",
		originalEmail: email.value,
		initialTo: isSentEmail.value ? email.value.recipient : email.value.sender,
		initialSubject: email.value.subject.startsWith("Re:")
			? email.value.subject
			: `Re: ${email.value.subject}`,
		initialBody: quickReplyBody.value,
	});
};

const submitQuickReply = async () => {
	if (!email.value || !quickReplyBody.value.trim() || sendingQuickReply.value) return;

	sendingQuickReply.value = true;
	try {
		const targetRecipient = isSentEmail.value ? email.value.recipient : email.value.sender;
		const replySubject = email.value.subject.startsWith("Re:")
			? email.value.subject
			: `Re: ${email.value.subject}`;

		await api.sendEmail(props.mailboxId, {
			to: targetRecipient,
			subject: replySubject,
			body: `<p>${quickReplyBody.value.replace(/\n/g, "<br>")}</p>`,
			inReplyTo: email.value.id,
		});

		toast.success("Reply dispatched");
		quickReplyBody.value = "";
		selectedCannedSnippet.value = "";
	} catch (e) {
		toast.error("Failed to send reply");
	} finally {
		sendingQuickReply.value = false;
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
