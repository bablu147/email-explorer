<template>
  <div class="recipient-input-wrapper relative">
    <div 
      class="flex items-center flex-wrap gap-1.5 min-h-[38px] p-1.5 bg-gray-50 dark:bg-gray-900/50 border rounded-xl transition-all"
      :class="[
        isFocused ? 'ring-2 ring-emerald-500 border-transparent bg-white dark:bg-gray-900' : 'border-gray-300 dark:border-gray-600',
        hasInvalidChips ? 'border-amber-400 dark:border-amber-500' : ''
      ]"
      @click="focusInput"
    >
      <!-- Tokenized Chips -->
      <div 
        v-for="(email, idx) in chipList" 
        :key="email + idx"
        class="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded-lg text-xs font-medium transition-all group select-none"
        :class="[
          isValidEmail(email)
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-xs'
            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-600'
        ]"
      >
        <!-- Mini Avatar / Initial -->
        <span 
          class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
          :class="isValidEmail(email) ? 'bg-emerald-600' : 'bg-amber-500'"
        >
          {{ getInitial(email) }}
        </span>

        <!-- Email text -->
        <span class="truncate max-w-[180px] sm:max-w-[240px]">{{ email }}</span>

        <!-- Linked App Pill (if recognized) -->
        <span 
          v-if="getLinkedApp(email)" 
          class="inline-flex items-center text-emerald-600 dark:text-emerald-400"
          :title="`Linked: ${getLinkedApp(email)?.app_name}`"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        </span>

        <!-- Remove button -->
        <button
          type="button"
          @click.stop="removeChip(idx)"
          class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded p-0.5 transition-colors cursor-pointer"
          title="Remove recipient"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Live Typing Input -->
      <div class="flex-1 min-w-[140px] relative">
        <input
          ref="inputRef"
          type="text"
          v-model="query"
          :placeholder="chipList.length === 0 ? placeholder : ''"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown="handleKeyDown"
          @paste="handlePaste"
          class="w-full bg-transparent text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none border-none py-1 px-1"
        />
      </div>
    </div>

    <!-- Autocomplete Suggestions Dropdown -->
    <div
      v-if="showDropdown && filteredSuggestions.length > 0"
      class="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto py-1"
    >
      <div class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700/60">
        Suggested Contacts & Leads
      </div>
      <div
        v-for="(item, sIdx) in filteredSuggestions"
        :key="item.email + sIdx"
        @mousedown.prevent="selectSuggestion(item.email)"
        class="px-3 py-2 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors"
        :class="highlightedIndex === sIdx ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200' : 'hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300'"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-[10px] text-gray-600 dark:text-gray-300 flex-shrink-0">
            {{ (item.name || item.email)[0].toUpperCase() }}
          </div>
          <div class="min-w-0">
            <div class="font-bold text-gray-900 dark:text-white truncate">
              {{ item.name || item.email.split('@')[0] }}
            </div>
            <div class="text-[11px] text-gray-400 truncate">
              {{ item.email }}
            </div>
          </div>
        </div>

        <!-- Source / App Badge -->
        <span 
          v-if="item.appName" 
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 truncate max-w-[120px]"
        >
          <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          <span class="truncate">{{ item.appName }}</span>
        </span>
        <span 
          v-else-if="item.source" 
          class="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
        >
          {{ item.source }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useAppBindingsStore } from "@/stores/appBindings";
import { useContactStore } from "@/stores/contacts";
import { useDiscoverStore } from "@/stores/discover";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
  }>(),
  {
    placeholder: "recipient@example.com (press Enter or Comma)",
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const contactStore = useContactStore();
const discoverStore = useDiscoverStore();
const appBindingsStore = useAppBindingsStore();

const query = ref("");
const isFocused = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const highlightedIndex = ref(0);

// Convert comma/semicolon-separated modelValue to array of chips
const chipList = computed(() => {
  if (!props.modelValue || !props.modelValue.trim()) return [];
  return props.modelValue
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
});

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const hasInvalidChips = computed(() => {
  return chipList.value.some((email) => !isValidEmail(email));
});

const getInitial = (email: string): string => {
  const clean = email.replace(/^[^a-zA-Z0-9]+/, "");
  return (clean[0] || "?").toUpperCase();
};

const getLinkedApp = (email: string) => {
  return appBindingsStore.getBinding(email);
};

const focusInput = () => {
  inputRef.value?.focus();
};

const handleFocus = () => {
  isFocused.value = true;
};

const handleBlur = () => {
  isFocused.value = false;
  // If there's uncommitted text in the input that has '@', commit it
  if (query.value.trim() && query.value.includes("@")) {
    addChip(query.value.trim());
  }
};

const emitChips = (list: string[]) => {
  emit("update:modelValue", list.join(", "));
};

const addChip = (raw: string) => {
  const clean = raw.replace(/^["'<]|["'>]$/g, "").trim();
  if (!clean) return;
  if (!chipList.value.includes(clean)) {
    emitChips([...chipList.value, clean]);
  }
  query.value = "";
  highlightedIndex.value = 0;
};

const removeChip = (index: number) => {
  const next = [...chipList.value];
  next.splice(index, 1);
  emitChips(next);
};

// Autocomplete suggestions list
interface SuggestionItem {
  name: string;
  email: string;
  appName?: string;
  source: string;
}

const allSuggestions = computed<SuggestionItem[]>(() => {
  const map = new Map<string, SuggestionItem>();

  // 1. From contacts store
  for (const c of contactStore.contacts) {
    if (c.email) {
      map.set(c.email.toLowerCase(), {
        name: c.name,
        email: c.email,
        source: "Contact",
      });
    }
  }

  // 2. From discover store leads
  for (const lead of discoverStore.leads) {
    if (lead.developer_email) {
      const emailLower = lead.developer_email.toLowerCase();
      if (!map.has(emailLower)) {
        map.set(emailLower, {
          name: lead.developer_name || lead.app_name,
          email: lead.developer_email,
          appName: lead.app_name,
          source: "App Lead",
        });
      }
    }
  }

  // 3. From app bindings store
  for (const b of appBindingsStore.bindings) {
    if (b.email) {
      const emailLower = b.email.toLowerCase();
      if (!map.has(emailLower)) {
        map.set(emailLower, {
          name: b.developer_name || b.app_name,
          email: b.email,
          appName: b.app_name,
          source: "Linked App",
        });
      }
    }
  }

  return Array.from(map.values());
});

const filteredSuggestions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return allSuggestions.value
    .filter(
      (s) =>
        !chipList.value.includes(s.email) &&
        (s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    )
    .slice(0, 6);
});

const showDropdown = computed(() => {
  return isFocused.value && query.value.trim().length > 0 && filteredSuggestions.value.length > 0;
});

const selectSuggestion = (email: string) => {
  addChip(email);
  nextTick(() => {
    inputRef.value?.focus();
  });
};

const handleKeyDown = (e: KeyboardEvent) => {
  // Navigation in suggestions dropdown
  if (showDropdown.value) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedIndex.value = (highlightedIndex.value + 1) % filteredSuggestions.value.length;
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex.value =
        (highlightedIndex.value - 1 + filteredSuggestions.value.length) %
        filteredSuggestions.value.length;
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      if (filteredSuggestions.value[highlightedIndex.value]) {
        e.preventDefault();
        selectSuggestion(filteredSuggestions.value[highlightedIndex.value].email);
        return;
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      query.value = "";
      return;
    }
  }

  // Add chip on Enter, Comma, Tab, or Space
  if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
    if (query.value.trim()) {
      e.preventDefault();
      addChip(query.value.trim());
    }
  }

  // Backspace on empty input removes last chip
  if (e.key === "Backspace" && !query.value && chipList.value.length > 0) {
    removeChip(chipList.value.length - 1);
  }
};

const handlePaste = (e: ClipboardEvent) => {
  const pasted = e.clipboardData?.getData("text") || "";
  if (pasted.includes(",") || pasted.includes(";") || pasted.includes("\n")) {
    e.preventDefault();
    const emails = pasted
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const combined = [...chipList.value];
    for (const em of emails) {
      if (!combined.includes(em)) {
        combined.push(em);
      }
    }
    emitChips(combined);
    query.value = "";
  }
};
</script>
