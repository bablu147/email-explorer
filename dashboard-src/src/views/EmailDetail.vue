<template>
  <div v-if="email" class="flex-1 flex flex-col min-h-full bg-white dark:bg-gray-900 transition-colors">
    <!-- Email Header -->
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 bg-white dark:bg-gray-900">
      <div class="flex items-center justify-between mb-5 gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <button 
            @click="handleBack" 
            class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all duration-200 group relative cursor-pointer flex-shrink-0" 
            title="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <h1 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate tracking-tight">{{ email.subject || "(No subject)" }}</h1>
        </div>

        <!-- Top Actions Toolbar -->
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <!-- Follow-up action for Sent emails -->
          <button 
            v-if="isSentEmail" 
            @click="handleReply" 
            class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow cursor-pointer"
            title="Send follow-up message to this recipient"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>Follow-up</span>
          </button>

          <!-- Reply -->
          <button 
            v-else 
            @click="handleReply" 
            class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer" 
            title="Reply (pop-up)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Reply All -->
          <button 
            @click="handleReplyAll" 
            class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer" 
            title="Reply All"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
          </button>

          <!-- Forward -->
          <button 
            @click="handleForward" 
            class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer" 
            title="Forward"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 9H7a5 5 0 00-5 5v2a1 1 0 11-2 0v-2a7 7 0 017-7h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Read/Unread -->
          <button 
            @click="toggleReadStatus" 
            class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer" 
            :title="email.read ? 'Mark as unread' : 'Mark as read'"
          >
            <svg v-if="email.read" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </button>

          <!-- Star -->
          <button 
            @click="toggleStarStatus" 
            class="p-2 text-gray-500 hover:text-yellow-500 dark:text-gray-400 dark:hover:text-yellow-400 rounded-xl hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all cursor-pointer" 
            :class="{'text-yellow-500 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20': email.starred}" 
            :title="email.starred ? 'Unstar' : 'Star'"
          >
            <svg v-if="email.starred" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>

          <!-- Move to folder -->
          <div class="relative" ref="moveMenu">
            <button 
              @click="isMoveMenuOpen = !isMoveMenuOpen" 
              class="p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer" 
              title="Move to folder"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
            </button>
            <div v-if="isMoveMenuOpen" class="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-20 border border-gray-200 dark:border-gray-700 overflow-hidden py-1">
              <button 
                v-for="folder in moveToFolders" 
                :key="folder.id" 
                @click="handleMove(folder.id)" 
                class="block w-full text-left px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors font-medium cursor-pointer"
              >
                {{ folder.name }}
              </button>
            </div>
          </div>

          <!-- Delete -->
          <button 
            @click="handleDelete" 
            class="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer" 
            title="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Identity & Recipient Details -->
      <div class="flex items-center justify-between mt-4">
        <div class="flex items-center gap-3">
          <AppAvatar
            :email="isSentEmail ? email.recipient : email.sender"
            :initial="((isSentEmail ? email.recipient : email.sender) || '?').charAt(0).toUpperCase()"
            size="lg"
          />
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">{{ email.sender }}</p>
              <AppBadge :email="email.sender" />
            </div>
            <div class="flex items-center gap-2 flex-wrap mt-0.5">
              <span class="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">To</span>
              <span class="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white" style="color: var(--fg) !important;">{{ email.recipient }}</span>
              <AppBadge :email="email.recipient" />
              <span 
                v-if="email.delivery_status === 'spam' || fromFolder === 'spam'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
              >
                ⚠️ Placed in Spam
              </span>
              <span 
                v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
              >
                ✓ Delivered to Inbox
              </span>
            </div>
            <p v-if="email.cc" class="text-xs text-gray-700 dark:text-gray-300 mt-1 font-medium">
              <span class="font-bold text-gray-500 dark:text-gray-400">Cc:</span> {{ email.cc }}
            </p>
            <p v-if="email.bcc" class="text-xs text-gray-700 dark:text-gray-300 mt-0.5 font-medium">
              <span class="font-bold text-gray-500 dark:text-gray-400">Bcc:</span> {{ email.bcc }} (hidden)
            </p>
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap" :title="formatTooltipDate(email.date)">
          {{ formatFriendlyDate(email.date) }}
        </p>
      </div>

      <!-- Engagement & Tracking Stats Bar (Sent Emails) -->
      <div v-if="isSentEmail" class="mt-4 pt-3.5 border-t border-gray-200 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 flex-wrap">
          <!-- Delivery Status & Placement -->
          <span 
            v-if="email.delivery_status === 'spam' || fromFolder === 'spam'"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
            title="Warning: Routed to recipient spam folder"
          >
            <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Delivered · Spam Folder
          </span>
          <span 
            v-else-if="email.opened_count && email.opened_count > 0"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
            title="Confirmed primary inbox delivery with recipient open activity"
          >
            <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            Delivered · Primary Inbox
          </span>
          <span 
            v-else
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
            title="Delivered to recipient inbox"
          >
            <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            Delivered · Inbox
          </span>

          <!-- Open / View Tracking -->
          <span 
            v-if="email.opened_count && email.opened_count > 0"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
            :title="email.opened_at ? 'First viewed: ' + formatTooltipDate(email.opened_at) : 'Recipient opened this email'"
          >
            <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Viewed {{ email.opened_count }} time{{ email.opened_count > 1 ? 's' : '' }}
            <span v-if="email.opened_at" class="font-normal text-gray-500 text-[11px] ml-0.5">({{ formatFriendlyDate(email.opened_at) }})</span>
          </span>
          <span 
            v-else
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
            title="Awaiting recipient to open"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
            Not viewed yet
          </span>

          <!-- Link Click Tracking -->
          <span 
            v-if="email.clicked_count && email.clicked_count > 0"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
            :title="email.clicked_at ? 'Links clicked ' + email.clicked_count + 'x (last: ' + formatTooltipDate(email.clicked_at) + ')' : 'Links clicked'"
          >
            <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {{ email.clicked_count }} Link Click{{ email.clicked_count > 1 ? 's' : '' }}
            <span v-if="email.clicked_at" class="font-normal text-gray-500 text-[11px] ml-0.5">({{ formatFriendlyDate(email.clicked_at) }})</span>
          </span>
          <span 
            v-else
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 text-[11px]"
          >
            No link clicks yet
          </span>
        </div>

        <div class="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Tracking
        </div>
      </div>
    </div>

    <!-- Email Body Iframe -->
    <div class="flex-grow min-h-[350px]">
      <EmailIframe :body="emailBodyWithInlineImages" />
    </div>

    <!-- Attachments Section (if present) -->
    <div v-if="email.attachments && email.attachments.length > 0" class="p-5 sm:p-7 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50/70 dark:bg-gray-900/30">
      <h2 class="text-sm font-bold text-gray-900 dark:text-white mb-3.5 flex items-center gap-2">
        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span>Attachments ({{ email.attachments.length }})</span>
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div v-for="attachment in email.attachments" :key="attachment.id" class="group bg-white dark:bg-gray-800 rounded-xl p-3 flex items-center justify-between border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-sm transition-all duration-200">
          <div class="w-0 flex-grow mr-3 min-w-0">
            <p class="text-xs font-semibold text-gray-900 dark:text-white truncate">{{ attachment.filename }}</p>
            <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ formatBytes(attachment.size) }}</p>
          </div>
          <a :href="getAttachmentUrl(attachment.id)" target="_blank" class="flex-shrink-0 p-2 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer" title="Download">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </a>
        </div>
      </div>
    </div>

    <!-- ⚡ Inline Quick Reply Card: Docked at bottom of Email Detail View -->
    <div class="p-5 sm:p-7 border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 flex-shrink-0">
      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <!-- Reply Card Header -->
        <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between bg-gray-50/40 dark:bg-gray-800/40">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">
              Reply to <span class="text-emerald-600 dark:text-emerald-400 font-extrabold">{{ isSentEmail ? email.recipient : email.sender }}</span>
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <!-- Pop out to full ComposeEmail modal button -->
            <button
              type="button"
              @click="popOutToFullCompose"
              class="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Pop out to full compose window"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span class="hidden sm:inline">Pop out</span>
            </button>
          </div>
        </div>

        <!-- Reply Text Area -->
        <div class="p-4">
          <textarea
            v-model="quickReplyText"
            @keydown="handleQuickReplyKeyDown"
            placeholder="Write a quick reply... (Press ⌘ + Enter or Ctrl + Enter to send)"
            rows="3"
            class="w-full bg-transparent border-0 focus:ring-0 p-0 text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-y min-h-[75px] focus:outline-none"
          ></textarea>
        </div>

        <!-- Reply Card Footer Toolbar -->
        <div class="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/80 flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-[11px] text-gray-400">
            <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded font-mono text-[10px]">⌘</kbd>
            <span>+</span>
            <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded font-mono text-[10px]">Enter</kbd>
            <span class="hidden sm:inline">to send</span>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="quickReplyText.trim()"
              type="button"
              @click="quickReplyText = ''"
              class="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Clear
            </button>

            <button
              type="button"
              @click="sendQuickReply"
              :disabled="isSendingQuickReply || !quickReplyText.trim()"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg v-if="!isSendingQuickReply" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ isSendingQuickReply ? 'Sending...' : 'Send Reply' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Loading Skeleton State -->
  <div v-else-if="loading" class="flex-1 flex flex-col p-6 animate-pulse bg-white dark:bg-gray-900">
    <div class="h-6 bg-gray-200 dark:bg-gray-800 rounded-lg w-2/3 mb-4"></div>
    <div class="h-10 bg-gray-100 dark:bg-gray-800/60 rounded-xl mb-6"></div>
    <div class="space-y-3 flex-1">
      <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
      <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
      <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-4/6"></div>
    </div>
  </div>

  <!-- Not Found State -->
  <div v-else class="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-gray-900">
    <div class="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mb-3">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-1">Conversation Not Found</h3>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">This message may have been deleted, archived, or moved.</p>
    <button @click="handleBack" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer">
      &larr; Back to List
    </button>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmailIframe from "@/components/EmailIframe.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import AppBadge from "@/components/AppBadge.vue";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { useEmailStore } from "@/stores/emails";
import { useFolderStore } from "@/stores/folders";
import { useMailboxStore } from "@/stores/mailboxes";
import { useUIStore } from "@/stores/ui";
import { extractCleanEmail } from "@/stores/appBindings";

const emailStore = useEmailStore();
const { currentEmail: email } = storeToRefs(emailStore);
const folderStore = useFolderStore();
const { folders } = storeToRefs(folderStore);
const mailboxStore = useMailboxStore();
const { currentMailbox } = storeToRefs(mailboxStore);
const uiStore = useUIStore();
const route = useRoute();
const router = useRouter();
const { success: showSuccessToast, error: showErrorToast } = useToast();

const loading = ref(true);
const isMoveMenuOpen = ref(false);
const moveMenu = ref<HTMLElement | null>(null);

const quickReplyText = ref("");
const isSendingQuickReply = ref(false);

const handleClickOutside = (event: MouseEvent) => {
	if (moveMenu.value && !moveMenu.value.contains(event.target as Node)) {
		isMoveMenuOpen.value = false;
	}
};

const handleKeyDown = (e: KeyboardEvent) => {
	const activeElement = document.activeElement;
	const tagName = activeElement?.tagName?.toLowerCase();
	const isEditable = (activeElement as HTMLElement)?.isContentEditable;
	if (tagName === "input" || tagName === "textarea" || tagName === "select" || isEditable) {
		return;
	}

	if (uiStore.isComposeModalOpen) {
		return;
	}

	if (e.key === "Escape" || e.key === "u") {
		e.preventDefault();
		handleBack();
		return;
	}

	if (e.key === "e" || e.key === "E") {
		e.preventDefault();
		handleMove("archive");
		return;
	}

	if (e.key === "d" || e.key === "D" || e.key === "#") {
		e.preventDefault();
		handleDelete();
		return;
	}

	if (e.key === "s" || e.key === "S") {
		e.preventDefault();
		toggleStarStatus();
		return;
	}

	if (e.key === "r" || e.key === "R") {
		e.preventDefault();
		handleReply();
		return;
	}
};

watch(isMoveMenuOpen, (isOpen) => {
	if (isOpen) {
		document.addEventListener("click", handleClickOutside);
	} else {
		document.removeEventListener("click", handleClickOutside);
	}
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", handleKeyDown);
	document.removeEventListener("click", handleClickOutside);
});

const moveToFolders = computed(() => {
	const fromFolder = route.query.fromFolder as string;
	return folders.value.filter((folder) => folder.id !== fromFolder);
});

const emailBodyWithInlineImages = computed(() => {
	if (!email.value || !email.value.body) {
		return "";
	}

	let body = email.value.body;
	if (email.value.attachments && email.value.attachments.length > 0) {
		for (const attachment of email.value.attachments) {
			if (attachment.disposition === "inline" && attachment.content_id) {
				const url = getAttachmentUrl(attachment.id);
				const cid = attachment.content_id.startsWith("<")
					? attachment.content_id.slice(1, -1)
					: attachment.content_id;
				const regex = new RegExp(`cid:${cid}`, "g");
				body = body.replace(regex, url);
			}
		}
	}

	return body;
});

const fromFolder = computed(() => route.query.fromFolder as string);
const isSentEmail = computed(() => {
	if (!email.value) return false;
	return fromFolder.value === "sent" || (email.value.opened_count !== undefined && email.value.opened_count !== null);
});

const formatFriendlyDate = (dateStr?: string): string => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return dateStr;

	const now = new Date();
	const isToday =
		date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	if (isToday) {
		return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
	}

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	const isYesterday =
		date.getDate() === yesterday.getDate() &&
		date.getMonth() === yesterday.getMonth() &&
		date.getFullYear() === yesterday.getFullYear();

	if (isYesterday) {
		return `Yesterday, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
	}

	if (date.getFullYear() === now.getFullYear()) {
		return date.toLocaleDateString([], {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	}

	return date.toLocaleDateString([], {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};

const formatTooltipDate = (dateStr?: string): string => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return dateStr;
	return date.toLocaleString([], {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	});
};

const getAttachmentUrl = (attachmentId: string) => {
	const mailboxId = route.params.mailboxId as string;
	const emailId = route.params.id as string;
	return `/api/v1/mailboxes/${mailboxId}/emails/${emailId}/attachments/${attachmentId}`;
};

const formatBytes = (bytes: number, decimals = 2) => {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

onMounted(async () => {
	window.addEventListener("keydown", handleKeyDown);
	const mailboxId = route.params.mailboxId as string;
	const emailId = route.params.id as string;

	loading.value = true;
	try {
		await emailStore.fetchEmail(mailboxId, emailId);
		folderStore.fetchFolders(mailboxId);
		if (!currentMailbox.value || currentMailbox.value.id !== mailboxId) {
			await mailboxStore.fetchMailbox(mailboxId);
		}

		if (email.value && !email.value.read) {
			await emailStore.updateEmail(mailboxId, emailId, { read: true });
			folderStore.fetchFolders(mailboxId);
		}
	} finally {
		loading.value = false;
	}
});

const handleBack = () => {
	if (window.history.length > 1) {
		router.back();
	} else {
		router.push({
			name: "EmailList",
			params: {
				mailboxId: route.params.mailboxId,
				folder: fromFolder.value || "inbox",
			},
		});
	}
};

const toggleReadStatus = async () => {
	if (email.value) {
		const mailboxId = route.params.mailboxId as string;
		await emailStore.updateEmail(mailboxId, email.value.id, {
			read: !email.value.read,
		});
		folderStore.fetchFolders(mailboxId);
	}
};

const toggleStarStatus = () => {
	if (email.value) {
		emailStore.updateEmail(route.params.mailboxId as string, email.value.id, {
			starred: !email.value.starred,
		});
	}
};

const handleMove = (targetFolderId: string) => {
	if (email.value) {
		emailStore.moveEmail(
			route.params.mailboxId as string,
			email.value.id,
			targetFolderId,
		);
		isMoveMenuOpen.value = false;
		folderStore.fetchFolders(route.params.mailboxId as string);
		handleBack();
	}
};

const handleDelete = () => {
	if (email.value && confirm("Are you sure you want to delete this email?")) {
		const mailboxId = route.params.mailboxId as string;
		emailStore.deleteEmail(mailboxId, email.value.id);
		folderStore.fetchFolders(mailboxId);
		router.push({
			name: "EmailList",
			params: { mailboxId, folder: "inbox" },
		});
	}
};

const handleReply = () => {
	if (email.value) {
		uiStore.openComposeModal({ mode: "reply", originalEmail: email.value });
	}
};

const handleReplyAll = () => {
	if (email.value) {
		uiStore.openComposeModal({ mode: "reply-all", originalEmail: email.value });
	}
};

const handleForward = () => {
	if (email.value) {
		uiStore.openComposeModal({ mode: "forward", originalEmail: email.value });
	}
};

// ⚡ Quick Reply Actions
const handleQuickReplyKeyDown = (e: KeyboardEvent) => {
	if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
		e.preventDefault();
		sendQuickReply();
	}
};

const popOutToFullCompose = () => {
	if (email.value) {
		uiStore.openComposeModal({
			mode: "reply",
			originalEmail: email.value,
			initialBody: quickReplyText.value.trim(),
		});
		quickReplyText.value = "";
	}
};

const sendQuickReply = async () => {
	if (!email.value || !quickReplyText.value.trim() || isSendingQuickReply.value) return;

	isSendingQuickReply.value = true;
	const mailboxId = route.params.mailboxId as string;
	const rawTarget = isSentEmail.value ? email.value.recipient : email.value.sender;
	const cleanTo = extractCleanEmail(rawTarget) || rawTarget;
	const cleanFrom = currentMailbox.value?.email || extractCleanEmail(email.value.recipient);
	const textContent = quickReplyText.value.trim();
	const htmlContent = `<p>${textContent.replace(/\n/g, "<br>")}</p>`;
	const replySubject = email.value.subject.startsWith("Re: ")
		? email.value.subject
		: `Re: ${email.value.subject}`;

	try {
		const replyPayload = {
			to: cleanTo,
			from: cleanFrom,
			subject: replySubject,
			text: textContent,
			html: htmlContent,
			is_draft: false,
		};

		await api.replyToEmail(mailboxId, email.value.id, replyPayload);
		quickReplyText.value = "";
		showSuccessToast("Reply sent successfully!");
		await emailStore.fetchEmail(mailboxId, email.value.id);
		folderStore.fetchFolders(mailboxId);
	} catch (err: any) {
		const msg = err.response?.data?.error || "Failed to send reply";
		showErrorToast(msg);
	} finally {
		isSendingQuickReply.value = false;
	}
};
</script>
