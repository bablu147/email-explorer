<template>
  <div>
    <!-- Main Compose Modal -->
    <div v-if="isComposeModalOpen" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        @keydown.meta.enter="triggerSendFlow(false)"
        @keydown.ctrl.enter="triggerSendFlow(false)"
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all flex flex-col max-h-[92vh]"
      >
        <!-- Header -->
        <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-900/90 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 class="text-base font-bold text-gray-900 dark:text-white tracking-tight">{{ modalTitle }}</h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="showPreviewModal = true"
              class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Preview full email as recipients will see it"
            >
              <svg class="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
            <button 
              type="button"
              @click="requestCloseModal" 
              class="text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg p-1.5 transition-all cursor-pointer"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="triggerSendFlow(false)" class="p-6 overflow-y-auto flex-grow flex flex-col space-y-4">
          <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-800 dark:text-red-300 px-4 py-2.5 rounded-lg text-sm flex items-start gap-3" role="alert">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <span class="block sm:inline">{{ error }}</span>
          </div>

          <!-- To field with Cc / Bcc expanders & App Linking -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">To</label>
              <div class="flex items-center gap-2 text-xs font-semibold">
                <button
                  type="button"
                  @click="handleOpenLinkAppModal"
                  class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold flex items-center gap-1.5 transition-colors px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 cursor-pointer"
                  :title="toAppBinding ? `Edit app binding (${toAppBinding.app_name})` : 'Link recipient to App Store, Play Store, or Website'"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>{{ toAppBinding ? toAppBinding.app_name : 'Link App' }}</span>
                </button>
                <span class="text-gray-300 dark:text-gray-600">·</span>
                <button
                  type="button"
                  @click="showCc = !showCc"
                  :class="showCc ? 'text-emerald-500 font-bold' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
                  class="transition-colors cursor-pointer"
                >
                  Cc
                </button>
                <span class="text-gray-400">·</span>
                <button
                  type="button"
                  @click="showBcc = !showBcc"
                  :class="showBcc ? 'text-emerald-500 font-bold' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
                  class="transition-colors cursor-pointer"
                >
                  Bcc
                </button>
              </div>
            </div>

            <!-- Tokenized Recipient Chips -->
            <RecipientInput 
              v-model="to" 
              placeholder="recipient@example.com (press Enter or Comma for multiple)" 
            />

            <!-- Linked App Identity Card -->
            <div
              v-if="toAppBinding"
              class="mt-2.5 p-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-transparent border border-emerald-500/30 dark:border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200 shadow-xs"
            >
              <div class="flex items-center gap-3 min-w-0">
                <a
                  :href="toAppBinding.app_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="relative w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/25 shadow-xs flex-shrink-0 bg-white hover:scale-105 transition-transform"
                  :title="`Open ${toAppBinding.app_name} in new tab`"
                >
                  <img
                    :src="toAppBinding.app_icon_url"
                    :alt="toAppBinding.app_name"
                    class="w-full h-full object-cover"
                    @error="onBindingImgError"
                  />
                </a>

                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-gray-900 dark:text-white text-sm truncate">
                      {{ toAppBinding.app_name }}
                    </span>
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border flex items-center gap-1"
                      :class="toAppBinding.platform === 'playstore' 
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : toAppBinding.platform === 'appstore'
                          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                          : 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30'"
                    >
                      <component :is="getPlatformIcon(toAppBinding.platform)" />
                      <span>{{ getPlatformLabel(toAppBinding.platform) }}</span>
                    </span>
                  </div>
                  <p class="text-gray-500 dark:text-gray-400 text-xs truncate mt-0.5">
                    {{ toAppBinding.developer_name ? `Developer: ${toAppBinding.developer_name} · ` : '' }}Bound to {{ toAppBinding.email }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  @click="unlinkBinding"
                  class="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 font-semibold text-xs transition-colors cursor-pointer"
                  title="Unlink app from this email"
                >
                  Unlink
                </button>
                <a
                  :href="toAppBinding.app_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
                  title="Visit store or website"
                >
                  <span>Visit Store</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <!-- Cc Field (Collapsible) -->
          <div v-if="showCc" class="animate-fadeIn">
            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
              <span>Cc</span>
              <button type="button" @click="showCc = false" class="text-gray-400 hover:text-gray-600 text-[11px] cursor-pointer">Hide</button>
            </label>
            <RecipientInput v-model="cc" placeholder="colleague@example.com" />
          </div>

          <!-- Bcc Field (Collapsible) -->
          <div v-if="showBcc" class="animate-fadeIn">
            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
              <span>Bcc</span>
              <button type="button" @click="showBcc = false" class="text-gray-400 hover:text-gray-600 text-[11px] cursor-pointer">Hide</button>
            </label>
            <RecipientInput v-model="bcc" placeholder="hidden-recipient@example.com" />
          </div>

          <!-- Subject -->
          <div>
            <label for="subject" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
            <input 
              type="text" 
              id="subject" 
              v-model="subject" 
              class="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 dark:text-gray-100 px-3.5 py-2 text-sm transition-all duration-150" 
              placeholder="Email subject"
              required 
            />
          </div>

          <!-- Message Body with native CID image staging -->
          <div class="flex-grow flex flex-col">
            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
            <RichTextEditor 
              v-model="body" 
              @inline-image-added="handleInlineImageAdded"
            />
          </div>

          <!-- File Attachments List -->
          <div v-if="attachments.length > 0" class="space-y-2">
            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Attached Files ({{ attachments.length }})
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div 
                v-for="(file, idx) in attachments" 
                :key="idx" 
                class="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-xs"
              >
                <div class="flex items-center gap-2 truncate pr-2">
                  <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span class="truncate font-medium text-gray-700 dark:text-gray-200">{{ file.filename }}</span>
                  <span class="text-[10px] text-gray-400">({{ formatBytes(file.size) }})</span>
                </div>
                <button 
                  type="button" 
                  @click="removeAttachment(idx)" 
                  class="text-gray-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                  title="Remove attachment"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Footer Toolbar -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            <!-- Left: Attachment + Draft Status Indicator -->
            <div class="flex items-center gap-2 flex-wrap">
              <input 
                type="file" 
                ref="fileInputRef" 
                @change="handleFileSelect" 
                multiple 
                class="hidden" 
              />
              <button 
                type="button" 
                @click="triggerFileInput" 
                class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Attach Files
              </button>

              <button
                type="button"
                @click="manualSaveDraft"
                :disabled="isLoading || (!subject && !body && !to)"
                class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                title="Save draft immediately"
              >
                Save Draft
              </button>

              <!-- Autosave Status Badge -->
              <span v-if="isAutosaving" class="text-xs text-gray-400 flex items-center gap-1.5 ml-1">
                <svg class="animate-spin w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving draft...
              </span>
              <span v-else-if="draftAutosaveStatus" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 ml-1">
                <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
                {{ draftAutosaveStatus }}
              </span>
            </div>

            <!-- Right: Actions -->
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-gray-400 font-mono hidden sm:inline mr-1">⌘+Enter</span>

              <button 
                type="button" 
                @click="requestCloseModal" 
                class="px-4 py-2 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                @click="triggerSendFlow(false)"
                :disabled="isLoading || totalAttachmentSize > 25 * 1024 * 1024"
                class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg v-if="!isLoading" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Send Message</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- 🔍 Full Email Preview Modal -->
      <div v-if="showPreviewModal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-60 p-4">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
          <div class="px-6 py-4 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="font-bold text-sm text-gray-900 dark:text-white">Email Preview</span>
              <div class="flex bg-gray-200 dark:bg-gray-700 rounded p-0.5 text-xs">
                <button
                  type="button"
                  @click="previewDevice = 'desktop'"
                  :class="previewDevice === 'desktop' ? 'bg-white dark:bg-gray-800 font-bold text-emerald-500' : 'text-gray-500'"
                  class="px-2 py-0.5 rounded transition-all cursor-pointer"
                >
                  Desktop
                </button>
                <button
                  type="button"
                  @click="previewDevice = 'mobile'"
                  :class="previewDevice === 'mobile' ? 'bg-white dark:bg-gray-800 font-bold text-emerald-500' : 'text-gray-500'"
                  class="px-2 py-0.5 rounded transition-all cursor-pointer"
                >
                  Mobile (375px)
                </button>
              </div>
            </div>
            <button @click="showPreviewModal = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 cursor-pointer" title="Close preview">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div class="p-6 overflow-y-auto flex-grow flex flex-col items-center bg-gray-100 dark:bg-gray-950">
            <div
              :style="{ width: previewDevice === 'mobile' ? '375px' : '100%', maxWidth: '100%' }"
              class="bg-white text-gray-900 rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-200 flex flex-col"
            >
              <!-- Email Header Metadata -->
              <div class="p-5 border-b border-gray-100 bg-gray-50 text-xs space-y-1.5">
                <div class="flex items-start">
                  <span class="font-bold text-gray-500 w-16">Subject:</span>
                  <span class="font-bold text-gray-900 text-sm">{{ subject || "(No subject)" }}</span>
                </div>
                <div class="flex items-start">
                  <span class="font-bold text-gray-500 w-16">From:</span>
                  <span class="text-gray-700">{{ currentMailbox?.email }}</span>
                </div>
                <div class="flex items-start">
                  <span class="font-bold text-gray-500 w-16">To:</span>
                  <span class="text-gray-700">{{ to || "(No recipient)" }}</span>
                </div>
                <div v-if="cc" class="flex items-start">
                  <span class="font-bold text-gray-500 w-16">Cc:</span>
                  <span class="text-gray-700">{{ cc }}</span>
                </div>
                <div v-if="bcc" class="flex items-start">
                  <span class="font-bold text-gray-500 w-16">Bcc:</span>
                  <span class="text-gray-700">{{ bcc }} (hidden)</span>
                </div>
                <div v-if="attachments.length > 0" class="flex items-start">
                  <span class="font-bold text-gray-500 w-16">Files:</span>
                  <span class="text-gray-700">{{ attachments.length }} file(s) attached</span>
                </div>
              </div>

              <!-- Email Body Iframe -->
              <iframe
                :srcdoc="previewHtmlDoc"
                sandbox="allow-same-origin"
                class="w-full flex-grow min-h-[380px] border-none bg-white p-2"
              />
            </div>
          </div>

          <div class="px-6 py-3 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              type="button"
              @click="showPreviewModal = false"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer"
            >
              Back to Editor
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ⚠️ Dirty-State Exit Confirmation Dialog -->
    <div v-if="showDirtyModal" class="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-150">
        <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 class="text-base font-bold text-gray-900 dark:text-white mb-1.5">Unsaved Changes</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
          You have unsaved changes in this email draft. Would you like to save it to your Drafts folder before closing?
        </p>

        <div class="flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            @click="showDirtyModal = false"
            class="px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            Keep Editing
          </button>
          <button
            type="button"
            @click="discardAndClose"
            class="px-3.5 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl font-bold transition-colors cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            @click="saveDraftAndClose"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-sm transition-all cursor-pointer"
          >
            Save Draft & Close
          </button>
        </div>
      </div>
    </div>

    <!-- ⚡ Floating 5-Second Undo Send Buffer Snackbar -->
    <div 
      v-if="isUndoPending" 
      class="fixed bottom-6 right-6 z-60 bg-gray-900/95 dark:bg-gray-800/95 text-white backdrop-blur-md rounded-2xl shadow-2xl p-4 flex items-center gap-4 border border-gray-700 animate-in slide-in-from-bottom duration-300 select-none"
    >
      <div class="flex items-center gap-3">
        <div class="relative w-7 h-7 flex items-center justify-center">
          <svg class="w-7 h-7 -rotate-90 text-emerald-500" viewBox="0 0 36 36">
            <path
              class="text-gray-700"
              stroke-width="3"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              stroke-dasharray="100, 100"
              :stroke-dashoffset="100 - (undoCountdown / 5) * 100"
              stroke-linecap="round"
              stroke-width="3"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span class="absolute text-[10px] font-bold font-mono">{{ undoCountdown }}</span>
        </div>

        <div>
          <div class="text-xs font-bold text-white">Sending message...</div>
          <div class="text-[11px] text-gray-400">To {{ to || 'recipient' }}</div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="cancelUndoSend"
          class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-gray-900 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          Undo
        </button>
        <button
          type="button"
          @click="commitSendImmediately"
          class="text-xs text-gray-400 hover:text-white underline cursor-pointer"
        >
          Send now
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, h, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { extractCleanEmail, useAppBindingsStore } from "@/stores/appBindings";
import { useEmailStore } from "@/stores/emails";
import { useMailboxStore } from "@/stores/mailboxes";
import { useUIStore } from "@/stores/ui";
import type { AppPlatform, OutgoingAttachment } from "@/types";
import RecipientInput from "./RecipientInput.vue";
import RichTextEditor from "./RichTextEditor.vue";

const uiStore = useUIStore();
const { isComposeModalOpen, composeOptions } = storeToRefs(uiStore);
const emailStore = useEmailStore();
const mailboxStore = useMailboxStore();
const { currentMailbox } = storeToRefs(mailboxStore);
const route = useRoute();
const { success: showSuccessToast, error: showErrorToast } = useToast();
const appBindingsStore = useAppBindingsStore();

const to = ref("");
const cc = ref("");
const bcc = ref("");
const showCc = ref(false);
const showBcc = ref(false);
const subject = ref("");
const body = ref("");
const attachments = ref<OutgoingAttachment[]>([]);
const inlineAttachments = ref<any[]>([]);
const currentDraftId = ref<string | null>(null);

const error = ref<string | null>(null);
const isLoading = ref(false);
const showPreviewModal = ref(false);
const previewDevice = ref<"desktop" | "mobile">("desktop");
const fileInputRef = ref<HTMLInputElement | null>(null);

// Autosave & Dirty state
const isDirty = ref(false);
const isAutosaving = ref(false);
const draftAutosaveStatus = ref<string>("");
const showDirtyModal = ref(false);
let autosaveTimeout: any = null;

// Undo Send buffer
const isUndoPending = ref(false);
const undoCountdown = ref(5);
let undoTimer: any = null;
const pendingSendPayload = ref<any>(null);

// Platform tab & badge icons
const PlayIcon = () =>
	h("svg", { class: "w-3 h-3 text-emerald-500 flex-shrink-0", viewBox: "0 0 24 24", fill: "currentColor" }, [
		h("path", { d: "M3.609 1.814L13.792 12 3.61 22.186a2.03 2.03 0 01-.61-1.467V3.28c0-.573.225-1.096.609-1.466zM15.206 13.414l2.457-2.457a1.99 1.99 0 000-2.814l-2.457-2.457-3.007 3.007 3.007 2.921zM4.75 23.327l9.043-9.043 2.127 2.127-9.704 5.539a1.97 1.97 0 01-1.466.377zM4.75.673a1.97 1.97 0 011.466.377l9.704 5.539-2.127 2.127L4.75.673z" }),
	]);

const AppleIcon = () =>
	h("svg", { class: "w-3 h-3 text-blue-500 flex-shrink-0", viewBox: "0 0 24 24", fill: "currentColor" }, [
		h("path", { d: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.79 1.06-1.88.94-2.97-.93.04-2.03.62-2.68 1.41-.57.66-.99 1.77-.85 2.84 1.03.08 2.05-.53 2.59-1.28z" }),
	]);

const WebIcon = () =>
	h("svg", { class: "w-3 h-3 text-teal-500 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, [
		h("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" }),
	]);

const getPlatformIcon = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore": return PlayIcon;
		case "appstore": return AppleIcon;
		case "website": return WebIcon;
	}
};

const getPlatformLabel = (platform: AppPlatform) => {
	switch (platform) {
		case "playstore": return "Google Play";
		case "appstore": return "App Store";
		case "website": return "Official Website";
	}
};

const cleanToEmail = computed(() => {
	if (!to.value) return "";
	return extractCleanEmail(to.value);
});

const toAppBinding = computed(() => {
	if (!cleanToEmail.value) return null;
	return appBindingsStore.getBinding(cleanToEmail.value);
});

const totalAttachmentSize = computed(() => {
	return attachments.value.reduce((acc, curr) => acc + curr.size, 0);
});

const modalTitle = computed(() => {
	switch (composeOptions.value.mode) {
		case "reply": return "Reply to Message";
		case "reply-all": return "Reply All";
		case "forward": return "Forward Message";
		case "draft": return "Edit Draft";
		default: return "New Message";
	}
});

const handleOpenLinkAppModal = () => {
	const emailToLink = cleanToEmail.value || (to.value ? to.value.trim() : "");
	appBindingsStore.openLinkModal(emailToLink, toAppBinding.value);
};

const unlinkBinding = async () => {
	if (!cleanToEmail.value) return;
	try {
		await appBindingsStore.deleteBinding(cleanToEmail.value);
		showSuccessToast("App unlinked from recipient");
	} catch (e) {
		console.error("Failed to delete binding", e);
	}
};

const onBindingImgError = (event: Event) => {
	const target = event.target as HTMLImageElement;
	target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%2310b981" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 18h.01"/></svg>';
};

const handleInlineImageAdded = (att: any) => {
	inlineAttachments.value.push(att);
	isDirty.value = true;
};

const triggerFileInput = () => {
	fileInputRef.value?.click();
};

const handleFileSelect = (event: Event) => {
	const target = event.target as HTMLInputElement;
	const files = target.files;
	if (!files) return;

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result as string;
			if (result) {
				const base64Data = result.split(",")[1] || result;
				attachments.value.push({
					filename: file.name,
					content: base64Data,
					type: file.type || "application/octet-stream",
					size: file.size,
					disposition: "attachment",
				});
				isDirty.value = true;
			}
		};
		reader.readAsDataURL(file);
	}
	target.value = "";
};

const removeAttachment = (index: number) => {
	attachments.value.splice(index, 1);
	isDirty.value = true;
};

// Autosave debouncing
const scheduleAutosave = () => {
	if (!isComposeModalOpen.value || !currentMailbox.value) return;
	if (!to.value.trim() && !subject.value.trim() && !body.value.trim()) return;

	isDirty.value = true;
	if (autosaveTimeout) clearTimeout(autosaveTimeout);

	autosaveTimeout = setTimeout(async () => {
		if (!isComposeModalOpen.value) return;
		await executeAutosave();
	}, 2000);
};

const executeAutosave = async () => {
	if (!currentMailbox.value) return;
	isAutosaving.value = true;
	try {
		const mailboxId = (route.params.mailboxId as string) || currentMailbox.value.id;
		let finalHtml = body.value;
		for (const att of inlineAttachments.value) {
			if (att.localUrl && att.contentId) {
				const cleanCid = att.contentId.replace(/^<|>$/g, "");
				finalHtml = finalHtml.split(att.localUrl).join(`cid:${cleanCid}`);
			}
		}

		const allAttachments = [...attachments.value, ...inlineAttachments.value];
		const res = await api.saveDraft(mailboxId, {
			draft_id: currentDraftId.value || undefined,
			to: to.value,
			from: currentMailbox.value.email,
			subject: subject.value || "(No Subject)",
			html: finalHtml,
			text: htmlToPlainText(finalHtml),
			cc: cc.value.trim() || undefined,
			bcc: bcc.value.trim() || undefined,
			attachments: allAttachments.length > 0 ? allAttachments : undefined,
		});

		if (res.data?.id) {
			currentDraftId.value = res.data.id;
		}
		isDirty.value = false;
		draftAutosaveStatus.value = `Draft saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
	} catch (e) {
		console.error("Autosave draft failed", e);
	} finally {
		isAutosaving.value = false;
	}
};

const manualSaveDraft = async () => {
	await executeAutosave();
	showSuccessToast("Draft saved successfully!");
};

// Close & dirty confirmation
const requestCloseModal = () => {
	if (isDirty.value) {
		showDirtyModal.value = true;
		return;
	}
	forceCloseModal();
};

const saveDraftAndClose = async () => {
	await executeAutosave();
	showDirtyModal.value = false;
	forceCloseModal();
	showSuccessToast("Draft saved.");
};

const discardAndClose = () => {
	showDirtyModal.value = false;
	forceCloseModal();
};

const forceCloseModal = () => {
	error.value = null;
	to.value = "";
	cc.value = "";
	bcc.value = "";
	showCc.value = false;
	showBcc.value = false;
	subject.value = "";
	body.value = "";
	attachments.value = [];
	inlineAttachments.value = [];
	currentDraftId.value = null;
	isDirty.value = false;
	draftAutosaveStatus.value = "";
	showPreviewModal.value = false;
	showDirtyModal.value = false;
	if (autosaveTimeout) clearTimeout(autosaveTimeout);
	uiStore.closeComposeModal();
};

// Track field changes for debounced autosaving
watch([to, cc, bcc, subject, body], () => {
	scheduleAutosave();
});

// Signature Builder
const getSignatureBlock = (): string => {
	const sig = currentMailbox.value?.settings?.signature;
	if (sig?.enabled && (sig?.html || sig?.text)) {
		const escapeHtml = (s: string) =>
			s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		const content = sig.html || escapeHtml(sig.text);
		return `<div style="border-top: 1px solid #ccc; margin-top: 16px; padding-top: 12px;">${content}</div>`;
	}
	return "";
};

// Watch compose modal options
watch(
	[isComposeModalOpen, composeOptions],
	([isOpen, options]) => {
		if (isOpen && options) {
			appBindingsStore.fetchBindings();
			const original = options.originalEmail;
			const sigBlock = getSignatureBlock();

			if (options.mode === "draft" && original) {
				currentDraftId.value = original.id;
				to.value = original.recipient || "";
				cc.value = original.cc || "";
				bcc.value = original.bcc || "";
				subject.value = original.subject || "";
				body.value = original.body || "";
				if (original.attachments) {
					attachments.value = original.attachments.map((att: any) => ({
						filename: att.filename,
						content: "",
						type: att.mimetype,
						size: att.size,
						disposition: att.disposition || "attachment",
					}));
				}
				isDirty.value = false;
			} else if (options.mode === "reply" && original) {
				const isSent =
					Boolean(currentMailbox.value?.email &&
						original.sender.toLowerCase().includes(currentMailbox.value.email.toLowerCase())) ||
					(original.delivery_status !== undefined && original.delivery_status !== null) ||
					(original.opened_count !== undefined && original.opened_count !== null);
				to.value = isSent ? original.recipient : original.sender;
				cc.value = "";
				bcc.value = "";
				subject.value = original.subject.startsWith("Re: ")
					? original.subject
					: `Re: ${original.subject}`;
				const initialText = options.initialBody ? `<p>${options.initialBody.replace(/\n/g, "<br>")}</p><br>` : "";
				body.value = `${initialText}${sigBlock}<br><blockquote style="border-left: 2px solid #ccc; margin: 0; padding-left: 1em; color: #666;">On ${original.date}, ${original.sender} wrote:<br><br>${original.body || ""}</blockquote>`;
				isDirty.value = false;
			} else if (options.mode === "reply-all" && original) {
				const isSent =
					Boolean(currentMailbox.value?.email &&
						original.sender.toLowerCase().includes(currentMailbox.value.email.toLowerCase())) ||
					(original.delivery_status !== undefined && original.delivery_status !== null) ||
					(original.opened_count !== undefined && original.opened_count !== null);
				to.value = isSent ? original.recipient : original.sender;

				const ccRecipients = new Set<string>();
				if (
					original.recipient &&
					original.recipient !== currentMailbox.value?.email &&
					original.recipient !== original.sender
				) {
					ccRecipients.add(original.recipient);
				}
				if (original.cc) {
					original.cc.split(/[,;\s]+/).forEach((addr: string) => {
						if (addr && addr !== currentMailbox.value?.email) {
							ccRecipients.add(addr);
						}
					});
				}

				if (ccRecipients.size > 0) {
					cc.value = Array.from(ccRecipients).join(", ");
					showCc.value = true;
				} else {
					cc.value = "";
				}

				subject.value = original.subject.startsWith("Re: ")
					? original.subject
					: `Re: ${original.subject}`;
				body.value = `<br>${sigBlock}<br><blockquote style="border-left: 2px solid #ccc; margin: 0; padding-left: 1em; color: #666;">On ${original.date}, ${original.sender} wrote:<br><br>${original.body || ""}</blockquote>`;
				isDirty.value = false;
			} else if (options.mode === "forward" && original) {
				to.value = "";
				cc.value = "";
				bcc.value = "";
				subject.value = original.subject.startsWith("Fwd: ")
					? original.subject
					: `Fwd: ${original.subject}`;
				body.value = `<br>${sigBlock}<br><div style="border: 1px solid #ddd; padding: 1em; background-color: #f9f9f9; margin: 1em 0;">
<strong>Forwarded message:</strong><br>
<strong>From:</strong> ${original.sender}<br>
<strong>Date:</strong> ${original.date}<br>
<strong>Subject:</strong> ${original.subject}<br><br>
${original.body || ""}
</div>`;
				isDirty.value = false;
			} else {
				to.value = options.initialTo || "";
				cc.value = "";
				bcc.value = "";
				subject.value = options.initialSubject || "";
				const initialText = options.initialBody || "";
				body.value = initialText
					? `${initialText}${sigBlock ? `<br><br>${sigBlock}` : ""}`
					: sigBlock
						? `<br><br>${sigBlock}`
						: "";
				isDirty.value = false;
			}
		}
	},
	{ deep: true },
);

const htmlToPlainText = (html: string): string => {
	const div = document.createElement("div");
	div.innerHTML = html;
	let text = html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<p[^>]*>/gi, "")
		.replace(/<div[^>]*>/gi, "")
		.replace(/<\/div>/gi, "\n");
	div.innerHTML = text;
	return (div.textContent || div.innerText || "").trim();
};

const previewHtmlDoc = computed(() => {
	const content = body.value || "<p style='color:#888;'>No message content</p>";
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
      line-height: 1.6;
    }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    blockquote { border-left: 3px solid #d1d5db; padding-left: 12px; margin: 12px 0; color: #4b5563; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
});

// Speed Ergonomics & 5-Second Undo Send
const triggerSendFlow = (isDraft = false) => {
	if (isDraft) {
		manualSaveDraft();
		return;
	}

	error.value = null;
	if (!currentMailbox.value) {
		error.value = "No mailbox selected.";
		return;
	}

	if (!to.value.trim()) {
		error.value = "Please specify at least one recipient.";
		return;
	}

	// Prepare payload with inline CID replacements
	let finalHtml = body.value;
	for (const att of inlineAttachments.value) {
		if (att.localUrl && att.contentId) {
			const cleanCid = att.contentId.replace(/^<|>$/g, "");
			finalHtml = finalHtml.split(att.localUrl).join(`cid:${cleanCid}`);
		}
	}

	const allAttachments = [...attachments.value, ...inlineAttachments.value];
	const mailboxId = (route.params.mailboxId as string) || currentMailbox.value.id;

	const payload: any = {
		mailboxId,
		draft_id: currentDraftId.value || undefined,
		to: to.value,
		from: currentMailbox.value.email,
		subject: subject.value || "(No subject)",
		html: finalHtml,
		text: htmlToPlainText(finalHtml),
		is_draft: false,
	};

	if (cc.value.trim()) payload.cc = cc.value;
	if (bcc.value.trim()) payload.bcc = bcc.value;
	if (allAttachments.length > 0) payload.attachments = allAttachments;

	pendingSendPayload.value = payload;

	// Start 5-second Undo buffer
	isUndoPending.value = true;
	undoCountdown.value = 5;
	uiStore.closeComposeModal();

	if (undoTimer) clearInterval(undoTimer);
	undoTimer = setInterval(() => {
		undoCountdown.value--;
		if (undoCountdown.value <= 0) {
			clearInterval(undoTimer);
			commitSend();
		}
	}, 1000);
};

const cancelUndoSend = () => {
	if (undoTimer) clearInterval(undoTimer);
	isUndoPending.value = false;
	uiStore.isComposeModalOpen = true;
	showSuccessToast("Sending canceled. Draft preserved.");
};

const commitSendImmediately = () => {
	if (undoTimer) clearInterval(undoTimer);
	commitSend();
};

const commitSend = async () => {
	if (!pendingSendPayload.value) return;
	const payload = pendingSendPayload.value;
	pendingSendPayload.value = null;
	isUndoPending.value = false;

	isLoading.value = true;
	try {
		const mailboxId = payload.mailboxId;
		if (
			composeOptions.value.mode === "reply" ||
			composeOptions.value.mode === "reply-all"
		) {
			const originalEmailId = composeOptions.value.originalEmail?.id;
			if (originalEmailId) {
				await api.replyToEmail(mailboxId, originalEmailId, payload);
			} else {
				await emailStore.sendEmail(mailboxId, payload);
			}
		} else if (composeOptions.value.mode === "forward") {
			const originalEmailId = composeOptions.value.originalEmail?.id;
			if (originalEmailId) {
				await api.forwardEmail(mailboxId, originalEmailId, payload);
			} else {
				await emailStore.sendEmail(mailboxId, payload);
			}
		} else {
			await emailStore.sendEmail(mailboxId, payload);
		}

		forceCloseModal();
		showSuccessToast("Email sent successfully!");
	} catch (e: any) {
		const errorMessage =
			e.response?.data?.error || "Failed to dispatch email.";
		showErrorToast(errorMessage);
		uiStore.isComposeModalOpen = true;
	} finally {
		isLoading.value = false;
	}
};

const formatBytes = (bytes: number, decimals = 1) => {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};
</script>
