<template>
  <div class="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 transition-colors">
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700/60">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Mailbox Settings</h1>
        <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Configure profile details and signature for this mailbox</p>
      </div>
      <router-link
        :to="{ name: 'EmailList', params: { mailboxId: route.params.mailboxId, folder: 'inbox' } }"
        class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
      >
        ← Back to Inbox
      </router-link>
    </div>

    <div v-if="mailbox">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <div>
          <label for="name" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Display Name</label>
          <input 
            type="text" 
            id="name" 
            v-model="mailbox.name" 
            class="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 dark:text-gray-100 p-3 text-sm transition-all" 
          />
        </div>
        <div>
          <label for="email" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
          <input 
            type="email" 
            id="email" 
            v-model="mailbox.email" 
            class="block w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xs text-gray-500 dark:text-gray-400 p-3 text-sm cursor-not-allowed" 
            disabled 
          />
        </div>

        <!-- Signature Section -->
        <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-base font-bold text-gray-900 dark:text-white">Email Signature</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Automatically append a branded signature to outgoing emails.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="signatureEnabled" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-600 peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          <div v-if="signatureEnabled" class="mt-4">
            <RichTextEditor v-model="signatureHtml" />
          </div>
        </div>

        <!-- Push Notifications & PWA Section -->
        <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-gray-900 dark:text-white">Push Notifications</h2>
                <span
                  v-if="pushSubscribed"
                  class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                >
                  Active
                </span>
                <span
                  v-else-if="pushPermission === 'denied'"
                  class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                >
                  Blocked
                </span>
                <span
                  v-else
                  class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20"
                >
                  Inactive
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Receive background alerts on desktop and mobile when new emails arrive.
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="pushSubscribed"
                :disabled="pushLoading || !pushSupported"
                @change="togglePush"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-600 peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
            </label>
          </div>

          <div v-if="pushPermission === 'denied'" class="mt-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Notifications are blocked in your browser settings. Please allow notifications for this site to enable push alerts.
          </div>

          <div class="flex items-center gap-3 mt-4">
            <button
              type="button"
              :disabled="!pushSubscribed || testPushLoading"
              @click="handleSendTestPush"
              class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>{{ testPushLoading ? 'Sending...' : 'Send Test Notification' }}</span>
            </button>
          </div>
        </div>

        <div class="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700/60">
          <button 
            type="submit" 
            class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import RichTextEditor from "@/components/RichTextEditor.vue";
import { useToast } from "@/composables/useToast";
import { usePushNotification } from "@/services/pushNotification";
import { useMailboxStore } from "@/stores/mailboxes";

const mailboxStore = useMailboxStore();
const { currentMailbox: mailbox } = storeToRefs(mailboxStore);
const route = useRoute();
const { success: showSuccessToast, error: showErrorToast } = useToast();

const {
	isSupported: pushSupported,
	permission: pushPermission,
	isSubscribed: pushSubscribed,
	loading: pushLoading,
	subscribe: subscribePush,
	unsubscribe: unsubscribePush,
	sendTestNotification: sendTestPush,
} = usePushNotification();

const testPushLoading = ref(false);

const togglePush = async (e: Event) => {
	const checked = (e.target as HTMLInputElement).checked;
	try {
		if (checked) {
			const success = await subscribePush(route.params.mailboxId as string);
			if (success) {
				showSuccessToast("Push notifications enabled!");
			} else {
				showErrorToast("Notification permission was not granted.");
			}
		} else {
			await unsubscribePush(route.params.mailboxId as string);
			showSuccessToast("Push notifications disabled.");
		}
	} catch (err: any) {
		showErrorToast(err?.message || "Failed to update push notification settings.");
	}
};

const handleSendTestPush = async () => {
	testPushLoading.value = true;
	try {
		const res = await sendTestPush(route.params.mailboxId as string);
		if (res.success) {
			showSuccessToast(res.message || "Test notification dispatched!");
		} else {
			showErrorToast(res.message || "No active push subscription found to test.");
		}
	} catch (err: any) {
		showErrorToast(err?.message || "Failed to send test push notification.");
	} finally {
		testPushLoading.value = false;
	}
};

const signatureEnabled = ref(false);
const signatureHtml = ref("");

// Initialize signature state when mailbox loads
watch(
	mailbox,
	(m) => {
		if (m?.settings?.signature) {
			signatureEnabled.value = m.settings.signature.enabled;
			signatureHtml.value =
				m.settings.signature.html || m.settings.signature.text || "";
		}
	},
	{ immediate: true },
);

onMounted(() => {
	mailboxStore.fetchMailbox(route.params.mailboxId as string);
});

const stripHtml = (html: string): string => {
	const div = document.createElement("div");
	div.innerHTML = html;
	return div.textContent || div.innerText || "";
};

const updateSettings = async () => {
	if (mailbox.value) {
		const settings = {
			...mailbox.value.settings,
			signature: {
				enabled: signatureEnabled.value,
				text: stripHtml(signatureHtml.value),
				html: signatureHtml.value,
			},
		};
		await mailboxStore.updateMailbox(route.params.mailboxId as string, settings);
		showSuccessToast("Settings saved successfully!");
	}
};
</script>
