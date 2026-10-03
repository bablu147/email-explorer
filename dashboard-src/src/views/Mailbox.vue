<template>
  <div class="flex h-screen h-[100dvh] w-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <Sidebar />
    <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      <Header />
      <main
        class="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-900 flex flex-col sm:!pb-0"
        :style="{ paddingBottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' }"
      >
        <router-view />
      </main>
    </div>
    <ComposeEmail />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import ComposeEmail from "@/components/ComposeEmail.vue";
import Header from "@/components/Header.vue";
import Sidebar from "@/components/Sidebar.vue";
import { useMailboxStore } from "@/stores/mailboxes";

const mailboxStore = useMailboxStore();
const route = useRoute();

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
