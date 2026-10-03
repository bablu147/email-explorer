<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
	show: boolean;
	recipientLabel?: string;
}>();

const emit = defineEmits<{
	(e: "close"): void;
	(e: "schedule", isoString: string): void;
}>();

const customDate = ref("");
const isCustomMode = ref(false);

const formatDisplayTime = (d: Date) => {
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};

const presets = computed(() => {
	const current = new Date();
	const list = [];

	// 1. Tomorrow morning (9:00 AM)
	const tomorrow = new Date(current);
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setHours(9, 0, 0, 0);
	list.push({
		id: "tomorrow_morning",
		label: "Tomorrow morning",
		date: tomorrow,
		display: formatDisplayTime(tomorrow),
	});

	// 2. Tomorrow afternoon (2:00 PM)
	const tomorrowAft = new Date(current);
	tomorrowAft.setDate(tomorrowAft.getDate() + 1);
	tomorrowAft.setHours(14, 0, 0, 0);
	list.push({
		id: "tomorrow_afternoon",
		label: "Tomorrow afternoon",
		date: tomorrowAft,
		display: formatDisplayTime(tomorrowAft),
	});

	// 3. Monday morning (9:00 AM)
	const dayOfWeek = current.getDay();
	const daysUntilMon = (1 - dayOfWeek + 7) % 7 || 7;
	const monday = new Date(current);
	monday.setDate(monday.getDate() + daysUntilMon);
	monday.setHours(9, 0, 0, 0);
	list.push({
		id: "monday_morning",
		label: "Monday morning",
		date: monday,
		display: formatDisplayTime(monday),
	});

	return list;
});

const selectPreset = (d: Date) => {
	emit("schedule", d.toISOString());
};

const submitCustom = () => {
	if (!customDate.value) return;
	const d = new Date(customDate.value);
	if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now() + 30000) return;
	emit("schedule", d.toISOString());
};
</script>

<template>
  <div 
    v-if="show" 
    class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[80] p-4"
    @click.self="emit('close')"
  >
    <div 
      class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-150 select-none"
    >
      <div class="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700/60">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Schedule send</h3>
            <p v-if="recipientLabel" class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
              To {{ recipientLabel }}
            </p>
          </div>
        </div>
        <button 
          type="button" 
          @click="emit('close')" 
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div v-if="!isCustomMode" class="space-y-1">
        <button
          v-for="p in presets"
          :key="p.id"
          type="button"
          @click="selectPreset(p.date)"
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left transition-colors cursor-pointer group"
        >
          <span class="text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
            {{ p.label }}
          </span>
          <span class="text-[11px] text-gray-500 dark:text-gray-400">
            {{ p.display }}
          </span>
        </button>

        <button
          type="button"
          @click="isCustomMode = true"
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left transition-colors cursor-pointer group border-t border-gray-100 dark:border-gray-700/40 mt-1 pt-2.5"
        >
          <span class="text-xs font-semibold text-purple-600 dark:text-purple-400">
            Pick date & time…
          </span>
          <svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div v-else class="space-y-3 pt-1">
        <div>
          <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Choose delivery time
          </label>
          <input
            v-model="customDate"
            type="datetime-local"
            class="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            @click="isCustomMode = false"
            class="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            :disabled="!customDate"
            @click="submitCustom"
            class="px-4 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
