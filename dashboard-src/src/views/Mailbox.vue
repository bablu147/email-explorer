<template>
  <div class="flex h-screen h-[100dvh] w-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <Sidebar />
    <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      <Header />
      <main
        class="flex-1 min-h-0 bg-white dark:bg-gray-900 flex flex-col lg:!pb-0"
        :class="isInternalScrollView ? 'overflow-hidden' : 'overflow-y-auto'"
        :style="{ paddingBottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' }"
      >
        <router-view />
      </main>
    </div>
    <ComposeEmail v-if="uiStore.isComposeModalOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import Header from "@/components/Header.vue";
import Sidebar from "@/components/Sidebar.vue";
import { useMailboxStore } from "@/stores/mailboxes";
import { useUIStore } from "@/stores/ui";

const ComposeEmail = defineAsyncComponent(() => import("@/components/ComposeEmail.vue"));
const uiStore = useUIStore();
const mailboxStore = useMailboxStore();
const route = useRoute();

const isInternalScrollView = computed(() =>
	["EmailList", "DiscoverApps", "Pipeline"].includes(route.name as string),
);

const loadMailbox = (id?: string) => {
	const mailboxId = id || (route.params.mailboxId as string);
	if (mailboxId) {
		mailboxStore.fetchMailbox(mailboxId);
	}
};

onMounted(() => {
	loadMailbox();
});

watch(
	() => route.params.mailboxId,
	(newId) => {
		if (newId) {
			loadMailbox(newId as string);
		}
	},
);
</script>
