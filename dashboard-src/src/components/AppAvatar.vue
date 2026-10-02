<template>
  <div 
    class="relative flex-shrink-0 group/avatar inline-block select-none"
    :class="containerSizeClasses"
  >
    <!-- 1. LINKED STATE: Render App Icon Image -->
    <template v-if="binding">
      <!-- Clickable App Icon (opens Store or Website in new tab) -->
      <a
        :href="binding.app_url"
        target="_blank"
        rel="noopener noreferrer"
        @click.stop
        class="block w-full h-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700/80 shadow-xs hover:shadow-md hover:scale-105 transition-all duration-150 cursor-pointer bg-white"
        :title="`${binding.app_name} (${formatPlatform(binding.platform)}) • Click to open in new tab`"
      >
        <img
          :src="binding.app_icon_url"
          :alt="binding.app_name"
          class="w-full h-full object-cover"
          loading="lazy"
          @error="handleImgError"
        />
      </a>

      <!-- Platform Badge Indicator (Corner pill) -->
      <span
        class="absolute -bottom-1 -right-1 rounded-full text-white shadow-xs pointer-events-none flex items-center justify-center border-2 border-white dark:border-gray-900"
        :class="[
          badgeSizeClasses,
          binding.platform === 'playstore' 
            ? 'bg-emerald-600' 
            : binding.platform === 'appstore' 
            ? 'bg-blue-600' 
            : 'bg-indigo-600'
        ]"
        :title="formatPlatform(binding.platform)"
      >
        <component :is="getPlatformIcon(binding.platform)" class="w-2.5 h-2.5" />
      </span>

      <!-- Hover Edit Pencil Overlay Button -->
      <button
        type="button"
        @click.stop.prevent="openEditModal"
        class="absolute -top-1 -right-1 opacity-0 group-hover/avatar:opacity-100 transition-all duration-150 w-5 h-5 rounded-full bg-gray-900/90 text-white hover:bg-emerald-600 flex items-center justify-center shadow-md cursor-pointer border border-white dark:border-gray-800 z-10"
        title="Edit or unlink app binding"
      >
        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </template>

    <!-- 2. UNLINKED STATE: Initial Avatar with Click-to-Link Action -->
    <template v-else>
      <div
        @click.stop.prevent="openLinkModal"
        class="w-full h-full rounded-full flex items-center justify-center font-bold border transition-all duration-150 cursor-pointer relative overflow-hidden group-hover/avatar:ring-2 group-hover/avatar:ring-emerald-500/50"
        :class="[
          textSizeClasses,
          folder === 'sent'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
        ]"
        :title="`Click to link ${cleanEmail || 'this email'} to an App or Website`"
      >
        <!-- Initial letter -->
        <span class="group-hover/avatar:opacity-0 transition-opacity duration-150">
          {{ displayInitial }}
        </span>

        <!-- Hover "+" Hint Overlay -->
        <div
          class="absolute inset-0 bg-emerald-600 text-white flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>
    </template>

    <!-- Activity Indicator Dot (for Sent emails: opened or clicked) -->
    <span
      v-if="folder === 'sent' && openedCount && openedCount > 0"
      class="absolute w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-800 pointer-events-none z-10"
      :class="binding ? '-bottom-0.5 -left-0.5' : '-bottom-0.5 -right-0.5'"
      title="Opened by recipient"
    ></span>
    <span
      v-else-if="folder === 'sent' && clickedCount && clickedCount > 0"
      class="absolute w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800 pointer-events-none z-10"
      :class="binding ? '-bottom-0.5 -left-0.5' : '-bottom-0.5 -right-0.5'"
      title="Links clicked"
    ></span>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from "vue";
import { extractCleanEmail, useAppBindingsStore } from "@/stores/appBindings";
import type { AppPlatform } from "@/types";

const props = withDefaults(
	defineProps<{
		email?: string | null;
		initial?: string;
		size?: "sm" | "md" | "lg";
		folder?: string;
		openedCount?: number;
		clickedCount?: number;
	}>(),
	{
		size: "md",
		folder: "",
		openedCount: 0,
		clickedCount: 0,
	},
);

const appBindingsStore = useAppBindingsStore();

const cleanEmail = computed(() => extractCleanEmail(props.email));

const binding = computed(() => {
	if (!cleanEmail.value) return null;
	return appBindingsStore.getBinding(cleanEmail.value);
});

const displayInitial = computed(() => {
	if (props.initial) return props.initial.toUpperCase();
	if (props.email) {
		const raw = props.email.replace(/<[^>]+>/, "").trim();
		return (raw.charAt(0) || "?").toUpperCase();
	}
	return "?";
});

const containerSizeClasses = computed(() => {
	switch (props.size) {
		case "sm":
			return "w-8 h-8";
		case "lg":
			return "w-12 h-12";
		case "md":
		default:
			return "w-9 h-9";
	}
});

const textSizeClasses = computed(() => {
	switch (props.size) {
		case "sm":
			return "text-[11px]";
		case "lg":
			return "text-lg";
		case "md":
		default:
			return "text-xs";
	}
});

const badgeSizeClasses = computed(() => {
	switch (props.size) {
		case "sm":
			return "w-3.5 h-3.5";
		case "lg":
			return "w-4.5 h-4.5 p-0.5";
		case "md":
		default:
			return "w-4 h-4 p-0.5";
	}
});

// Platform icons
const PlayIcon = () =>
	h("svg", { class: "w-full h-full", viewBox: "0 0 24 24", fill: "currentColor" }, [
		h("path", { d: "M3.609 1.814L13.792 12 3.61 22.186a2.03 2.03 0 01-.61-1.467V3.28c0-.573.225-1.096.609-1.466zM15.206 13.414l2.457-2.457a1.99 1.99 0 000-2.814l-2.457-2.457-3.007 3.007 3.007 2.921zM4.75 23.327l9.043-9.043 2.127 2.127-9.704 5.539a1.97 1.97 0 01-1.466.377zM4.75.673a1.97 1.97 0 011.466.377l9.704 5.539-2.127 2.127L4.75.673z" }),
	]);

const AppleIcon = () =>
	h("svg", { class: "w-full h-full", viewBox: "0 0 24 24", fill: "currentColor" }, [
		h("path", { d: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.79 1.06-1.88.94-2.97-.93.04-2.03.62-2.68 1.41-.57.66-.99 1.77-.85 2.84 1.03.08 2.05-.53 2.59-1.28z" }),
	]);

const WebIcon = () =>
	h("svg", { class: "w-full h-full", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, [
		h("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" }),
	]);

const getPlatformIcon = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore":
			return PlayIcon;
		case "appstore":
			return AppleIcon;
		case "website":
			return WebIcon;
	}
};

const formatPlatform = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore":
			return "Google Play";
		case "appstore":
			return "App Store";
		case "website":
			return "Official Website";
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

const openLinkModal = () => {
	if (!cleanEmail.value) return;
	appBindingsStore.openLinkModal(cleanEmail.value, null);
};

const openEditModal = () => {
	if (!cleanEmail.value) return;
	appBindingsStore.openLinkModal(cleanEmail.value, binding.value);
};
</script>
