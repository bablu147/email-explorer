<template>
  <div class="relative w-full">
    <!-- View Original Light Mode Toggle (when in dark mode) -->
    <div 
      v-if="isDarkTheme" 
      class="flex justify-end mb-2 px-1"
    >
      <button
        type="button"
        @click="forceLight = !forceLight"
        class="text-[11px] font-semibold text-gray-400 hover:text-gray-200 bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer"
        :title="forceLight ? 'Restore dark theme' : 'View email with original light background'"
      >
        <svg v-if="forceLight" class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span>{{ forceLight ? 'Dark Mode' : 'Original Light' }}</span>
      </button>
    </div>

    <iframe
      ref="iframe"
      class="w-full border-0 transition-all rounded-lg overflow-hidden"
      :style="{ minHeight: `${iframeHeight}px`, height: `${iframeHeight}px` }"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      @load="onLoad"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useTheme } from "@/composables/useTheme";

const props = defineProps<{
	body: string;
}>();

const { isDark: appDark } = useTheme();
const iframe = ref<HTMLIFrameElement | null>(null);
const iframeHeight = ref(420);
const forceLight = ref(false);

const isDarkTheme = computed(() => {
	if (forceLight.value) return false;
	return appDark.value;
});

const adjustHeight = () => {
	nextTick(() => {
		if (iframe.value && iframe.value.contentDocument) {
			const doc = iframe.value.contentDocument;
			const scrollHeight = Math.max(
				doc.body.scrollHeight,
				doc.documentElement.scrollHeight,
				300,
			);
			iframeHeight.value = scrollHeight + 24; // Extra padding
		}
	});
};

const updateIframeContent = () => {
	if (iframe.value && props.body) {
		const doc = iframe.value.contentDocument;
		if (doc) {
			const isDark = isDarkTheme.value;
			const bgColor = isDark ? "#0E1117" : "#ffffff";
			const textColor = isDark ? "#E6E8EC" : "#1e293b";
			const linkColor = isDark ? "#4ED49B" : "#0284c7";
			const quoteBorder = isDark ? "#252B36" : "#cbd5e1";
			const quoteColor = isDark ? "#8A92A0" : "#64748b";

			doc.open();
			doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <base target="_blank">
            <style>
              *, *:before, *:after {
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                padding: 16px;
                background-color: ${bgColor};
                color: ${textColor};
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                word-wrap: break-word;
                overflow-wrap: break-word;
              }
              a {
                color: ${linkColor};
                text-decoration: underline;
              }
              img {
                max-width: 100% !important;
                height: auto !important;
                border-radius: 6px;
              }
              blockquote {
                margin: 12px 0;
                padding-left: 12px;
                border-left: 3px solid ${quoteBorder};
                color: ${quoteColor};
              }
              pre, code {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 12px;
                background: ${isDark ? "#161A22" : "#f1f5f9"};
                border-radius: 4px;
                padding: 2px 4px;
              }
              pre code {
                display: block;
                padding: 8px 12px;
                overflow-x: auto;
              }
              table {
                max-width: 100% !important;
                border-collapse: collapse;
              }
            </style>
          </head>
          <body>
            ${props.body}
          </body>
        </html>
      `);
			doc.close();

			// Listen for image load inside iframe to readjust height dynamically
			const images = doc.querySelectorAll("img");
			images.forEach((img) => {
				img.addEventListener("load", adjustHeight);
			});

			adjustHeight();
		}
	}
};

const onLoad = () => {
	updateIframeContent();
};

onMounted(() => {
	updateIframeContent();
});

watch([() => props.body, isDarkTheme], () => {
	updateIframeContent();
});
</script>
