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
import { useMailboxStore } from "@/stores/mailboxes";

const mailboxStore = useMailboxStore();
const { currentMailbox: mailbox } = storeToRefs(mailboxStore);
const route = useRoute();
const { success: showSuccessToast } = useToast();

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
