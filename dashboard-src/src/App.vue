<template>
  <router-view />
  <MobileComposeFab />
  <MobileBottomNav />
  <InstallPrompt />
  <Toast />
  <LinkAppModal />
  <CommandPalette />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import CommandPalette from "@/components/CommandPalette.vue";
import InstallPrompt from "@/components/InstallPrompt.vue";
import LinkAppModal from "@/components/LinkAppModal.vue";
import MobileBottomNav from "@/components/MobileBottomNav.vue";
import MobileComposeFab from "@/components/MobileComposeFab.vue";
import Toast from "@/components/Toast.vue";
import { useAppSettings } from "@/composables/useAppSettings";
import { useTheme } from "@/composables/useTheme";
import { initPushNotifications } from "@/services/pushNotification";
import { useAppBindingsStore } from "@/stores/appBindings";

const { fetchSettings } = useAppSettings();
const { initTheme } = useTheme();
const appBindingsStore = useAppBindingsStore();

onMounted(() => {
	initTheme();
	fetchSettings();
	appBindingsStore.fetchBindings();
	initPushNotifications();
});
</script>
