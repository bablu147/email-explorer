<template>
  <div>
    <!-- Main Compose Modal -->
    <div v-if="isComposeModalOpen" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4">
      <div 
        @keydown.meta.enter="triggerSendFlow(false)"
        @keydown.ctrl.enter="triggerSendFlow(false)"
        class="bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl text-gray-900 dark:text-gray-100 border-0 sm:border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all flex flex-col"
        :style="composeModalStyle"
      >
        <!-- Header: Fixed Safe-Area Top Header -->
        <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-900/90 px-4 sm:px-6 py-3 sm:py-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:pt-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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

        <!-- Form wrapping Tier 2 Body and Tier 3 Action Bar -->
        <form @submit.prevent="triggerSendFlow(false)" class="flex flex-col flex-1 min-h-0 overflow-hidden">
          <!-- Tier 2: Scrollable Body -->
          <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
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
              class="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 dark:text-gray-100 px-3.5 py-2 text-base sm:text-sm transition-all duration-150" 
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

          </div> <!-- End Tier 2: Scrollable Body -->

          <!-- Tier 3: Fixed Sticky Bottom Action Bar (pinned above virtual keyboard & safe area) -->
          <div class="px-3 sm:px-6 py-2.5 sm:py-3.5 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 flex-shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3.5">
            <!-- Left: Attachment + Draft Status Indicator -->
            <div class="flex items-center gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap min-w-0">
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
                class="px-2.5 sm:px-3 py-2 sm:py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px] sm:min-h-0"
                title="Attach files"
              >
                <svg class="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span class="hidden sm:inline">Attach</span>
              </button>

              <button
                type="button"
                @click="manualSaveDraft"
                :disabled="isLoading || (!subject && !body && !to)"
                class="px-2.5 sm:px-3 py-2 sm:py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer min-h-[40px] sm:min-h-0"
                title="Save draft immediately"
              >
                Draft
              </button>

              <!-- Autosave Status Badge -->
              <span v-if="isAutosaving || isLoadingDraftAttachments" class="text-xs text-gray-400 flex items-center gap-1.5 ml-1">
                <svg class="animate-spin w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <!-- Send is off while a reopened draft's files load, so say why -->
                <span class="hidden md:inline">{{ isLoadingDraftAttachments ? "Loading draft..." : "Saving draft..." }}</span>
              </span>
              <span v-else-if="draftAutosaveStatus" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 ml-1 truncate max-w-[100px] sm:max-w-none">
                <svg class="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span class="truncate">{{ draftAutosaveStatus }}</span>
              </span>
            </div>

            <!-- Right: Actions -->
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[11px] text-gray-400 font-mono hidden sm:inline mr-1">⌘+Enter</span>

              <button 
                type="button" 
                @click="requestCloseModal" 
                class="px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[40px] sm:min-h-0"
              >
                Cancel
              </button>
              <div class="flex items-center shadow-md hover:shadow-lg transition-all rounded-xl overflow-hidden min-h-[40px] sm:min-h-0">
                <button 
                  type="button"
                  @click="triggerSendFlow(false)"
                  :disabled="isLoading || isCheckingSuppression || isLoadingDraftAttachments || totalAttachmentSize > 25 * 1024 * 1024"
                  class="px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[40px] sm:min-h-0"
                >
                  <svg v-if="!isLoading" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Send</span>
                </button>
                <button
                  type="button"
                  @click="showScheduleModal = true"
                  :disabled="isLoading || isCheckingSuppression || isLoadingDraftAttachments"
                  class="px-2.5 py-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-xs font-bold border-l border-emerald-500/40 transition-all flex items-center disabled:opacity-50 cursor-pointer min-h-[40px] sm:min-h-0"
                  title="Schedule send…"
                  aria-label="Schedule send"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Full Email Preview Modal -->
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

    <!-- Do-not-contact dialog: blocks the send. Only the person being answered (reply to received mail) gets a warning instead -->
    <div v-if="suppressionWarning" class="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-150">
        <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h3 class="text-base font-bold text-gray-900 dark:text-white mb-1.5">
          {{ suppressionBlocksSend ? "Can't send to these recipients" : "Check these recipients" }}
        </h3>
        <p v-if="suppressionBlocksSend" class="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
          These addresses are on the do-not-contact list, so this message can't be sent to them.
          Go back and remove them. An admin can take an address off the list in Settings.
        </p>
        <p v-else class="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
          Sending to these addresses may hurt deliverability or ignore their request.
        </p>
        <ul class="mb-5 space-y-1.5 max-h-40 overflow-y-auto">
          <li
            v-for="hit in suppressionWarning"
            :key="hit.email"
            class="flex items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2"
          >
            <span class="font-medium text-gray-800 dark:text-gray-200 truncate">{{ hit.email }}</span>
            <span class="shrink-0 text-amber-700 dark:text-amber-400 font-semibold">{{ suppressionLabel(hit.reason) }}</span>
          </li>
        </ul>
        <div class="flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            @click="suppressionWarning = null"
            class="px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            Go back
          </button>
          <button
            v-if="!suppressionBlocksSend"
            type="button"
            @click="sendAnywayDespiteSuppression"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-sm transition-all cursor-pointer"
          >
            Send anyway
          </button>
        </div>
      </div>
    </div>

    <!-- Dirty-State Exit Confirmation Dialog -->
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

    <!--
      Undo Send bar. Phones: sits in the bottom lane but stops short of the compose FAB on the right
      (FAB: right 1.25rem, 3.5rem wide), so composing another message stays possible during the 5 s window.
    -->
    <div
      v-if="isUndoPending"
      role="status"
      aria-live="polite"
      class="undo-send-bar fixed left-3 sm:left-auto sm:right-6 sm:w-[400px] z-[60] bg-gray-900/95 dark:bg-gray-800/95 text-white backdrop-blur-md rounded-2xl shadow-2xl pl-3 pr-2 py-2.5 sm:p-4 flex items-center gap-3 border border-gray-800 dark:border-gray-700 animate-in slide-in-from-bottom duration-300 select-none"
    >
      <div class="relative w-7 h-7 flex-shrink-0 flex items-center justify-center">
        <svg class="w-7 h-7 -rotate-90 text-emerald-500" viewBox="0 0 36 36" aria-hidden="true">
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

      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-white truncate">Sending…</div>
        <div class="text-[11px] text-gray-400 truncate">To {{ pendingSend?.recipientLabel || 'recipient' }}</div>
      </div>

      <div class="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          @click="cancelUndoSend"
          class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-gray-900 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          Undo
        </button>
        <button
          type="button"
          @click="commitSendImmediately"
          class="inline-flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Send now"
          aria-label="Send now"
        >
          <svg class="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <span class="hidden sm:inline">Send now</span>
        </button>
      </div>
    </div>

    <!-- Schedule Send Modal -->
    <ScheduleSendModal
      :show="showScheduleModal"
      :recipient-label="to.trim().split(',')[0]"
      @close="showScheduleModal = false"
      @schedule="handleScheduleSend"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "@/composables/useToast";
import api, { apiErrorMessage } from "@/services/api";
import { extractCleanEmail, useAppBindingsStore } from "@/stores/appBindings";
import { useEmailStore } from "@/stores/emails";
import { useMailboxStore } from "@/stores/mailboxes";
import { type ComposeMode, type ComposeOptions, type ComposeSnapshot, useUIStore } from "@/stores/ui";
import type { AppPlatform, OutgoingAttachment } from "@/types";
import RecipientInput from "./RecipientInput.vue";
import RichTextEditor from "./RichTextEditor.vue";
import ScheduleSendModal from "./ScheduleSendModal.vue";

const uiStore = useUIStore();
const { isComposeModalOpen, composeOptions } = storeToRefs(uiStore);
const emailStore = useEmailStore();
const mailboxStore = useMailboxStore();
const { currentMailbox } = storeToRefs(mailboxStore);
const route = useRoute();
const {
	success: showSuccessToast,
	error: showErrorToast,
	info: showInfoToast,
	addToast,
	removeToast,
} = useToast();
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
const showScheduleModal = ref(false);
const previewDevice = ref<"desktop" | "mobile">("desktop");
const fileInputRef = ref<HTMLInputElement | null>(null);

// Visual Viewport tracking on mobile to ensure bottom action bar sits right above the keyboard
const visualViewportHeight = ref<number | null>(null);

const updateVisualViewport = () => {
	if (typeof window !== "undefined" && window.visualViewport && window.innerWidth < 640) {
		visualViewportHeight.value = window.visualViewport.height;
	} else {
		visualViewportHeight.value = null;
	}
};

const composeModalStyle = computed(() => {
	if (visualViewportHeight.value) {
		return {
			height: `${visualViewportHeight.value}px`,
			maxHeight: `${visualViewportHeight.value}px`,
		};
	}
	return {};
});

onMounted(() => {
	if (typeof window !== "undefined" && window.visualViewport) {
		window.visualViewport.addEventListener("resize", updateVisualViewport);
		window.visualViewport.addEventListener("scroll", updateVisualViewport);
		updateVisualViewport();
	}
});

onBeforeUnmount(() => {
	if (typeof window !== "undefined" && window.visualViewport) {
		window.visualViewport.removeEventListener("resize", updateVisualViewport);
		window.visualViewport.removeEventListener("scroll", updateVisualViewport);
	}
});

// Autosave & Dirty state
const isDirty = ref(false);
const isAutosaving = ref(false);
const draftAutosaveStatus = ref<string>("");
const showDirtyModal = ref(false);

/** Bare, lower-cased address of `Name <a@b>` or `a@b`, for exact comparison. */
const addressOf = (value?: string | null): string =>
	((value || "").match(/<([^>]+)>/)?.[1] || value || "").trim().toLowerCase();

/** This mailbox's own address: the mailbox the message is sent from (a mailbox's id is its address). */
const ownAddress = () => addressOf((route.params.mailboxId as string) || currentMailbox.value?.email);

/**
 * Whether this mailbox sent `email`, in which case a reply goes to its recipients rather than back
 * to us. The folder decides first. In Inbox and Spam the From header is whatever the outside sender
 * wrote, and spam that names our own address there must not have its reply sent to the To header it
 * chose. The sender's exact address is only used where the folder says nothing (Archive, Trash,
 * custom folders, search rows, which carry no folder). The tracking columns (opened_count,
 * delivery_status) are set on received mail too, so they say nothing about direction.
 */
const wasSentByMailbox = (email: any): boolean => {
	const folder = email.folder_id || "";
	if (["sent", "drafts", "scheduled"].includes(folder)) return true;
	if (folder === "inbox" || folder === "spam") return false;
	const own = ownAddress();
	return !!own && addressOf(email.sender) === own;
};

const splitAddresses = (list?: string | null): string[] =>
	(list || "")
		.split(/[,;\n]+/)
		.map((part) => part.trim())
		.filter(Boolean);

// Do-not-contact check before sending. The server refuses a message to a listed address (422), so
// the dialog only says what to do. The one exception is the person whose mail is being answered:
// they may still be written to.
interface SuppressedHit {
	email: string;
	reason: string;
}
const suppressionWarning = ref<SuppressedHit[] | null>(null);
/** Whether the hits in the dialog stop the send (no "Send anyway"). */
const suppressionBlocksSend = ref(true);
const isCheckingSuppression = ref(false);
let suppressionAcknowledged = false;
const SUPPRESSION_LABELS: Record<string, string> = {
	bounce: "Previous email bounced",
	unsubscribe: "Unsubscribed",
	manual: "On the do-not-contact list",
};
const suppressionLabel = (reason: string) => SUPPRESSION_LABELS[reason] || reason;
const isReplyMode = (mode: ComposeMode) => mode === "reply" || mode === "reply-all";
/**
 * The one address the list does not stop: the sender of the received mail being answered, so that
 * someone who wrote in stays reachable. Nobody else on that reply is exempt (a listed third party
 * in Cc), and a "reply" to a message this mailbox sent is a follow-up on our own outreach, held to
 * the list like a new message. Same rule as the server.
 */
const exemptRecipient = (): string => {
	const { mode, originalEmail } = composeOptions.value;
	if (!isReplyMode(mode) || !originalEmail || wasSentByMailbox(originalEmail)) return "";
	const sender = addressOf(originalEmail.sender);
	return sender === ownAddress() ? "" : sender;
};

/**
 * Listed recipients, and whether they stop the send. Any listed address stops it, except the
 * person being answered: for them alone a bounce is shown as a warning that can be overridden.
 */
const findSuppressedRecipients = async (): Promise<{ hits: SuppressedHit[]; blocks: boolean }> => {
	const emails = [to.value, cc.value, bcc.value]
		.join(",")
		.split(/[,;\n]+/)
		.map((part) => (part.match(/<([^>]+)>/)?.[1] || part).trim().toLowerCase())
		.filter((e) => e.includes("@"));
	if (emails.length === 0) return { hits: [], blocks: false };
	try {
		const res = await api.checkSuppressions(emails);
		const hits: SuppressedHit[] = res.data?.suppressed || [];
		const exempt = exemptRecipient();
		const blocking = hits.filter((h) => !exempt || addressOf(h.email) !== exempt);
		if (blocking.length > 0) return { hits: blocking, blocks: true };
		return { hits: hits.filter((h) => h.reason === "bounce"), blocks: false };
	} catch {
		return { hits: [], blocks: false }; // fail open: this check is a courtesy, the server enforces the list
	}
};

const sendAnywayDespiteSuppression = () => {
	suppressionAcknowledged = true;
	suppressionWarning.value = null;
	void triggerSendFlow(false);
};
let autosaveTimeout: any = null;
const cancelPendingAutosave = () => {
	if (autosaveTimeout) clearTimeout(autosaveTimeout);
	autosaveTimeout = null;
};
/** The draft save that is running now, if any: Send and Schedule let it finish first. */
let autosaveRunning: Promise<void> | null = null;
/**
 * True from the moment Send or Schedule is accepted until that attempt is over. No draft is saved
 * meanwhile: a save names the same draft_id, and one that reaches the server after the schedule
 * request turns the scheduled message back into a plain draft, which then never sends.
 */
let sendInProgress = false;
/**
 * Counts up whenever this composer stops showing the message it had: closed, unmounted, or filled
 * for another one. A handler that awaited something compares it before going on, so it does not
 * send from, or close, a composer that now holds a different message.
 */
let composeEpoch = 0;
onBeforeUnmount(() => {
	composeEpoch++;
});

// Undo Send buffer
const isUndoPending = ref(false);
const undoCountdown = ref(5);
let undoTimer: ReturnType<typeof setInterval> | null = null;

/**
 * The message waiting out its undo window. Mailbox / mode / original id are captured at send time: the
 * composer closes (and its options reset) as soon as you hit Send, so reading them later sent every
 * reply as a brand-new message without threading headers.
 */
interface PendingSend {
	mailboxId: string;
	payload: any;
	mode: ComposeMode;
	originalEmailId?: string;
	recipientLabel: string;
	snapshot: ComposeSnapshot;
	/**
	 * The draft's row, taken off the visible list while its message is on the way out. Left there
	 * it could be opened and sent a second time before the first send has removed the draft.
	 */
	removedDraft?: ReturnType<typeof emailStore.removeLocal>;
}
const pendingSend = ref<PendingSend | null>(null);
/** The send is over: the draft's row stays gone (sent), or comes back (failed, or undone). */
const settleRemovedDraft = (pending: PendingSend, sent: boolean) => {
	const removed = pending.removedDraft;
	if (!removed) return;
	if (!sent && removed.rows.length > 0) emailStore.restoreLocal(removed.rows, { settled: true });
	removed.settle();
};
/**
 * Non-zero while fields are filled programmatically, so that doesn't count as an edit (dirty /
 * autosave). A count, not a flag: a second fill can start before the first one's release runs
 * (a draft's stored copy arriving right after it opened), and that release must not end it early.
 */
let populating = 0;
const populate = (fn: () => void) => {
	populating++;
	fn();
	// Field watchers queued by `fn` run in the current/next flush; release after it.
	nextTick(() => {
		populating--;
	});
};

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

/**
 * 409 from the send endpoint: the draft this composer is editing is no longer a draft (its schedule
 * sent it, it is being sent right now, or it was moved out of Drafts), or, for a draft save, it was
 * scheduled from another tab. The composer then drops the id, so the next save or send no longer
 * names that message.
 */
const isStaleDraft = (e: any): boolean => e?.response?.status === 409;
const STALE_DRAFT_MESSAGE =
	"This draft is no longer in Drafts: it was already sent, or moved. Check Sent before sending it again.";

/** `email_references` of a stored message (a JSON list of ids) as a list. */
const referencesOf = (email: any): string[] => {
	try {
		const parsed = JSON.parse(email?.email_references || "[]");
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
};

/**
 * Threading for a reply that is scheduled. An immediate reply goes through the reply endpoint,
 * which derives these from the message being answered; a scheduled one is posted as a message, so
 * it has to say the same itself, or it goes out later as a new, unthreaded outreach message.
 */
const replyThreading = (options: ComposeOptions) => {
	const original = options.originalEmail;
	if (!isReplyMode(options.mode) || !original) return {};
	return {
		in_reply_to: original.id as string,
		thread_id: (original.thread_id || original.id) as string,
		references: [...referencesOf(original), original.id as string],
	};
};

/**
 * What a reopened draft's row already says about its conversation. The server writes these from
 * every save and send, so they are handed back, or they are reset to "new conversation": a
 * follow-up draft would leave its thread, and a scheduled reply that failed and is corrected from
 * Drafts would go out as a new message.
 */
const draftThreading = (options: ComposeOptions) => {
	const draft = options.originalEmail;
	if (options.mode !== "draft" || !draft) return {};
	const references = referencesOf(draft);
	return {
		in_reply_to: (draft.in_reply_to || undefined) as string | undefined,
		// A plain draft's thread is its own id, which is gone once it is sent.
		thread_id: (draft.thread_id && draft.thread_id !== draft.id ? draft.thread_id : undefined) as
			| string
			| undefined,
		references: references.length > 0 ? references : undefined,
	};
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

const executeAutosave = (): Promise<void> => {
	if (sendInProgress) return Promise.resolve();
	const run: Promise<void> = saveDraftNow().finally(() => {
		if (autosaveRunning === run) autosaveRunning = null;
	});
	autosaveRunning = run;
	return run;
};

const saveDraftNow = async () => {
	if (!currentMailbox.value) return;
	// A reopened draft's files are still being fetched (see draftAttachmentsLoad): wait for them. If
	// the composer was closed meanwhile there is nothing left here to save.
	if (isLoadingDraftAttachments.value) {
		const epoch = composeEpoch;
		await draftAttachmentsLoad;
		if (epoch !== composeEpoch) return;
	}
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
		const save = (draftId: string | null) =>
			api.saveDraft(mailboxId, {
				draft_id: draftId || undefined,
				to: to.value,
				subject: subject.value || "(No Subject)",
				html: finalHtml,
				text: htmlToPlainText(finalHtml),
				cc: cc.value.trim() || undefined,
				bcc: bcc.value.trim() || undefined,
				attachments: allAttachments.length > 0 ? allAttachments : undefined,
				...draftThreading(composeOptions.value),
				// A reply saved as a draft stays a reply: reopened from Drafts and sent, it would
				// otherwise go out as a new message, unthreaded and with the outreach footer.
				...replyThreading(composeOptions.value),
			});

		let res: Awaited<ReturnType<typeof save>>;
		try {
			res = await save(currentDraftId.value);
		} catch (e) {
			if (!isStaleDraft(e) || !currentDraftId.value) throw e;
			// The text must not be lost with the draft it belonged to: keep it as a new draft.
			currentDraftId.value = null;
			res = await save(null);
			showInfoToast("This draft was sent, scheduled or moved while you were editing it. Your changes are saved as a new draft.");
		}

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
	// A schedule request is on its way: its answer closes the composer, or leaves the message here
	// with the reason. Closing now would lose the message if the request then fails.
	if (isLoading.value) return;
	if (isDirty.value) {
		showDirtyModal.value = true;
		return;
	}
	forceCloseModal();
};

const saveDraftAndClose = async () => {
	const epoch = composeEpoch;
	await executeAutosave();
	// Discarded while the save was waiting: this composer is already closed.
	if (epoch !== composeEpoch) return;
	showDirtyModal.value = false;
	forceCloseModal();
	showSuccessToast("Draft saved.");
};

const discardAndClose = () => {
	showDirtyModal.value = false;
	forceCloseModal();
};

const forceCloseModal = () => {
	composeEpoch++;
	resetComposeState();
	uiStore.closeComposeModal();
};

const resetComposeState = () => {
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
};

const takeSnapshot = (): ComposeSnapshot => ({
	options: { ...composeOptions.value },
	to: to.value,
	cc: cc.value,
	bcc: bcc.value,
	showCc: showCc.value,
	showBcc: showBcc.value,
	subject: subject.value,
	body: body.value,
	attachments: [...attachments.value],
	inlineAttachments: [...inlineAttachments.value],
	currentDraftId: currentDraftId.value,
});

const applySnapshot = (snap: ComposeSnapshot) => {
	to.value = snap.to;
	cc.value = snap.cc;
	bcc.value = snap.bcc;
	showCc.value = snap.showCc || !!snap.cc;
	showBcc.value = snap.showBcc || !!snap.bcc;
	subject.value = snap.subject;
	body.value = snap.body;
	attachments.value = [...snap.attachments];
	inlineAttachments.value = [...snap.inlineAttachments];
	currentDraftId.value = snap.currentDraftId;
	// Not sent and possibly newer than the last autosave: closing should ask before discarding.
	isDirty.value = true;
};

/**
 * Reopen the composer with a previous state (Undo send / failed send). It goes through the store
 * because this instance is usually gone by then: the composer that opens is a new one.
 */
const reopenWith = (snap: ComposeSnapshot, error?: string) => {
	uiStore.restoreComposeModal({ snapshot: snap, error });
};

/** Refresh the visible list when it shows a folder this action changed (Drafts / Sent). */
const refreshListIfShowing = (mailboxId: string, folders: string[]) => {
	const folder = route.params.folder as string | undefined;
	if (!folder || route.params.mailboxId !== mailboxId || !folders.includes(folder)) return;
	emailStore.fetchEmails(mailboxId, { folder }).catch(() => {});
};

// Track field changes for debounced autosaving
watch([to, cc, bcc, subject, body], () => {
	if (populating) return;
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

let draftLoadSeq = 0;
const isLoadingDraftAttachments = ref(false);
/**
 * The fetch of a reopened draft's files. Until it is done the composer does not hold them, so a
 * save waits for it and Send stays off: either would otherwise replace the stored draft with a copy
 * that has no attachments.
 */
let draftAttachmentsLoad: Promise<void> | null = null;

const blobToBase64 = (blob: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result || "");
			resolve(result.split(",")[1] || "");
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});

/**
 * A reopened draft is filled from the stored draft, fetched here, not from the list row it was
 * opened from. That row can be older than the last autosave, and saving and sending both name the
 * draft's id: starting from the row would put the old recipients and text back over the newer ones.
 * Its files come with it. Inline images get a local blob URL so the editor can show them; it's
 * swapped back to `cid:` on send/save like freshly pasted images.
 */
const loadDraft = async (draft: any) => {
	if (!currentMailbox.value) return;
	const mailboxId = (route.params.mailboxId as string) || currentMailbox.value.id;
	const token = ++draftLoadSeq;
	const stillCurrent = () =>
		token === draftLoadSeq && isComposeModalOpen.value && currentDraftId.value === draft.id;
	isLoadingDraftAttachments.value = true;
	try {
		const stored = (await api.getEmail(mailboxId, draft.id)).data;
		if (!stillCurrent()) return;
		// The row was stale: this is no longer a plain draft, so it must not be edited as one.
		if (stored?.folder_id !== "drafts" || ["scheduled", "sending"].includes(stored?.delivery_status)) {
			forceCloseModal();
			showInfoToast(
				stored?.delivery_status === "scheduled"
					? "This message is scheduled. Cancel the schedule to edit it."
					: "This draft has already been sent or moved.",
			);
			refreshListIfShowing(mailboxId, ["drafts"]);
			return;
		}
		populate(() => {
			to.value = stored.recipient || "";
			cc.value = stored.cc || "";
			bcc.value = stored.bcc || "";
			showCc.value = !!cc.value;
			showBcc.value = !!bcc.value;
			subject.value = stored.subject === "(No Subject)" ? "" : stored.subject || "";
			body.value = stored.body || "";
		});
		isDirty.value = false;

		const meta: any[] = Array.isArray(stored.attachments) ? stored.attachments : [];
		if (!meta.length) return;
		const files = await Promise.all(
			meta.map(async (att: any) => {
				const res = await api.getAttachment(mailboxId, draft.id, att.id);
				const blob = res.data as Blob;
				return { att, blob, content: await blobToBase64(blob) };
			}),
		);
		if (!stillCurrent()) return;
		let html = body.value;
		for (const { att, blob, content } of files) {
			const type = att.mimetype || blob.type || "application/octet-stream";
			const cid = att.content_id ? String(att.content_id).replace(/^<|>$/g, "") : "";
			if (cid && att.disposition === "inline" && html.includes(`cid:${cid}`)) {
				const localUrl = URL.createObjectURL(blob);
				html = html.split(`cid:${cid}`).join(localUrl);
				inlineAttachments.value.push({
					filename: att.filename,
					content,
					type,
					size: att.size || blob.size,
					disposition: "inline",
					contentId: `<${cid}>`,
					localUrl,
				});
			} else {
				attachments.value.push({
					filename: att.filename,
					content,
					type,
					size: att.size || blob.size,
					disposition: "attachment",
				});
			}
		}
		if (html !== body.value) populate(() => (body.value = html));
	} catch (e) {
		console.error("Failed to load draft", e);
		// Not left open half-loaded: the next save would replace the stored draft with a copy that
		// lacks whatever did not arrive (its files, or newer text). Nothing has been typed yet.
		if (stillCurrent()) {
			forceCloseModal();
			showErrorToast("Couldn't open this draft. Check your connection and try again.");
		}
	} finally {
		if (token === draftLoadSeq) isLoadingDraftAttachments.value = false;
	}
};

/** Fill the composer for a freshly opened compose / reply / forward / draft. */
const initComposer = (options: ComposeOptions) => {
	appBindingsStore.fetchBindings();
	const original = options.originalEmail;
	const sigBlock = getSignatureBlock();

	// Per-message state must not leak from the previous composer (attachments, draft id, errors).
	draftLoadSeq++;
	isLoadingDraftAttachments.value = false;
	draftAttachmentsLoad = null;
	attachments.value = [];
	inlineAttachments.value = [];
	currentDraftId.value = null;
	error.value = null;
	draftAutosaveStatus.value = "";
	showCc.value = false;
	showBcc.value = false;
	if (autosaveTimeout) clearTimeout(autosaveTimeout);

	{
		{
			if (options.mode === "draft" && original) {
				// Shown from the list row at once, then replaced by the stored draft (see loadDraft).
				// Saving and Send stay off until that has arrived.
				currentDraftId.value = original.id;
				to.value = original.recipient || "";
				cc.value = original.cc || "";
				bcc.value = original.bcc || "";
				showCc.value = !!cc.value;
				showBcc.value = !!bcc.value;
				subject.value = original.subject === "(No Subject)" ? "" : original.subject || "";
				body.value = original.body || "";
				isDirty.value = false;
				draftAttachmentsLoad = loadDraft(original);
			} else if (options.mode === "reply" && original) {
				to.value = wasSentByMailbox(original) ? original.recipient : original.sender;
				cc.value = "";
				bcc.value = "";
				subject.value = original.subject.startsWith("Re: ")
					? original.subject
					: `Re: ${original.subject}`;
				const initialText = options.initialBody ? `${options.initialBody}<br>` : "";
				body.value = `${initialText}${sigBlock}<br><blockquote style="border-left: 2px solid #ccc; margin: 0; padding-left: 1em; color: #666;">On ${original.date}, ${original.sender} wrote:<br><br>${original.body || ""}</blockquote>`;
				isDirty.value = false;
			} else if (options.mode === "reply-all" && original) {
				to.value = wasSentByMailbox(original) ? original.recipient : original.sender;

				// Cc: everyone else on the original. Never this mailbox, nor anyone already in To.
				const taken = new Set(splitAddresses(to.value).map(addressOf));
				taken.add(ownAddress());
				const ccRecipients: string[] = [];
				for (const addr of [...splitAddresses(original.recipient), ...splitAddresses(original.cc)]) {
					const key = addressOf(addr);
					if (taken.has(key)) continue;
					taken.add(key);
					ccRecipients.push(addr);
				}

				if (ccRecipients.length > 0) {
					cc.value = ccRecipients.join(", ");
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
	}
};

/**
 * The body can hold HTML from a received email (the quote on reply / forward), so it must never be
 * assigned to innerHTML of an element of the app document: even detached, `<img onerror=…>` runs
 * there, as the signed-in user. A DOMParser document is inert — no script, handlers or loads.
 */
const htmlToPlainText = (html: string): string => {
	const text = html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<p[^>]*>/gi, "")
		.replace(/<div[^>]*>/gi, "")
		.replace(/<\/div>/gi, "\n");
	const doc = new DOMParser().parseFromString(text, "text/html");
	return (doc.body.textContent || "").trim();
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
const triggerSendFlow = async (isDraft = false) => {
	if (isDraft) {
		manualSaveDraft();
		return;
	}
	if (isCheckingSuppression.value || sendInProgress) return;

	error.value = null;
	if (!currentMailbox.value) {
		error.value = "No mailbox selected.";
		return;
	}

	if (!to.value.trim()) {
		error.value = "Please specify at least one recipient.";
		return;
	}

	// The button is off meanwhile; this is the keyboard shortcut (see draftAttachmentsLoad).
	if (isLoadingDraftAttachments.value) {
		error.value = "This draft is still loading. Try again in a moment.";
		return;
	}

	const epoch = composeEpoch;
	cancelPendingAutosave();
	isCheckingSuppression.value = true;
	const check = suppressionAcknowledged ? null : await findSuppressedRecipients();
	// A draft save that is running finishes first, so the draft it creates is the one this message
	// replaces (taken into the snapshot below) instead of being left behind in Drafts.
	while (autosaveRunning) await autosaveRunning;
	isCheckingSuppression.value = false;
	// The check can take a while. If this composer was closed meanwhile, the one on screen now holds
	// another message: going on would close that one and send this one's emptied fields. Likewise if
	// Schedule was confirmed meanwhile: the message must not go out now as well as later.
	if (epoch !== composeEpoch || sendInProgress) return;
	if (check && check.hits.length > 0) {
		suppressionBlocksSend.value = check.blocks;
		suppressionWarning.value = check.hits;
		if (isDirty.value) scheduleAutosave();
		return;
	}
	suppressionAcknowledged = false;

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

	// Only what every send endpoint accepts. The sender is the mailbox in the URL; the draft this
	// replaces is named when the message goes out (commitSend).
	const payload: any = {
		to: to.value,
		subject: subject.value || "(No subject)",
		html: finalHtml,
		text: htmlToPlainText(finalHtml),
		...draftThreading(composeOptions.value),
	};

	if (cc.value.trim()) payload.cc = cc.value;
	if (bcc.value.trim()) payload.bcc = bcc.value;
	if (allAttachments.length > 0) payload.attachments = allAttachments;

	const snapshot = takeSnapshot();
	const recipientLabel = to.value.trim().split(",")[0] || "recipient";
	pendingSend.value = {
		mailboxId,
		payload,
		mode: composeOptions.value.mode,
		originalEmailId: composeOptions.value.originalEmail?.id,
		recipientLabel,
		snapshot,
		removedDraft: snapshot.currentDraftId ? emailStore.removeLocal([snapshot.currentDraftId]) : undefined,
	};

	// The message goes out from here: no draft save after this point (see sendInProgress).
	cancelPendingAutosave();
	sendInProgress = true;

	// Start 5-second Undo buffer
	isUndoPending.value = true;
	undoCountdown.value = 5;
	uiStore.closeComposeModal();

	if (undoTimer) clearInterval(undoTimer);
	undoTimer = setInterval(() => {
		undoCountdown.value--;
		if (undoCountdown.value <= 0) {
			if (undoTimer) {
				clearInterval(undoTimer);
				undoTimer = null;
			}
			commitSend();
		}
	}, 1000);
};

const cancelUndoSend = () => {
	if (undoTimer) {
		clearInterval(undoTimer);
		undoTimer = null;
	}
	isUndoPending.value = false;
	const pending = pendingSend.value;
	pendingSend.value = null;
	if (pending) {
		settleRemovedDraft(pending, false);
		reopenWith(pending.snapshot);
	} else {
		uiStore.isComposeModalOpen = true;
	}
	showSuccessToast("Sending canceled. Draft preserved.");
};

const commitSendImmediately = () => {
	if (undoTimer) {
		clearInterval(undoTimer);
		undoTimer = null;
	}
	commitSend();
};

const commitSend = async () => {
	if (!pendingSend.value) return;
	const pending = pendingSend.value;
	pendingSend.value = null;
	isUndoPending.value = false;
	if (undoTimer) {
		clearInterval(undoTimer);
		undoTimer = null;
	}

	isLoading.value = true;
	const { mailboxId } = pending;
	const draftId = pending.snapshot.currentDraftId || undefined;
	try {
		if (pending.originalEmailId && (isReplyMode(pending.mode) || pending.mode === "forward")) {
			// The server removes the autosaved draft once the message is out, and only if that id is
			// still a draft. Deleting it from here by id also deleted the Sent copy whenever the same
			// draft had meanwhile been sent from another tab.
			const message = { ...pending.payload, draft_id: draftId };
			if (pending.mode === "forward") {
				await api.forwardEmail(mailboxId, pending.originalEmailId, message);
			} else {
				await api.replyToEmail(mailboxId, pending.originalEmailId, message);
			}
		} else {
			await emailStore.sendEmail(mailboxId, { ...pending.payload, draft_id: draftId, is_draft: false });
		}

		// The composer this message came from closed on Send, so one that is open now belongs to a
		// different message: leave it alone.
		settleRemovedDraft(pending, true);
		showSuccessToast("Email sent successfully!");
		refreshListIfShowing(mailboxId, ["sent", "drafts", "inbox"]);
	} catch (e: any) {
		settleRemovedDraft(pending, false);
		let reason = apiErrorMessage(e, "Failed to dispatch email.");
		if (isStaleDraft(e)) {
			pending.snapshot.currentDraftId = null;
			reason = STALE_DRAFT_MESSAGE;
		}
		await keepUnsentMessage(pending, reason);
	} finally {
		isLoading.value = false;
	}
};

/**
 * A send failed after its composer closed: the message must not be lost. Reopen it when that
 * overwrites nothing; if another composer is open (or the user left this mailbox), save it to
 * Drafts instead; and if that fails too, keep it behind a button on a toast that does not expire.
 */
const keepUnsentMessage = async (pending: PendingSend, reason: string) => {
	const { mailboxId, snapshot, recipientLabel } = pending;
	const canReopen = () => !uiStore.isComposeModalOpen && route.params.mailboxId === mailboxId;
	if (canReopen()) {
		showErrorToast(reason);
		reopenWith(snapshot, reason);
		return;
	}

	try {
		// A reply keeps what makes it one, or it would later go out from Drafts as a new message.
		await api.saveDraft(mailboxId, {
			...pending.payload,
			...replyThreading(snapshot.options),
			draft_id: snapshot.currentDraftId || undefined,
		});
		const where = route.params.mailboxId === mailboxId ? "Drafts" : `the Drafts of ${mailboxId}`;
		showErrorToast(`Your message to ${recipientLabel} was not sent. It is saved in ${where}. ${reason}`, 12000);
		refreshListIfShowing(mailboxId, ["drafts"]);
	} catch {
		const toastId = addToast(
			`Your message to ${recipientLabel} was not sent and could not be saved to Drafts. ${reason}`,
			"error",
			0,
			{
				label: "Reopen",
				handler: () => {
					if (!canReopen()) {
						showInfoToast(`Go to ${mailboxId} and close the message you are writing, then press Reopen.`);
						return;
					}
					removeToast(toastId);
					reopenWith(snapshot, reason);
				},
			},
		);
	}
};

const handleScheduleSend = async (isoDate: string) => {
	showScheduleModal.value = false;
	// A Send that is still waiting on its do-not-contact check counts too (see triggerSendFlow).
	if (sendInProgress || isCheckingSuppression.value) return;
	error.value = null;
	if (!currentMailbox.value) {
		error.value = "No mailbox selected.";
		return;
	}
	if (!to.value.trim()) {
		error.value = "Please specify at least one recipient.";
		return;
	}

	// No draft save may overlap the request (see sendInProgress); one that is already running
	// finishes first, so the request names the draft it created.
	const epoch = composeEpoch;
	cancelPendingAutosave();
	sendInProgress = true;
	isLoading.value = true;
	try {
		while (autosaveRunning) await autosaveRunning;
		if (epoch !== composeEpoch) return;

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
			draft_id: currentDraftId.value || undefined,
			to: to.value,
			subject: subject.value || "(No subject)",
			html: finalHtml,
			text: htmlToPlainText(finalHtml),
			is_draft: false,
			send_at: isoDate,
			...draftThreading(composeOptions.value),
			...replyThreading(composeOptions.value),
		};
		if (cc.value.trim()) payload.cc = cc.value;
		if (bcc.value.trim()) payload.bcc = bcc.value;
		if (allAttachments.length > 0) payload.attachments = allAttachments;

		await emailStore.sendEmail(mailboxId, payload);
		// Only this composer: if it is no longer the one on screen, another message is open there.
		if (epoch === composeEpoch) forceCloseModal();
		showSuccessToast(`Email scheduled for ${new Date(isoDate).toLocaleString()}`);
		refreshListIfShowing(mailboxId, ["sent", "drafts", "inbox"]);
	} catch (e: any) {
		// The composer is still open with the message; the banner keeps the reason once the toast is gone.
		let msg = apiErrorMessage(e, "Failed to schedule email.");
		if (isStaleDraft(e)) {
			currentDraftId.value = null;
			msg = STALE_DRAFT_MESSAGE;
		}
		error.value = msg;
		showErrorToast(msg);
		if (isDirty.value) scheduleAutosave();
	} finally {
		isLoading.value = false;
		sendInProgress = false;
	}
};

const formatBytes = (bytes: number, decimals = 1) => {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

// Fill the composer when it opens or its options change. Keep this the LAST statement of setup:
// `immediate` runs it right here (the component is mounted with v-if, so it is already open), and
// everything it reaches — initComposer, draftLoadSeq, commitSendImmediately — is a const / let that
// must be initialised by then. Further up it threw "Cannot access … before initialization" and
// every Reply, Forward and draft opened empty.
watch(
	[isComposeModalOpen, composeOptions],
	([isOpen, options], [wasOpen]) => {
		if (isOpen && options) {
			// Another message from here on: whatever was still waiting to send the previous one stops.
			composeEpoch++;
			sendInProgress = false;
			const restore = uiStore.takeComposeRestore();
			if (restore) {
				populate(() => applySnapshot(restore.snapshot));
				error.value = restore.error || null;
				return;
			}
			// Starting another message while the previous one waits out its undo window: send it now
			// (otherwise its Undo would have to overwrite what you're writing).
			if (isUndoPending.value && !wasOpen) commitSendImmediately();
			populate(() => initComposer(options));
			// Text moved here from the quick-reply box is in no draft yet: closing must not drop it silently.
			if (options.initialBodyUnsaved) isDirty.value = true;
		}
	},
	// Not deep: the options object is replaced whenever a message is opened. Watching inside it
	// refilled the composer (dropping what was typed) whenever the quoted message changed in place,
	// e.g. when a star request on it finished.
	{ immediate: true },
);
</script>

<style scoped>
/* Phones: bottom lane above the nav, left of the compose FAB (right 1.25rem + 3.5rem wide + 1rem gap). */
.undo-send-bar {
  bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px));
  right: 5.75rem;
}
@media (min-width: 640px) {
  .undo-send-bar {
    bottom: 1.5rem;
    right: 1.5rem;
  }
}
</style>
