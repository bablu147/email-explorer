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
import { onMounted, watch } from "vue";
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
import { useAuthStore } from "@/stores/auth";

const { fetchSettings } = useAppSettings();
const { initTheme } = useTheme();
const appBindingsStore = useAppBindingsStore();
const authStore = useAuthStore();

onMounted(() => {
	initTheme();
	fetchSettings();
	initPushNotifications();
});

// The app bindings need a session. Asked for on the sign-in page, the request only produced a 401,
// so it waits until someone is signed in.
watch(
	() => authStore.isAuthenticated,
	(signedIn) => {
		if (signedIn) appBindingsStore.fetchBindings();
	},
	{ immediate: true },
);
</script>
