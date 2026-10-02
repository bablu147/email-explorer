<template>
  <div v-if="binding" class="inline-flex items-center gap-1 group/badge" @click.stop>
    <!-- App Identity Chip -->
    <a
      :href="binding.app_url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold transition-all duration-150 border shadow-2xs hover:scale-102 cursor-pointer"
      :class="badgeColorClasses"
      :title="`${binding.app_name} (${formatPlatform(binding.platform)})${binding.developer_name ? ' by ' + binding.developer_name : ''} • Click to open ${formatPlatform(binding.platform)}`"
    >
      <img
        :src="binding.app_icon_url"
        :alt="binding.app_name"
        class="w-3.5 h-3.5 rounded object-cover flex-shrink-0 bg-white"
        loading="lazy"
        @error="handleImgError"
      />
      <span class="truncate max-w-[150px] tracking-tight">{{ binding.app_name }}</span>

      <!-- External Link Arrow -->
      <svg class="w-3 h-3 opacity-60 group-hover/badge:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>

    <!-- Quick Edit Pencil Button (visible on group hover) -->
    <button
      type="button"
      @click.stop.prevent="openEditModal"
      class="opacity-0 group-hover/badge:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded cursor-pointer"
      title="Edit app binding"
    >
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { extractCleanEmail, useAppBindingsStore } from "@/stores/appBindings";
import type { AppPlatform } from "@/types";

const props = defineProps<{
	email?: string | null;
}>();

const appBindingsStore = useAppBindingsStore();

const cleanEmail = computed(() => extractCleanEmail(props.email));

const binding = computed(() => {
	if (!cleanEmail.value) return null;
	return appBindingsStore.getBinding(cleanEmail.value);
});

const badgeColorClasses = computed(() => {
	if (!binding.value) return "";
	switch (binding.value.platform) {
		case "playstore":
			return "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/25";
		case "appstore":
			return "bg-blue-500/10 hover:bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-500/25";
		case "website":
		default:
			return "bg-teal-500/10 hover:bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-500/25";
	}
});

const formatPlatform = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore":
			return "Google Play";
		case "appstore":
			return "App Store";
		case "website":
			return "Website";
	}
};

const handleImgError = (event: Event) => {
	const img = event.target as HTMLImageElement;
	if (img.dataset.hasError) return;
	img.dataset.hasError = "true";
	if (binding.value?.platform === "playstore") {
		img.src = "https://www.google.com/s2/favicons?domain=play.google.com&sz=128";
	} else if (binding.value?.platform === "appstore") {
		img.src = "https://www.google.com/s2/favicons?domain=apple.com&sz=128";
	} else {
		try {
			const u = new URL(binding.value?.app_url || "");
			img.src = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
		} catch {
			img.src = "https://www.google.com/s2/favicons?domain=reflect.cloud&sz=128";
		}
	}
};

const openEditModal = () => {
	if (!cleanEmail.value) return;
	appBindingsStore.openLinkModal(cleanEmail.value, binding.value);
};
</script>
