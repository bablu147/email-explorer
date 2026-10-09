<template>
  <div class="rich-text-editor border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900/50 flex flex-col">
    <!-- Tier 1: View Mode Switcher & HTML Delivery Status Header (ALWAYS visible, never clipped) -->
    <div class="bg-gray-100/90 dark:bg-gray-800/90 border-b border-gray-300 dark:border-gray-700 px-2.5 py-1.5 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
      <!-- Mode Tabs -->
      <div class="inline-flex items-center p-0.5 bg-gray-200/90 dark:bg-gray-700/90 rounded-lg gap-0.5">
        <button
          type="button"
          @click="setViewMode('visual')"
          :class="viewMode === 'visual' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'"
          class="px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
          title="Rich Text Visual Editor (WYSIWYG)"
        >
          <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Visual</span>
        </button>

        <button
          type="button"
          @click="setViewMode('code')"
          :class="viewMode === 'code' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'"
          class="px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
          title="HTML Source Code Editor (Type or paste raw HTML, tables & newsletters)"
        >
          <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span>&lt;/&gt; HTML Code</span>
        </button>

        <button
          type="button"
          @click="setViewMode('split')"
          :class="viewMode === 'split' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'"
          class="px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
          title="Side-by-side Code and Live Rendered Preview"
        >
          <svg class="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <span>Live Preview</span>
        </button>
      </div>

      <!-- Right Side Helpers & HTML Badge -->
      <div class="flex items-center gap-2">
        <!-- Visual Mode: Clear HTML badge -->
        <span v-if="viewMode === 'visual'" class="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
          <svg class="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>Sends as HTML email</span>
        </span>

        <!-- Code/Split Mode: Quick HTML Tools -->
        <div v-if="viewMode === 'code' || viewMode === 'split'" class="flex items-center gap-1.5">
          <input
            type="file"
            ref="htmlFileInput"
            @change="handleHtmlFileUpload"
            accept=".html,.htm"
            class="hidden"
          />
          <button
            type="button"
            @click="htmlFileInput?.click()"
            class="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Import an HTML email template file (.html)"
          >
            <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Import .html</span>
          </button>

          <button
            type="button"
            @click="prettifyHtmlCode"
            class="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Format and auto-indent HTML markup"
          >
            <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            <span>Format</span>
          </button>

          <!-- Quick Template Snippet Dropdown -->
          <div class="relative" ref="snippetDropdownRef">
            <button
              type="button"
              @click.stop="showSnippetMenu = !showSnippetMenu"
              class="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Insert HTML email elements"
            >
              <span>+ Insert HTML</span>
              <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-180': showSnippetMenu }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              v-if="showSnippetMenu"
              class="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-30 py-1 text-xs"
            >
              <button
                type="button"
                @click="insertHtmlSnippet('button')"
                class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2 cursor-pointer"
              >
                CTA Button
              </button>
              <button
                type="button"
                @click="insertHtmlSnippet('table')"
                class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2 cursor-pointer"
              >
                Responsive Table
              </button>
              <button
                type="button"
                @click="insertHtmlSnippet('callout')"
                class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2 cursor-pointer"
              >
                Callout Box
              </button>
              <button
                type="button"
                @click="insertHtmlSnippet('divider')"
                class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2 cursor-pointer"
              >
                Styled Divider
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tier 2: Formatting Toolbar (Visible in Visual Mode) -->
    <div v-if="editor && viewMode === 'visual'" class="toolbar bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 px-2 py-1.5 flex items-center gap-1 overflow-x-auto touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div class="flex items-center gap-1 shrink-0 flex-nowrap sm:flex-wrap">
        <!-- Text Formatting (Enabled in Visual mode) -->
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-1.5 sm:pr-2 shrink-0">
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
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-1.5 sm:pr-2 shrink-0">
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
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-1.5 sm:pr-2 shrink-0">
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
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-1.5 sm:pr-2 shrink-0">
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
        <div v-if="viewMode === 'visual'" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-1.5 sm:pr-2 shrink-0">
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

        <!-- Image Insertion (Upload from PC, Paste, or URL) -->
        <div v-if="viewMode === 'visual'" class="relative flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-1.5 sm:pr-2 shrink-0">
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
        <div v-if="viewMode === 'visual'" class="flex gap-1 shrink-0">
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
      <!-- Floating Image Controls Toolbar -->
      <div 
        v-if="selectedImgElement" 
        class="absolute top-2 right-2 z-20 flex items-center gap-1.5 p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg text-xs"
      >
        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Size</span>
        <button
          type="button"
          @click="resizeSelectedImage('25%')"
          class="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
        >
          25%
        </button>
        <button
          type="button"
          @click="resizeSelectedImage('50%')"
          class="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
        >
          50%
        </button>
        <button
          type="button"
          @click="resizeSelectedImage('100%')"
          class="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
        >
          100%
        </button>
        <div class="h-3 w-px bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
        <button
          type="button"
          @click="removeSelectedImage"
          class="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
          title="Remove image"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

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
        class="w-full flex-grow min-h-[240px] bg-gray-900 text-gray-100 font-mono text-base sm:text-xs p-3.5 rounded-lg border border-gray-700 focus:outline-none focus:border-emerald-500 resize-y"
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

    <!-- Custom URL Input Modal (Eliminating window.prompt) -->
    <Teleport to="body">
      <div 
        v-if="isUrlModalOpen" 
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        @click.self="isUrlModalOpen = false"
        @keydown.esc="isUrlModalOpen = false"
      >
        <div class="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-gray-900 dark:text-white">
              {{ urlModalType === 'image' ? 'Insert Image URL' : 'Insert Link' }}
            </h3>
            <button 
              type="button" 
              @click="isUrlModalOpen = false"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <form @submit.prevent="confirmUrlModal">
            <div class="mb-4">
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {{ urlModalType === 'image' ? 'Direct Image URL (.png, .jpg, .svg)' : 'Web URL' }}
              </label>
              <input
                ref="urlModalInputRef"
                v-model="urlModalInput"
                type="url"
                required
                :placeholder="urlModalType === 'image' ? 'https://example.com/logo.png' : 'https://example.com'"
                class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                @click="isUrlModalOpen = false"
                class="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              >Cancel</button>
              <button
                v-if="urlModalType === 'link' && currentEditingLinkUrl"
                type="button"
                @click="removeLink"
                class="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer mr-auto"
              >Unlink</button>
              <button
                type="submit"
                class="px-3.5 py-1.5 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm cursor-pointer"
              >
                {{ urlModalType === 'image' ? 'Insert Image' : 'Save Link' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
	modelValue: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
	"inline-image-added": [attachment: any];
}>();

const viewMode = ref<"visual" | "code" | "split">("visual");
const previewDevice = ref<"desktop" | "mobile">("desktop");
const sourceCode = ref(props.modelValue || "");
const showImageMenu = ref(false);
const showSnippetMenu = ref(false);
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const htmlFileInput = ref<HTMLInputElement | null>(null);

// Modal state for links and image URLs
const isUrlModalOpen = ref(false);
const urlModalType = ref<"link" | "image">("link");
const urlModalInput = ref("");
const urlModalInputRef = ref<HTMLInputElement | null>(null);
const currentEditingLinkUrl = ref("");
const selectedImgElement = ref<HTMLImageElement | null>(null);

const resizeSelectedImage = (width: string) => {
	if (!selectedImgElement.value) return;
	selectedImgElement.value.style.width = width;
	selectedImgElement.value.style.maxWidth = "100%";
	selectedImgElement.value.style.height = "auto";
	if (editor.value) {
		const html = editor.value.getHTML();
		sourceCode.value = html;
		emit("update:modelValue", html);
	}
};

const removeSelectedImage = () => {
	if (!selectedImgElement.value) return;
	selectedImgElement.value.remove();
	selectedImgElement.value = null;
	if (editor.value) {
		const html = editor.value.getHTML();
		sourceCode.value = html;
		emit("update:modelValue", html);
	}
};

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
				class: "max-w-full h-auto rounded-lg shadow-sm my-2 cursor-pointer",
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
		handleClick(view, pos, event) {
			const target = event.target as HTMLElement;
			if (target && target.tagName === "IMG") {
				selectedImgElement.value = target as HTMLImageElement;
				return true;
			}
			selectedImgElement.value = null;
			return false;
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
		if (viewMode.value === "visual") {
			if (editor.value && newValue !== editor.value.getHTML()) {
				editor.value.commands.setContent(newValue, { emitUpdate: false });
				sourceCode.value = newValue;
			}
		} else {
			if (newValue !== sourceCode.value) {
				sourceCode.value = newValue;
			}
		}
	},
);

const setViewMode = (mode: "visual" | "code" | "split") => {
	viewMode.value = mode;
	if (mode === "code" || mode === "split") {
		// When entering code or split mode, grab latest HTML from visual editor if available
		if (editor.value) {
			const visualHtml = editor.value.getHTML();
			if (visualHtml && visualHtml !== "<p></p>") {
				sourceCode.value = visualHtml;
			}
		}
		emit("update:modelValue", sourceCode.value);
	} else if (mode === "visual") {
		// When returning to visual mode, populate TipTap with the user's HTML source
		if (editor.value && sourceCode.value !== editor.value.getHTML()) {
			editor.value.commands.setContent(sourceCode.value);
		}
	}
};

const updateFromSource = () => {
	// Directly emit the raw HTML markup so outgoing mail payload receives exact HTML
	emit("update:modelValue", sourceCode.value);
};

const handleHtmlFileUpload = (event: Event) => {
	const target = event.target as HTMLInputElement;
	const file = target.files?.[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = (e) => {
		const content = e.target?.result as string;
		if (content) {
			sourceCode.value = content;
			emit("update:modelValue", content);
			if (viewMode.value === "visual" && editor.value) {
				editor.value.commands.setContent(content);
			}
		}
	};
	reader.readAsText(file);
	target.value = "";
};

const prettifyHtmlCode = () => {
	if (!sourceCode.value) return;
	sourceCode.value = formatHtmlString(sourceCode.value);
	emit("update:modelValue", sourceCode.value);
};

function formatHtmlString(html: string): string {
	let formatted = "";
	let indent = 0;
	const tab = "  ";
	const tokens = html.replace(/>\s*</g, "><").replace(/</g, "~::~<").split("~::~");
	for (const token of tokens) {
		if (!token.trim()) continue;
		if (token.match(/^<\/\w/)) {
			indent = Math.max(0, indent - 1);
		}
		formatted += tab.repeat(indent) + token.trim() + "\n";
		if (token.match(/^<[^!/?][^>]*[^/>]>$/) && !token.match(/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/i)) {
			indent++;
		}
	}
	return formatted.trim();
}

const insertHtmlSnippet = (type: "button" | "table" | "callout" | "divider") => {
	showSnippetMenu.value = false;
	let snippet = "";
	if (type === "button") {
		snippet = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
  <tr>
    <td align="center" style="border-radius: 8px; background-color: #059669;">
      <a href="https://example.com" target="_blank" style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 12px 24px; border: 1px solid #059669; display: inline-block; font-weight: 600;">
        Call to Action &rarr;
      </a>
    </td>
  </tr>
</table>\n`;
	} else if (type === "table") {
		snippet = `<table width="100%" cellpadding="10" cellspacing="0" border="0" style="border-collapse: collapse; margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px;">
  <thead>
    <tr style="background-color: #f3f4f6; text-align: left; color: #374151;">
      <th style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Item</th>
      <th style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Description</th>
      <th style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 10px; border: 1px solid #e5e7eb; color: #111827;">Sample 1</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; color: #4b5563;">Details here</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; color: #059669; font-weight: 600;">Active</td>
    </tr>
  </tbody>
</table>\n`;
	} else if (type === "callout") {
		snippet = `<div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 500;">
    <strong>Notice:</strong> This is a styled highlight box for important announcements.
  </p>
</div>\n`;
	} else if (type === "divider") {
		snippet = `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />\n`;
	}

	sourceCode.value = (sourceCode.value ? sourceCode.value + "\n" : "") + snippet;
	emit("update:modelValue", sourceCode.value);
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

const stageInlineImage = (file: File) => {
	const cid = "img_" + crypto.randomUUID().slice(0, 8);
	const localUrl = URL.createObjectURL(file);

	const reader = new FileReader();
	reader.onload = (event) => {
		const result = event.target?.result as string;
		if (result) {
			const base64Data = result.split(",")[1] || result;
			emit("inline-image-added", {
				filename: file.name || `${cid}.png`,
				content: base64Data,
				type: file.type || "image/png",
				size: file.size,
				disposition: "inline",
				contentId: `<${cid}>`,
				localUrl,
			});

			if (editor.value) {
				editor.value
					.chain()
					.focus()
					.setImage({ src: localUrl, alt: file.name || "Image", title: `cid:${cid}` })
					.run();
			}
		}
	};
	reader.readAsDataURL(file);
};

const handleFileUpload = (e: Event) => {
	const target = e.target as HTMLInputElement;
	const file = target.files?.[0];
	if (!file) return;
	stageInlineImage(file);
	target.value = ""; // reset
};

const promptImageUrl = () => {
	showImageMenu.value = false;
	urlModalType.value = "image";
	urlModalInput.value = "";
	isUrlModalOpen.value = true;
	nextTick(() => {
		urlModalInputRef.value?.focus();
	});
};

// Clipboard Paste (Auto-upload screenshots as inline CID attachments)
const handlePaste = (e: ClipboardEvent) => {
	const items = e.clipboardData?.items;
	if (!items) return;

	for (const item of items) {
		if (item.type.startsWith("image/")) {
			e.preventDefault();
			const file = item.getAsFile();
			if (!file) continue;
			stageInlineImage(file);
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
		stageInlineImage(file);
	}
};

// Link insertion
const setLink = () => {
	urlModalType.value = "link";
	const previousUrl = editor.value?.getAttributes("link").href || "";
	currentEditingLinkUrl.value = previousUrl;
	urlModalInput.value = previousUrl;
	isUrlModalOpen.value = true;
	nextTick(() => {
		urlModalInputRef.value?.focus();
	});
};

const confirmUrlModal = () => {
	const val = urlModalInput.value.trim();
	if (!val) return;
	if (urlModalType.value === "image") {
		editor.value?.chain().focus().setImage({ src: val }).run();
	} else {
		editor.value?.chain().focus().extendMarkRange("link").setLink({ href: val }).run();
	}
	isUrlModalOpen.value = false;
};

const removeLink = () => {
	editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
	isUrlModalOpen.value = false;
};

const handleClickOutside = (event: MouseEvent) => {
	const target = event.target as HTMLElement;
	if (!target.closest(".relative")) {
		showImageMenu.value = false;
		showSnippetMenu.value = false;
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
  min-width: 40px;
  min-height: 40px;
  padding: 0.4rem 0.5rem;
  border-radius: 0.375rem;
  color: rgb(75 85 99);
  transition: all 120ms;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

@media (min-width: 640px) {
  .toolbar-btn {
    min-width: 2rem;
    min-height: 2rem;
    padding: 0.35rem 0.5rem;
  }
}

.toolbar-btn:hover {
  background-color: rgb(243 244 246);
  color: rgb(17 24 39);
}

.toolbar-btn.is-active {
  background-color: rgba(78, 212, 155, 0.15);
  color: #0F8C5E;
}

:global([data-theme="dark"]) .toolbar-btn,
:global(.dark) .toolbar-btn {
  color: rgb(156 163 175);
}

:global([data-theme="dark"]) .toolbar-btn:hover,
:global(.dark) .toolbar-btn:hover {
  background-color: rgb(31 41 55);
  color: rgb(243 244 246);
}

:global([data-theme="dark"]) .toolbar-btn.is-active,
:global(.dark) .toolbar-btn.is-active {
  background-color: rgba(78, 212, 155, 0.2);
  color: #4ED49B;
}

:deep(.ProseMirror) {
  outline: none;
  min-height: 220px;
}

@media (max-width: 639px) {
  :deep(.ProseMirror) {
    font-size: 16px;
  }
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
