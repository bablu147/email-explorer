<template>
  <button
    v-if="shouldShow"
    type="button"
    @click="openCompose"
    class="lg:hidden fixed z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-2xl shadow-emerald-600/40 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer"
    :style="{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))', right: '1.25rem' }"
    title="Compose Email"
    aria-label="Compose new email"
  >
    <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useUIStore } from "@/stores/ui";

const route = useRoute();
const uiStore = useUIStore();

const shouldShow = computed(() => {
	// Hide if compose modal is already open, or when viewing email detail (avoid covering Quick Reply)
	if (uiStore.isComposeModalOpen) return false;
	if (route.name === "EmailDetail") return false;
	const isAuthPage = [
		"Login",
		"Register",
		"ForgotPassword",
		"ResetPassword",
	].includes(route.name as string);
	return !isAuthPage;
});

const openCompose = () => {
	uiStore.openComposeModal({ mode: "new" });
};
</script>
