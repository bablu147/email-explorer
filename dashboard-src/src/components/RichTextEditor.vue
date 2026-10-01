<template>
  <div class="rich-text-editor border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900/50 flex flex-col">
    <!-- Toolbar -->
    <div v-if="editor" class="toolbar bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 p-2 flex flex-wrap items-center justify-between gap-1">
      <div class="flex flex-wrap items-center gap-1">
        <!-- Text Formatting (Enabled in Visual mode) -->
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
          <button
            type="button"
            @click="editor.chain().focus().toggleBold().run()"
            :class="{ 'is-active': editor.isActive('bold') }"
            class="toolbar-btn"
            title="Bold (Ctrl+B)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
            </svg>
          </button>
          <button
            type="button"
            @click="editor.chain().focus().toggleItalic().run()"
            :class="{ 'is-active': editor.isActive('italic') }"
            class="toolbar-btn"
            title="Italic (Ctrl+I)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 4h4m-4 16h4m-2-16l-2 16" />
            </svg>
          </button>
          <button
            type="button"
            @click="editor.chain().focus().toggleUnderline().run()"
            :class="{ 'is-active': editor.isActive('underline') }"
            class="toolbar-btn"
            title="Underline (Ctrl+U)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20h10M7 4v7a5 5 0 0010 0V4" />
            </svg>
          </button>
          <button
            type="button"
            @click="editor.chain().focus().toggleStrike().run()"
            :class="{ 'is-active': editor.isActive('strike') }"
            class="toolbar-btn"
            title="Strikethrough"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h18M8 5h8M9 19h6" />
            </svg>
          </button>
        </div>

        <!-- Headings -->
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
          <button
            type="button"
            @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
            :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }"
            class="toolbar-btn text-xs font-bold"
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
            :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
            class="toolbar-btn text-xs font-bold"
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
            :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }"
            class="toolbar-btn text-xs font-bold"
            title="Heading 3"
          >
            H3
          </button>
        </div>

        <!-- Lists -->
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
          <button
            type="button"
            @click="editor.chain().focus().toggleBulletList().run()"
            :class="{ 'is-active': editor.isActive('bulletList') }"
            class="toolbar-btn"
            title="Bullet List"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            @click="editor.chain().focus().toggleOrderedList().run()"
            :class="{ 'is-active': editor.isActive('orderedList') }"
            class="toolbar-btn"
            title="Numbered List"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h10M7 12h10M7 17h10M3 7v10" />
            </svg>
          </button>
        </div>

        <!-- Alignment -->
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
          <button
            type="button"
            @click="editor.chain().focus().setTextAlign('left').run()"
            :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }"
            class="toolbar-btn"
            title="Align Left"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            @click="editor.chain().focus().setTextAlign('center').run()"
            :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }"
            class="toolbar-btn"
            title="Align Center"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            @click="editor.chain().focus().setTextAlign('right').run()"
            :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }"
            class="toolbar-btn"
            title="Align Right"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M10 12h10M4 18h16" />
            </svg>
          </button>
        </div>

        <!-- Quote, Code, Link -->
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
          <button
            type="button"
            @click="editor.chain().focus().toggleBlockquote().run()"
            :class="{ 'is-active': editor.isActive('blockquote') }"
            class="toolbar-btn"
            title="Blockquote"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button
            type="button"
            @click="editor.chain().focus().toggleCodeBlock().run()"
            :class="{ 'is-active': editor.isActive('codeBlock') }"
            class="toolbar-btn"
            title="Code Block"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            type="button"
            @click="setLink"
            :class="{ 'is-active': editor.isActive('link') }"
            class="toolbar-btn"
            title="Insert Link"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        </div>

        <!-- 📷 Image Insertion (Upload from PC, Paste, or URL) -->
        <div v-if="viewMode === 'visual'" class="relative flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
          <input
            type="file"
            ref="fileInput"
            @change="handleFileUpload"
            accept="image/*"
            class="hidden"
          />
          <button
            type="button"
            @click="showImageMenu = !showImageMenu"
            class="toolbar-btn flex items-center gap-1"
            title="Insert or Upload Image"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="text-xs font-semibold">Image</span>
          </button>

          <!-- Image Menu Dropdown -->
          <div
            v-if="showImageMenu"
            class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 py-1"
          >
            <button
              type="button"
              @click="triggerImageUpload"
              class="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload from computer
            </button>
            <button
              type="button"
              @click="promptImageUrl"
              class="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Insert from web URL
            </button>
          </div>
        </div>

        <!-- Text Colors & Utilities -->
        <div v-if="viewMode === 'visual'" class="flex gap-1">
          <button
            type="button"
            @click="editor.chain().focus().undo().run()"
            :disabled="!editor.can().undo()"
            class="toolbar-btn"
            title="Undo"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            type="button"
            @click="editor.chain().focus().redo().run()"
            :disabled="!editor.can().redo()"
            class="toolbar-btn"
            title="Redo"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 👁️ View Mode Switcher: Visual · HTML Source · Live Split Preview -->
      <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-lg border border-gray-200 dark:border-gray-600">
        <button
          type="button"
          @click="setViewMode('visual')"
          :class="viewMode === 'visual' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
          class="px-2.5 py-1 text-xs rounded transition-all flex items-center gap-1.5"
          title="Rich Text Visual Editor"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Visual
        </button>

        <button
          type="button"
          @click="setViewMode('code')"
          :class="viewMode === 'code' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
          class="px-2.5 py-1 text-xs rounded transition-all flex items-center gap-1.5"
          title="HTML Source Code Editor"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          HTML Code
        </button>

        <button
          type="button"
          @click="setViewMode('split')"
          :class="viewMode === 'split' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
          class="px-2.5 py-1 text-xs rounded transition-all flex items-center gap-1.5"
          title="Side-by-side Code and Live Preview"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          Live Preview
        </button>
      </div>
    </div>

    <!-- Editor Body Containers -->
    <!-- 1. Visual Mode (TipTap) -->
    <div
      v-if="viewMode === 'visual'"
      @paste="handlePaste"
      @drop.prevent="handleDrop"
      @dragover.prevent
      class="editor-dropzone relative flex-grow min-h-[260px] cursor-text"
    >
      <editor-content :editor="editor" class="prose prose-sm max-w-none p-4 text-gray-900 dark:text-gray-100" />
      <div v-if="isDragging" class="absolute inset-0 bg-emerald-500/10 border-2 border-dashed border-emerald-500 rounded-lg flex items-center justify-center pointer-events-none">
        <span class="text-emerald-600 dark:text-emerald-400 font-bold text-sm bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow">Drop image to insert</span>
      </div>
    </div>

    <!-- 2. HTML Code Mode -->
    <div v-else-if="viewMode === 'code'" class="p-3 flex-grow flex flex-col min-h-[260px]">
      <div class="flex items-center justify-between text-xs text-gray-500 mb-1.5 px-1">
        <span>Edit raw HTML markup. Changes synchronize to the visual editor.</span>
        <span>HTML Mode</span>
      </div>
      <textarea
        v-model="sourceCode"
        @input="updateFromSource"
        class="w-full flex-grow min-h-[240px] bg-gray-900 text-gray-100 font-mono text-xs p-3.5 rounded-lg border border-gray-700 focus:outline-none focus:border-emerald-500 resize-y"
        placeholder="Enter HTML markup here..."
      />
    </div>

    <!-- 3. Split View (Live Code on Left, Live Rendered Email Preview on Right) -->
    <div v-else-if="viewMode === 'split'" class="flex-grow flex flex-col min-h-[380px]">
      <!-- Split View Header Controls -->
      <div class="bg-gray-100 dark:bg-gray-800/80 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-gray-700 dark:text-gray-300">HTML Source & Live Preview</span>
          <span class="text-[11px] text-gray-500">Live synced</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">Device Simulator:</span>
          <div class="flex bg-gray-200 dark:bg-gray-700 rounded p-0.5">
            <button
              type="button"
              @click="previewDevice = 'desktop'"
              :class="previewDevice === 'desktop' ? 'bg-white dark:bg-gray-800 text-emerald-500 font-bold' : 'text-gray-500'"
              class="px-2 py-0.5 text-xs rounded transition-all"
            >
              Desktop
            </button>
            <button
              type="button"
              @click="previewDevice = 'mobile'"
              :class="previewDevice === 'mobile' ? 'bg-white dark:bg-gray-800 text-emerald-500 font-bold' : 'text-gray-500'"
              class="px-2 py-0.5 text-xs rounded transition-all"
            >
              Mobile (375px)
            </button>
          </div>
        </div>
      </div>

      <!-- Split Panes -->
      <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700 flex-grow min-h-[340px]">
        <!-- Code Editor Pane -->
        <div class="p-2 flex flex-col bg-gray-950">
          <textarea
            v-model="sourceCode"
            @input="updateFromSource"
            class="w-full flex-grow bg-transparent text-emerald-300 font-mono text-xs p-2 focus:outline-none resize-none leading-relaxed"
            placeholder="Type HTML here..."
          />
        </div>

        <!-- Live Sandboxed Rendered Preview Pane -->
        <div class="p-3 flex flex-col items-center justify-start bg-gray-200 dark:bg-gray-900/80 overflow-y-auto">
          <div
            :style="{ width: previewDevice === 'mobile' ? '375px' : '100%', maxWidth: '100%' }"
            class="bg-white text-gray-900 rounded-lg shadow-md border border-gray-300 overflow-hidden transition-all duration-300 min-h-[300px] flex flex-col"
          >
            <div class="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex items-center justify-between text-[11px] text-gray-500">
              <span>Preview (Recipient view)</span>
              <span class="font-mono">{{ previewDevice === 'mobile' ? '375px' : '100%' }}</span>
            </div>
            <iframe
              :srcdoc="previewHtml"
              sandbox="allow-same-origin"
              class="w-full flex-grow min-h-[280px] border-none bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
	modelValue: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
}>();

const viewMode = ref<"visual" | "code" | "split">("visual");
const previewDevice = ref<"desktop" | "mobile">("desktop");
const sourceCode = ref(props.modelValue || "");
const showImageMenu = ref(false);
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const editor = useEditor({
	extensions: [
		StarterKit,
		Underline,
		TextAlign.configure({
			types: ["heading", "paragraph"],
		}),
		Link.configure({
			openOnClick: false,
			HTMLAttributes: {
				class: "text-blue-600 underline hover:text-blue-800",
			},
		}),
		Image.configure({
			inline: true,
			allowBase64: true,
			HTMLAttributes: {
				class: "max-w-full h-auto rounded-lg shadow-sm my-2",
			},
		}),
		TextStyle,
		Color,
		Highlight.configure({
			multicolor: true,
		}),
	],
	content: props.modelValue,
	editorProps: {
		attributes: {
			class: "prose prose-sm max-w-none focus:outline-none min-h-[220px]",
		},
	},
	onUpdate: ({ editor }) => {
		const html = editor.getHTML();
		sourceCode.value = html;
		emit("update:modelValue", html);
	},
});

// Watch for external modelValue updates
watch(
	() => props.modelValue,
	(newValue) => {
		if (editor.value && newValue !== editor.value.getHTML()) {
			editor.value.commands.setContent(newValue, { emitUpdate: false });
			sourceCode.value = newValue;
		}
	},
);

const setViewMode = (mode: "visual" | "code" | "split") => {
	viewMode.value = mode;
	if (mode === "code" || mode === "split") {
		sourceCode.value = editor.value?.getHTML() || props.modelValue || "";
	} else if (mode === "visual") {
		if (editor.value && sourceCode.value !== editor.value.getHTML()) {
			editor.value.commands.setContent(sourceCode.value);
		}
	}
};

const updateFromSource = () => {
	emit("update:modelValue", sourceCode.value);
	if (editor.value) {
		editor.value.commands.setContent(sourceCode.value, { emitUpdate: false });
	}
};

// Clean preview HTML template with safe styling
const previewHtml = computed(() => {
	const content = sourceCode.value || "<p style='color:#888;'>No content</p>";
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 16px;
      color: #111827;
      background-color: #ffffff;
      line-height: 1.6;
    }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    blockquote { border-left: 3px solid #d1d5db; padding-left: 12px; margin: 12px 0; color: #4b5563; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
    code { font-family: monospace; background: #e5e7eb; padding: 2px 4px; border-radius: 4px; }
    a { color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    td, th { border: 1px solid #e5e7eb; padding: 8px; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
});

// Image Upload Actions
const triggerImageUpload = () => {
	showImageMenu.value = false;
	fileInput.value?.click();
};

const handleFileUpload = (e: Event) => {
	const target = e.target as HTMLInputElement;
	const file = target.files?.[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = (event) => {
		const base64Url = event.target?.result as string;
		if (base64Url && editor.value) {
			editor.value.chain().focus().setImage({ src: base64Url, alt: file.name }).run();
		}
	};
	reader.readAsDataURL(file);
	target.value = ""; // reset
};

const promptImageUrl = () => {
	showImageMenu.value = false;
	const url = window.prompt("Enter image URL:");
	if (url && editor.value) {
		editor.value.chain().focus().setImage({ src: url }).run();
	}
};

// Clipboard Paste (Auto-upload screenshots)
const handlePaste = (e: ClipboardEvent) => {
	const items = e.clipboardData?.items;
	if (!items) return;

	for (const item of items) {
		if (item.type.startsWith("image/")) {
			e.preventDefault();
			const file = item.getAsFile();
			if (!file) continue;

			const reader = new FileReader();
			reader.onload = (event) => {
				const base64Url = event.target?.result as string;
				if (base64Url && editor.value) {
					editor.value.chain().focus().setImage({ src: base64Url, alt: "Pasted image" }).run();
				}
			};
			reader.readAsDataURL(file);
		}
	}
};

// Drag and drop image
const handleDrop = (e: DragEvent) => {
	isDragging.value = false;
	const files = e.dataTransfer?.files;
	if (!files || files.length === 0) return;

	const file = files[0];
	if (file.type.startsWith("image/")) {
		const reader = new FileReader();
		reader.onload = (event) => {
			const base64Url = event.target?.result as string;
			if (base64Url && editor.value) {
				editor.value.chain().focus().setImage({ src: base64Url, alt: file.name }).run();
			}
		};
		reader.readAsDataURL(file);
	}
};

// Link insertion
const setLink = () => {
	const previousUrl = editor.value?.getAttributes("link").href;
	const url = window.prompt("URL", previousUrl);

	if (url === null) return;
	if (url === "") {
		editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
		return;
	}

	editor.value?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
};

const handleClickOutside = (event: MouseEvent) => {
	const target = event.target as HTMLElement;
	if (!target.closest(".relative")) {
		showImageMenu.value = false;
	}
};

if (typeof window !== "undefined") {
	window.addEventListener("click", handleClickOutside);
}

onBeforeUnmount(() => {
	editor.value?.destroy();
	if (typeof window !== "undefined") {
		window.removeEventListener("click", handleClickOutside);
	}
});
</script>

<style scoped>
.toolbar-btn {
  padding: 0.4rem 0.5rem;
  border-radius: 0.375rem;
  color: rgb(75 85 99);
  transition: all 120ms;
}

.toolbar-btn:hover {
  background-color: rgb(243 244 246);
  color: rgb(17 24 39);
}

.toolbar-btn.is-active {
  background-color: rgba(78, 212, 155, 0.15);
  color: #0F8C5E;
}

@media (prefers-color-scheme: dark) {
  .toolbar-btn {
    color: rgb(156 163 175);
  }
  .toolbar-btn:hover {
    background-color: rgb(31 41 55);
    color: rgb(243 244 246);
  }
  .toolbar-btn.is-active {
    background-color: rgba(78, 212, 155, 0.2);
    color: #4ED49B;
  }
}

:deep(.ProseMirror) {
  outline: none;
  min-height: 220px;
}

:deep(.ProseMirror p) {
  margin-bottom: 0.65rem;
}

:deep(.ProseMirror img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 0.5rem 0;
  display: inline-block;
}
</style>
