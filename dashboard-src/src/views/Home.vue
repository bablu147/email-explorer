<template>
  <div
    class="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl sm:!pb-8"
    :style="{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }"
  >
    <div class="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent mb-1.5 tracking-tight">Mailboxes</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400">Manage and explore your corporate email domains & routing</p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <div class="text-right hidden sm:block">
          <p class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ authStore.currentUser?.email }}</p>
          <p v-if="authStore.isAdmin" class="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-extrabold">Admin</p>
        </div>
        <!-- Dark Mode Toggle in Home -->
        <button
          type="button"
          @click="toggleTheme"
          class="p-2.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer"
          :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        >
          <svg v-if="isDark" class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
        <button
          @click="openCreateMailboxModal"
          class="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Mailbox
        </button>
        <router-link
          v-if="authStore.isAdmin"
          to="/admin"
          class="px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          Admin Panel
        </router-link>
        <button
          @click="handleLogout"
          class="px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
        >
          Logout
        </button>
      </div>
    </div>

    <!-- Mailboxes Grid -->
    <div v-if="mailboxes.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <router-link 
        v-for="mailbox in mailboxes" 
        :key="mailbox.id" 
        :to="{ name: 'Mailbox', params: { mailboxId: mailbox.id } }"
        class="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-400 p-6 flex flex-col justify-between"
      >
        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-sm ring-4 ring-emerald-500/10">
              {{ mailbox.name.charAt(0).toUpperCase() }}
            </div>
            <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/30 transition-all">
              <svg class="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200">{{ mailbox.name }}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 truncate">
            <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span class="truncate">{{ mailbox.email }}</span>
          </p>
        </div>

        <div class="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-400">
          <span>Reflect Mailbox</span>
          <span class="font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline">Open Inbox →</span>
        </div>
      </router-link>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 border border-gray-200 dark:border-gray-700">
      <div class="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">No mailboxes found</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
        Create your first mailbox or configure Cloudflare Email Routing to receive emails directly.
      </p>
      <div class="bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl p-6 max-w-2xl mx-auto border border-emerald-500/20 text-left">
        <p class="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3">
          To configure inbound email, configure your domain's MX and SPF/DKIM DNS records on Cloudflare to route incoming mail to this worker.
        </p>
        <a 
          href="https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="inline-flex items-center text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold transition-colors gap-1.5"
        >
          View Cloudflare Email Routing documentation
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>

    <!-- Create Mailbox Modal -->
    <div v-if="isCreateModalOpen" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div class="flex justify-between items-center bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
          <h2 class="text-lg font-bold text-white">Create New Mailbox</h2>
          <button @click="closeCreateMailboxModal" class="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-all cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form @submit.prevent="handleCreateMailbox" class="p-6">
          <div v-if="createError" class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6 flex items-start gap-3 text-xs" role="alert">
            <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <span>{{ createError }}</span>
          </div>
          <div class="mb-4">
            <label for="mailbox-email" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
            <input 
              type="email" 
              id="mailbox-email" 
              v-model="newMailboxEmail" 
              class="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 dark:text-gray-100 px-3.5 py-2.5 text-sm transition-all duration-150" 
              placeholder="e.g. info@reflect.cloud"
              required 
            />
          </div>
          <div class="mb-6">
            <label for="mailbox-name" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Display Name</label>
            <input 
              type="text" 
              id="mailbox-name" 
              v-model="newMailboxName" 
              class="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 dark:text-gray-100 px-3.5 py-2.5 text-sm transition-all duration-150" 
              placeholder="e.g. Reflect Customer Support"
              required 
            />
          </div>
          <div class="flex justify-end gap-2.5">
            <button 
              type="button" 
              @click="closeCreateMailboxModal" 
              class="px-4 py-2.5 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-semibold text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="isCreatingMailbox"
              class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg v-if="!isCreatingMailbox" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <svg v-else class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isCreatingMailbox ? 'Creating...' : 'Create Mailbox' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import { useTheme } from "@/composables/useTheme";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useMailboxStore } from "@/stores/mailboxes";

const router = useRouter();
const mailboxStore = useMailboxStore();
const authStore = useAuthStore();
const { mailboxes } = storeToRefs(mailboxStore);
const { success: showSuccessToast, error: showErrorToast } = useToast();
const { isDark, toggleTheme } = useTheme();

const isCreateModalOpen = ref(false);
const newMailboxEmail = ref("");
const newMailboxName = ref("");
const isCreatingMailbox = ref(false);
const createError = ref<string | null>(null);

onMounted(() => {
	mailboxStore.fetchMailboxes();
});

const openCreateMailboxModal = () => {
	isCreateModalOpen.value = true;
	newMailboxEmail.value = "";
	newMailboxName.value = "";
	createError.value = null;
};

const closeCreateMailboxModal = () => {
	isCreateModalOpen.value = false;
	newMailboxEmail.value = "";
	newMailboxName.value = "";
	createError.value = null;
};

const handleCreateMailbox = async () => {
	createError.value = null;

	if (!newMailboxEmail.value || !newMailboxName.value) {
		createError.value = "Please fill in all fields";
		return;
	}

	isCreatingMailbox.value = true;
	try {
		await api.createMailbox(newMailboxEmail.value, newMailboxName.value);
		showSuccessToast("Mailbox created successfully!");
		closeCreateMailboxModal();
		await mailboxStore.fetchMailboxes();
	} catch (e: any) {
		const errorMessage = e.response?.data?.error || "Failed to create mailbox";
		createError.value = errorMessage;
		showErrorToast(errorMessage);
	} finally {
		isCreatingMailbox.value = false;
	}
};

async function handleLogout() {
	await authStore.logout();
	router.push("/login");
}
</script>
