<template>
  <router-view />
  <Toast />
  <LinkAppModal />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import Toast from "@/components/Toast.vue";
import LinkAppModal from "@/components/LinkAppModal.vue";
import { useAppSettings } from "@/composables/useAppSettings";
import { useAppBindingsStore } from "@/stores/appBindings";

const { fetchSettings } = useAppSettings();
const appBindingsStore = useAppBindingsStore();

onMounted(() => {
	fetchSettings();
	appBindingsStore.fetchBindings();
});
</script>

