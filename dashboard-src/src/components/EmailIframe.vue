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
        class="text-[11px] font-semibold text-gray-400 hover:text-gray-200 bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1 cursor-pointer"
        :title="forceLight ? 'Restore dark theme' : 'View email with original light background'"
      >
        <span>{{ forceLight ? '🌙 Dark Mode' : '☀️ Original Light' }}</span>
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

const props = defineProps<{
	body: string;
}>();

const iframe = ref<HTMLIFrameElement | null>(null);
const iframeHeight = ref(420);
const forceLight = ref(false);

const isDarkTheme = computed(() => {
	if (forceLight.value) return false;
	if (typeof document === "undefined") return false;
	return (
		document.documentElement.classList.contains("dark") ||
		document.documentElement.getAttribute("data-theme") === "dark"
	);
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
			const bgColor = isDark ? "#0f172a" : "#ffffff";
			const textColor = isDark ? "#e2e8f0" : "#1e293b";
			const linkColor = isDark ? "#38bdf8" : "#0284c7";
			const quoteBorder = isDark ? "#334155" : "#cbd5e1";
			const quoteColor = isDark ? "#94a3b8" : "#64748b";

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
                background: ${isDark ? "#1e293b" : "#f1f5f9"};
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
