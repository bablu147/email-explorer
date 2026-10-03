<template>
  <router-view />
  <Toast />
  <LinkAppModal />
  <CommandPalette />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import Toast from "@/components/Toast.vue";
import LinkAppModal from "@/components/LinkAppModal.vue";
import CommandPalette from "@/components/CommandPalette.vue";
import { useAppSettings } from "@/composables/useAppSettings";
import { useTheme } from "@/composables/useTheme";
import { useAppBindingsStore } from "@/stores/appBindings";

const { fetchSettings } = useAppSettings();
const { initTheme } = useTheme();
const appBindingsStore = useAppBindingsStore();

onMounted(() => {
	initTheme();
	fetchSettings();
	appBindingsStore.fetchBindings();
});
</script>

