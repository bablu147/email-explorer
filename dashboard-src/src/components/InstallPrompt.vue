<template>
  <div>
    <!-- Floating Install Prompt Banner -->
    <div
      v-if="showBanner && !isInstalled"
      class="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-gray-700/80 flex items-start gap-3.5 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <!-- App Icon -->
      <img
        src="/icons/icon-192.png"
        alt="Reflect Mail"
        class="w-12 h-12 rounded-xl flex-shrink-0 shadow-md border border-emerald-500/30"
      />

      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            Install Reflect Mail
            <span class="text-[10px] font-semibold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full">PWA</span>
          </h3>
          <button
            type="button"
            @click="dismissPrompt"
            class="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Dismiss"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p class="text-xs text-gray-300 mt-1 leading-snug">
          Add to your home screen for faster loading, native gestures, and instant incoming email push alerts.
        </p>

        <div class="flex items-center gap-2 mt-3">
          <button
            type="button"
            @click="handleInstallClick"
            class="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-gray-950 font-bold text-xs rounded-xl shadow-md transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Install App
          </button>

          <button
            type="button"
            @click="dismissPrompt"
            class="px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>

    <!-- iOS Install Instructions Modal -->
    <div
      v-if="showIosModal"
      class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
      @click.self="showIosModal = false"
    >
      <div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="App Icon" class="w-10 h-10 rounded-xl" />
            <div>
              <h4 class="font-bold text-base leading-tight">Install on iOS</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400">Add to Home Screen</p>
            </div>
          </div>
          <button
            type="button"
            @click="showIosModal = false"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-4 text-xs text-gray-600 dark:text-gray-300">
          <div class="flex items-start gap-3 bg-gray-50 dark:bg-gray-700/40 p-3 rounded-2xl">
            <div class="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p class="font-semibold text-gray-900 dark:text-white">Tap the Share button</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Look for the share icon in Safari's bottom toolbar:
              </p>
              <div class="inline-flex items-center gap-1 mt-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                or square with arrow pointing up
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3 bg-gray-50 dark:bg-gray-700/40 p-3 rounded-2xl">
            <div class="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div>
              <p class="font-semibold text-gray-900 dark:text-white">Select "Add to Home Screen"</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Scroll down in the share sheet and tap <strong>Add to Home Screen</strong>.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="showIosModal = false"
          class="w-full mt-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

const deferredPrompt = ref<any>(null);
const isDismissed = ref<boolean>(false);
const showIosModal = ref<boolean>(false);
const isIos = ref<boolean>(false);
const isStandalone = ref<boolean>(false);

const isInstalled = computed(() => isStandalone.value);
const showBanner = computed(() => {
	if (isDismissed.value || isInstalled.value) return false;
	return deferredPrompt.value !== null || isIos.value;
});

onMounted(() => {
	// Check standalone mode
	if (typeof window !== "undefined") {
		const mediaQuery = window.matchMedia("(display-mode: standalone)");
		isStandalone.value =
			mediaQuery.matches ||
			("standalone" in window.navigator &&
				(window.navigator as any).standalone === true);

		// Check dismiss state
		const dismissedAt = localStorage.getItem("reflect_mail_pwa_dismissed");
		if (dismissedAt) {
			const age = Date.now() - parseInt(dismissedAt, 10);
			// Show again after 14 days
			if (age < 14 * 24 * 3600 * 1000) {
				isDismissed.value = true;
			}
		}

		// Detect iOS Safari
		const ua = window.navigator.userAgent.toLowerCase();
		isIos.value =
			/iphone|ipad|ipod/.test(ua) &&
			!/crios|fxios|opios/.test(ua) &&
			!isStandalone.value;

		// Listen for Chrome / Android beforeinstallprompt
		window.addEventListener("beforeinstallprompt", (e: Event) => {
			e.preventDefault();
			deferredPrompt.value = e;
		});

		// Listen for appinstalled event
		window.addEventListener("appinstalled", () => {
			isStandalone.value = true;
			deferredPrompt.value = null;
			localStorage.removeItem("reflect_mail_pwa_dismissed");
		});
	}
});

const handleInstallClick = async () => {
	if (deferredPrompt.value) {
		deferredPrompt.value.prompt();
		const choiceResult = await deferredPrompt.value.userChoice;
		if (choiceResult.outcome === "accepted") {
			isStandalone.value = true;
		}
		deferredPrompt.value = null;
	} else if (isIos.value) {
		showIosModal.value = true;
	}
};

const dismissPrompt = () => {
	isDismissed.value = true;
	localStorage.setItem("reflect_mail_pwa_dismissed", Date.now().toString());
};
</script>
