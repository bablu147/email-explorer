<template>
  <div v-if="isComposeModalOpen" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all flex flex-col max-h-[92vh]">
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
            class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center gap-1.5"
            title="Preview full email as recipients will see it"
          >
            <svg class="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </button>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg p-1.5 transition-all">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="send(false)" class="p-6 overflow-y-auto flex-grow flex flex-col space-y-4">
        <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-800 dark:text-red-300 px-4 py-2.5 rounded-lg text-sm flex items-start gap-3" role="alert">
          <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <span class="block sm:inline">{{ error }}</span>
        </div>

        <!-- To field with Cc / Bcc expanders & App Linking -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label for="to" class="block text-xs font-bold text-gray-700 dark:text-gray-300">To</label>
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
                <span>{{ toAppBinding ? '📱 ' + toAppBinding.app_name : '📱 Link App' }}</span>
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
          <input 
            type="text" 
            id="to" 
            v-model="to" 
            class="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 dark:text-gray-100 px-3.5 py-2 text-sm transition-all duration-150" 
            placeholder="recipient@example.com (comma separated for multiple)"
            required 
          />

          <!-- Linked App Identity Card -->
          <div
            v-if="toAppBinding"
            class="mt-2.5 p-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-transparent border border-emerald-500/30 dark:border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200 shadow-xs"
          >
            <div class="flex items-center gap-3 min-w-0">
              <!-- App Icon -->
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

              <!-- App Details -->
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-gray-900 dark:text-white text-sm truncate">
                    {{ toAppBinding.app_name }}
                  </span>
                  <!-- Platform pill -->
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border flex items-center gap-1"
                    :class="toAppBinding.platform === 'playstore' 
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                      : toAppBinding.platform === 'appstore'
                      ? 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30'
                      : 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30'"
                  >
                    <component :is="getPlatformIcon(toAppBinding.platform)" class="w-3 h-3" />
                    <span>{{ formatPlatform(toAppBinding.platform) }}</span>
                  </span>
                </div>
                <p class="text-gray-500 dark:text-gray-400 text-xs truncate mt-0.5">
                  <span v-if="toAppBinding.developer_name">by <span class="font-medium text-gray-700 dark:text-gray-300">{{ toAppBinding.developer_name }}</span> · </span>
                  <span class="font-mono text-[11px] text-gray-600 dark:text-gray-400">{{ cleanToEmail }}</span>
                </p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Insert link button -->
              <button
                type="button"
                @click="insertAppLink"
                class="px-2.5 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-500/25 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Insert link to this app into email message"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>Insert Link</span>
              </button>

              <!-- Visit Store Link -->
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

              <!-- Edit binding -->
              <button
                type="button"
                @click="handleOpenLinkAppModal"
                class="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                title="Edit or change app binding"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Prompt to Link App if unlinked -->
          <div
            v-else-if="cleanToEmail"
            class="mt-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/40 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
          >
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-400/80"></span>
              <span>No app or website linked to <span class="font-mono font-medium text-gray-700 dark:text-gray-300">{{ cleanToEmail }}</span> yet</span>
            </div>
            <button
              type="button"
              @click="handleOpenLinkAppModal"
              class="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold hover:underline cursor-pointer flex items-center gap-1.5"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Link App or Website</span>
            </button>
          </div>
        </div>

        <!-- Cc Field (Collapsible) -->
        <div v-if="showCc" class="animate-fadeIn">
          <label for="cc" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
            <span>Cc</span>
            <button type="button" @click="showCc = false" class="text-gray-400 hover:text-gray-600 text-[11px]">Hide</button>
          </label>
          <input 
            type="text" 
            id="cc" 
            v-model="cc" 
            class="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 dark:text-gray-100 px-3.5 py-2 text-sm transition-all duration-150" 
            placeholder="colleague@example.com"
          />
        </div>

        <!-- Bcc Field (Collapsible) -->
        <div v-if="showBcc" class="animate-fadeIn">
          <label for="bcc" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
            <span>Bcc</span>
            <button type="button" @click="showBcc = false" class="text-gray-400 hover:text-gray-600 text-[11px]">Hide</button>
          </label>
          <input 
            type="text" 
            id="bcc" 
            v-model="bcc" 
            class="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 dark:text-gray-100 px-3.5 py-2 text-sm transition-all duration-150" 
            placeholder="hidden-recipient@example.com"
          />
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

        <!-- Message Body -->
        <div class="flex-grow flex flex-col">
          <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
          <RichTextEditor v-model="body" />
        </div>

        <!-- Attachments Tray -->
        <div v-if="attachments.length > 0" class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/30">
          <div class="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
            <span>Attachments ({{ attachments.length }})</span>
            <span :class="totalAttachmentSize > 25 * 1024 * 1024 ? 'text-red-500 font-bold' : 'text-gray-500'">
              Total: {{ formatBytes(totalAttachmentSize) }} / 25 MB limit
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(att, index) in attachments"
              :key="index"
              class="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 text-xs shadow-sm"
            >
              <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span class="max-w-[200px] truncate font-medium text-gray-800 dark:text-gray-200">{{ att.filename }}</span>
              <span class="text-gray-400 text-[11px]">({{ formatBytes(att.size) }})</span>
              <button
                type="button"
                @click="removeAttachment(index)"
                class="text-gray-400 hover:text-red-500 ml-1 rounded p-0.5 transition-colors"
                title="Remove attachment"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <!-- Attachment Button & Helpers -->
          <div class="flex items-center gap-2">
            <input
              type="file"
              multiple
              ref="fileInputRef"
              @change="onFilesSelected"
              class="hidden"
            />
            <button
              type="button"
              @click="triggerFileInput"
              class="px-3 py-2 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Attach files or documents"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Attach Files
            </button>

            <button
              type="button"
              @click="send(true)"
              :disabled="isLoading || !subject"
              class="px-3 py-2 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              title="Save to Drafts"
            >
              Save Draft
            </button>

            <button
              type="button"
              @click="handleOpenLinkAppModal"
              class="px-3 py-2 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              :title="toAppBinding ? `Manage linked app (${toAppBinding.app_name})` : 'Link recipient to App Store, Play Store, or Website'"
            >
              <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>{{ toAppBinding ? toAppBinding.app_name : 'Link App' }}</span>
            </button>
          </div>

          <!-- Primary Actions -->
          <div class="flex items-center gap-3">
            <button 
              type="button" 
              @click="closeModal" 
              class="px-4 py-2 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="isLoading || totalAttachmentSize > 25 * 1024 * 1024"
              class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="!isLoading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <svg v-else class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isLoading ? 'Sending...' : 'Send Message' }}
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
                class="px-2 py-0.5 rounded transition-all"
              >
                Desktop
              </button>
              <button
                type="button"
                @click="previewDevice = 'mobile'"
                :class="previewDevice === 'mobile' ? 'bg-white dark:bg-gray-800 font-bold text-emerald-500' : 'text-gray-500'"
                class="px-2 py-0.5 rounded transition-all"
              >
                Mobile (375px)
              </button>
            </div>
          </div>
          <button @click="showPreviewModal = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
            ✕
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
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
          >
            Back to Editor
          </button>
        </div>
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
const error = ref<string | null>(null);
const isLoading = ref(false);
const showPreviewModal = ref(false);
const previewDevice = ref<"desktop" | "mobile">("desktop");
const fileInputRef = ref<HTMLInputElement | null>(null);

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
			return "Website";
	}
};

const cleanToEmail = computed(() => extractCleanEmail(to.value));

const toAppBinding = computed(() => {
	if (!cleanToEmail.value) return null;
	return appBindingsStore.getBinding(cleanToEmail.value);
});

const onBindingImgError = (event: Event) => {
	const img = event.target as HTMLImageElement;
	if (img.dataset.hasError) return;
	img.dataset.hasError = "true";
	if (toAppBinding.value?.platform === "playstore") {
		img.src = "https://www.google.com/s2/favicons?domain=play.google.com&sz=128";
	} else if (toAppBinding.value?.platform === "appstore") {
		img.src = "https://www.google.com/s2/favicons?domain=apple.com&sz=128";
	} else {
		try {
			const u = new URL(toAppBinding.value?.app_url || "");
			img.src = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
		} catch {
			img.src = "https://www.google.com/s2/favicons?domain=reflect.cloud&sz=128";
		}
	}
};

const handleOpenLinkAppModal = () => {
	const email = cleanToEmail.value || to.value.trim();
	appBindingsStore.openLinkModal(email, toAppBinding.value);
};

const insertAppLink = () => {
	if (!toAppBinding.value) return;
	const linkHtml = `<p><strong>App:</strong> <a href="${toAppBinding.value.app_url}" target="_blank" rel="noopener noreferrer">${toAppBinding.value.app_name}</a></p>`;
	body.value = (body.value || "") + linkHtml;
	showSuccessToast(`Inserted link to ${toAppBinding.value.app_name}`);
};

// When an app binding is saved in the modal, if compose recipient was empty, auto-populate it
watch(
	() => appBindingsStore.lastLinkedEmail,
	(linkedEmail) => {
		if (isComposeModalOpen.value && linkedEmail) {
			if (!to.value.trim()) {
				to.value = linkedEmail;
			}
		}
	},
);

const modalTitle = computed(() => {
	switch (composeOptions.value.mode) {
		case "reply":
			return "Reply";
		case "reply-all":
			return "Reply All";
		case "forward":
			return "Forward";
		default:
			return "New Message";
	}
});

const totalAttachmentSize = computed(() => {
	return attachments.value.reduce((acc, att) => acc + att.size, 0);
});

const formatBytes = (bytes: number) => {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const triggerFileInput = () => {
	fileInputRef.value?.click();
};

const onFilesSelected = (e: Event) => {
	const target = e.target as HTMLInputElement;
	const files = target.files;
	if (!files || files.length === 0) return;

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const reader = new FileReader();
		reader.onload = (event) => {
			const result = event.target?.result as string;
			if (result) {
				// Strip data prefix: "data:application/pdf;base64," -> pure base64
				const base64Data = result.split(",")[1] || result;
				attachments.value.push({
					filename: file.name,
					content: base64Data,
					type: file.type || "application/octet-stream",
					size: file.size,
					disposition: "attachment",
				});
			}
		};
		reader.readAsDataURL(file);
	}
	target.value = "";
};

const removeAttachment = (index: number) => {
	attachments.value.splice(index, 1);
};

const closeModal = () => {
	error.value = null;
	to.value = "";
	cc.value = "";
	bcc.value = "";
	showCc.value = false;
	showBcc.value = false;
	subject.value = "";
	body.value = "";
	attachments.value = [];
	showPreviewModal.value = false;
	uiStore.closeComposeModal();
};

// Build signature HTML block if enabled
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

// Watch for compose modal opening and pre-populate fields
watch(isComposeModalOpen, (isOpen) => {
	if (isOpen) {
		appBindingsStore.fetchBindings();
		const options = composeOptions.value;
		const original = options.originalEmail;
		const sigBlock = getSignatureBlock();

		if (options.mode === "reply" && original) {
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
		} else {
			to.value = "";
			cc.value = "";
			bcc.value = "";
			subject.value = "";
			body.value = sigBlock ? `<br><br>${sigBlock}` : "";
		}
	}
});

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

const send = async (isDraft = false) => {
	error.value = null;
	if (!currentMailbox.value) {
		error.value = "No mailbox selected.";
		return;
	}

	if (!isDraft && !to.value.trim()) {
		error.value = "Please specify at least one recipient.";
		return;
	}

	isLoading.value = true;
	try {
		const mailboxId = route.params.mailboxId as string;
		const emailData: any = {
			to: to.value,
			from: currentMailbox.value.email,
			subject: subject.value,
			html: body.value,
			text: htmlToPlainText(body.value),
			is_draft: isDraft,
		};

		if (cc.value.trim()) emailData.cc = cc.value;
		if (bcc.value.trim()) emailData.bcc = bcc.value;
		if (attachments.value.length > 0) emailData.attachments = attachments.value;

		if (
			!isDraft &&
			(composeOptions.value.mode === "reply" || composeOptions.value.mode === "reply-all")
		) {
			const originalEmailId = composeOptions.value.originalEmail?.id;
			if (originalEmailId) {
				await api.replyToEmail(mailboxId, originalEmailId, emailData);
			} else {
				throw new Error("Original email not found");
			}
		} else if (!isDraft && composeOptions.value.mode === "forward") {
			const originalEmailId = composeOptions.value.originalEmail?.id;
			if (originalEmailId) {
				await api.forwardEmail(mailboxId, originalEmailId, emailData);
			} else {
				throw new Error("Original email not found");
			}
		} else {
			await emailStore.sendEmail(mailboxId, emailData);
		}

		closeModal();
		showSuccessToast(isDraft ? "Draft saved successfully!" : "Email sent successfully!");
	} catch (e: any) {
		const errorMessage =
			e.response?.data?.error || "An unexpected error occurred.";
		error.value = errorMessage;
		showErrorToast(errorMessage);
	} finally {
		isLoading.value = false;
	}
};
</script>
