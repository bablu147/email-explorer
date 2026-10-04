<template>
	<div class="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent mb-1.5 tracking-tight">
					Admin Panel
				</h1>
				<p class="text-sm text-gray-600 dark:text-gray-400">Manage users and who can open which mailbox</p>
			</div>
			<router-link
				to="/"
				class="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
			>
				← Back to Mailboxes
			</router-link>
		</div>

		<!-- Register New User Section -->
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-8 border border-gray-200 dark:border-gray-700">
			<h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Register New User</h2>
			<form @submit.prevent="handleRegisterUser" class="space-y-4">
				<div v-if="registerError" role="alert" class="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
					<p class="text-xs sm:text-sm text-red-800 dark:text-red-300">{{ registerError }}</p>
				</div>
				<div v-if="registerSuccess" role="status" class="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-500/20">
					<p class="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">{{ registerSuccess }}</p>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="new-email" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
							Email Address
						</label>
						<input
							id="new-email"
							v-model="newUser.email"
							type="email"
							required
							class="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-900/50 dark:border-gray-600 dark:text-white"
							placeholder="user@example.com"
						/>
					</div>
					<div>
						<label for="new-password" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
							Password
						</label>
						<input
							id="new-password"
							v-model="newUser.password"
							type="password"
							required
							:minlength="PASSWORD_MIN"
							:maxlength="PASSWORD_MAX"
							autocomplete="new-password"
							class="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-900/50 dark:border-gray-600 dark:text-white"
							placeholder="Min 8 characters"
						/>
					</div>
				</div>
				<button
					type="submit"
					:disabled="registerLoading"
					class="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:opacity-50 transition-all font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg cursor-pointer"
				>
					{{ registerLoading ? "Creating..." : "Create User" }}
				</button>
			</form>
		</div>

		<!-- Users List -->
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-8 border border-gray-200 dark:border-gray-700">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-bold text-gray-900 dark:text-white">Users</h2>
				<button
					@click="loadUsers"
					:disabled="usersLoading"
					class="px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50 cursor-pointer"
				>
					{{ usersLoading ? "Loading..." : "Refresh" }}
				</button>
			</div>

			<!-- What the server said when it refused an action (the last admin, your own account, ...) -->
			<div v-if="actionError" role="alert" class="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800 flex items-start justify-between gap-3">
				<p class="text-xs sm:text-sm text-red-800 dark:text-red-300">{{ actionError }}</p>
				<button type="button" @click="actionError = ''" class="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline cursor-pointer flex-shrink-0">Dismiss</button>
			</div>

			<div v-if="usersLoading && users.length === 0" class="text-center py-8 text-gray-500 text-sm">
				Loading users...
			</div>

			<!-- A failed load is not an empty list -->
			<div v-else-if="usersError" role="alert" class="text-center py-8 text-sm text-red-700 dark:text-red-300">
				{{ usersError }}
				<button type="button" @click="loadUsers" class="ml-2 font-semibold underline cursor-pointer">Retry</button>
			</div>

			<div v-else-if="users.length === 0" class="text-center py-8 text-gray-500 text-sm">
				No users found
			</div>

			<div v-else class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead>
						<tr>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mailbox access</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
						<tr
							v-for="user in users"
							:key="user.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors align-top"
							:class="{ 'opacity-60': user.disabled }"
						>
							<td class="px-4 py-3 text-sm">
								<div class="font-semibold text-gray-900 dark:text-gray-100">{{ user.email }}</div>
								<div class="mt-1 flex flex-wrap items-center gap-1.5">
									<span v-if="user.isAdmin" class="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-500/15 dark:text-emerald-300 rounded-full border border-emerald-500/25">
										Admin
									</span>
									<span v-else class="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded-full">
										User
									</span>
									<span v-if="user.disabled" class="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-red-700 bg-red-500/10 dark:text-red-300 rounded-full border border-red-500/25">
										Disabled
									</span>
									<span v-if="isSelf(user)" class="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-500/10 dark:text-sky-300 rounded-full border border-sky-500/25">
										You
									</span>
								</div>
							</td>
							<td class="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
								<p v-if="user.isAdmin" class="text-gray-500 dark:text-gray-400">Every mailbox (admin)</p>
								<ul v-if="grantsOf(user).length > 0" class="space-y-1">
									<li v-for="grant in grantsOf(user)" :key="grant.mailboxId" class="flex items-center gap-1.5">
										<span class="font-medium">{{ mailboxLabel(grant.mailboxId) }}</span>
										<span class="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">{{ roleLabel(grant.role) }}</span>
									</li>
								</ul>
								<p v-else-if="!user.isAdmin" class="text-gray-400 dark:text-gray-500 italic">No mailboxes</p>
							</td>
							<td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
								{{ formatDate(user.createdAt) }}
							</td>
							<td class="px-4 py-3 text-xs">
								<div class="flex flex-wrap gap-x-3 gap-y-1.5">
									<button type="button" @click="openAccessModal(user)" :disabled="busyUserId === user.id" class="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50 cursor-pointer">
										Mailbox access
									</button>
									<!-- Your own password is changed with the current one, typed twice: a slip here would lock you out. -->
									<button v-if="isSelf(user)" type="button" @click="isChangePasswordOpen = true" class="font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer">
										Change password
									</button>
									<button v-else type="button" @click="openResetPassword(user)" :disabled="busyUserId === user.id" class="font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white disabled:opacity-50 cursor-pointer">
										Reset password
									</button>
									<button type="button" @click="confirmRevokeSessions(user)" :disabled="busyUserId === user.id" class="font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white disabled:opacity-50 cursor-pointer">
										Sign out everywhere
									</button>
									<!-- Not offered on your own account: the server refuses them, and they could lock the last admin out. -->
									<template v-if="!isSelf(user)">
										<button v-if="user.isAdmin" type="button" @click="confirmSetAdmin(user, false)" :disabled="busyUserId === user.id" class="font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white disabled:opacity-50 cursor-pointer">
											Remove admin
										</button>
										<button v-else type="button" @click="confirmSetAdmin(user, true)" :disabled="busyUserId === user.id" class="font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white disabled:opacity-50 cursor-pointer">
											Make admin
										</button>
										<button v-if="user.disabled" type="button" @click="setDisabled(user, false)" :disabled="busyUserId === user.id" class="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50 cursor-pointer">
											Enable
										</button>
										<button v-else type="button" @click="confirmDisable(user)" :disabled="busyUserId === user.id" class="font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 disabled:opacity-50 cursor-pointer">
											Disable
										</button>
										<button type="button" @click="confirmDelete(user)" :disabled="busyUserId === user.id" class="font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 cursor-pointer">
											Delete
										</button>
									</template>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Access Management Modal -->
		<div
			v-if="accessUser"
			class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
			@click.self="closeAccessModal"
			@keydown.esc="closeAccessModal"
		>
			<div
				ref="accessDialog"
				tabindex="-1"
				class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150 focus:outline-none"
				role="dialog"
				aria-modal="true"
				aria-labelledby="access-modal-title"
			>
				<div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
					<h3 id="access-modal-title" class="text-lg font-bold text-gray-900 dark:text-white">
						Mailbox access for <span class="text-emerald-600 dark:text-emerald-400 break-all">{{ accessUser.email }}</span>
					</h3>
					<button
						type="button"
						@click="closeAccessModal"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 cursor-pointer"
						aria-label="Close"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="p-6 space-y-6">
					<div v-if="accessError" role="alert" class="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
						<p class="text-xs text-red-800 dark:text-red-300">{{ accessError }}</p>
					</div>

					<p v-if="accessUser.isAdmin" class="text-xs text-gray-600 dark:text-gray-400">
						This user is an admin and can already open and change every mailbox. The grants below only matter once admin is removed.
					</p>

					<!-- What the user holds now -->
					<div>
						<h4 class="text-sm font-bold text-gray-900 dark:text-white mb-3">Mailboxes this user can open</h4>
						<p v-if="grantsOf(accessUser).length === 0" class="text-xs text-gray-500 dark:text-gray-400 italic">None yet.</p>
						<ul v-else class="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl">
							<li v-for="grant in grantsOf(accessUser)" :key="grant.mailboxId" class="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
								<span class="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 break-all min-w-0">{{ mailboxLabel(grant.mailboxId) }}</span>
								<div class="flex items-center gap-2 flex-shrink-0">
									<select
										:value="grant.role"
										@change="changeRole(grant, $event)"
										:disabled="accessLoading"
										:aria-label="`Role on ${mailboxLabel(grant.mailboxId)}`"
										class="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-900/50 dark:border-gray-600 dark:text-white disabled:opacity-50"
									>
										<option v-for="role in ROLES" :key="role.value" :value="role.value">{{ role.label }}</option>
									</select>
									<button
										type="button"
										@click="confirmRevoke(grant)"
										:disabled="accessLoading"
										class="px-2.5 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 cursor-pointer"
									>
										Revoke
									</button>
								</div>
							</li>
						</ul>
					</div>

					<!-- Grant Access Form -->
					<div>
						<h4 class="text-sm font-bold text-gray-900 dark:text-white mb-3">Grant access to a mailbox</h4>
						<p v-if="mailboxesError" role="alert" class="text-xs text-red-700 dark:text-red-300">
							{{ mailboxesError }}
							<button type="button" @click="loadMailboxes" class="ml-1 font-semibold underline cursor-pointer">Retry</button>
						</p>
						<p v-else-if="grantableMailboxes.length === 0" class="text-xs text-gray-500 dark:text-gray-400 italic">
							{{ mailboxes.length === 0 ? "There are no mailboxes yet." : "This user already has a grant on every mailbox." }}
						</p>
						<form v-else @submit.prevent="handleGrantAccess" class="space-y-4">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label for="grant-mailbox" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
										Mailbox
									</label>
									<select
										id="grant-mailbox"
										ref="grantMailboxSelect"
										v-model="accessForm.mailboxId"
										required
										class="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-900/50 dark:border-gray-600 dark:text-white"
									>
										<option value="" disabled>Choose a mailbox</option>
										<option v-for="mailbox in grantableMailboxes" :key="mailbox.id" :value="mailbox.id">
											{{ mailbox.name && mailbox.name !== mailbox.email ? `${mailbox.name} (${mailbox.email})` : mailbox.email }}
										</option>
									</select>
								</div>
								<div>
									<label for="grant-role" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
										Role
									</label>
									<select
										id="grant-role"
										v-model="accessForm.role"
										required
										class="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-900/50 dark:border-gray-600 dark:text-white"
									>
										<option v-for="role in ROLES" :key="role.value" :value="role.value">{{ role.label }}</option>
									</select>
								</div>
							</div>
							<button
								type="submit"
								:disabled="accessLoading || !accessForm.mailboxId"
								class="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 font-bold text-xs disabled:opacity-50 transition-all shadow-sm cursor-pointer"
							>
								{{ accessLoading ? "Saving..." : "Grant Access" }}
							</button>
						</form>
					</div>

					<!-- Role Descriptions: what the server enforces for each role -->
					<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
						<h4 class="text-xs font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wider">What each role allows</h4>
						<ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
							<li v-for="role in ROLES" :key="role.value">
								<strong class="text-gray-900 dark:text-gray-200">{{ role.label }}:</strong> {{ role.allows }}
							</li>
						</ul>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
							Creating and deleting mailboxes, and everything on this page, is for admins only.
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Reset another user's password -->
		<Teleport to="body">
			<div
				v-if="resetUser"
				class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
				@click.self="closeResetPassword"
				@keydown.esc="closeResetPassword"
			>
				<div
					class="w-full max-w-md bg-white dark:bg-gray-900 border-t sm:border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 transition-colors animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
					role="dialog"
					aria-modal="true"
					aria-labelledby="reset-password-title"
				>
					<h3 id="reset-password-title" class="text-base font-bold text-gray-900 dark:text-white mb-1">Reset password</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400 mb-4 break-all">{{ resetUser.email }}</p>
					<form @submit.prevent="handleResetPassword">
						<label for="reset-password-input" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
							New password
						</label>
						<!-- Shown as typed: you have to pass it on to the user, and a mistyped hidden one helps nobody -->
						<input
							id="reset-password-input"
							ref="resetPasswordInput"
							v-model="resetPasswordValue"
							type="text"
							required
							:minlength="PASSWORD_MIN"
							:maxlength="PASSWORD_MAX"
							autocomplete="off"
							autocapitalize="off"
							spellcheck="false"
							aria-describedby="reset-password-hint"
							class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base sm:text-sm text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
						/>
						<p id="reset-password-hint" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
							{{ PASSWORD_MIN }} to {{ PASSWORD_MAX }} characters. Give it to the user; they can change it from their account menu.
						</p>
						<p v-if="resetError" role="alert" class="text-xs text-red-600 dark:text-red-400 font-medium mt-2">{{ resetError }}</p>
						<div class="flex items-center justify-end gap-2.5 mt-5">
							<button
								type="button"
								@click="closeResetPassword"
								class="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
							>
								Cancel
							</button>
							<button
								type="submit"
								:disabled="resetSaving"
								class="px-4 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{{ resetSaving ? "Saving..." : "Set password" }}
							</button>
						</div>
					</form>
				</div>
			</div>
		</Teleport>

		<ChangePasswordModal
			:is-open="isChangePasswordOpen"
			:email="authStore.currentUser?.email"
			@close="isChangePasswordOpen = false"
		/>

		<!-- One confirmation for every action that takes something away -->
		<ConfirmModal
			:is-open="pendingConfirm !== null"
			:title="pendingConfirm?.title || ''"
			:message="pendingConfirm?.message || ''"
			:confirm-text="pendingConfirm?.confirmText"
			:danger="pendingConfirm?.danger"
			:loading="confirmLoading"
			@close="pendingConfirm = null"
			@confirm="runPendingConfirm"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ChangePasswordModal from "@/components/ChangePasswordModal.vue";
import ConfirmModal from "@/components/ConfirmModal.vue";
import { useToast } from "@/composables/useToast";
import api, { apiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { Mailbox, MailboxRole } from "@/types";

interface Grant {
	mailboxId: string;
	role: MailboxRole;
}

interface User {
	id: string;
	email: string;
	isAdmin: boolean;
	disabled?: boolean;
	createdAt: number;
	updatedAt: number;
	mailboxes?: Grant[];
}

// The server's limits; it checks them again.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 256;

// What the server enforces on /api/v1/mailboxes/:mailboxId for each role. Admin and Owner are the
// same there. Keep these sentences in step with the role check in src/worker.ts.
const ROLES: { value: MailboxRole; label: string; allows: string }[] = [
	{ value: "read", label: "Read", allows: "View only. Can open and search mail; cannot send, move, delete or mark anything." },
	{ value: "write", label: "Write", allows: "Read, plus send and organise mail: compose, reply, forward, drafts, move, snooze, schedule, folders and contacts." },
	{ value: "admin", label: "Admin", allows: "Write, plus change the mailbox settings." },
	{ value: "owner", label: "Owner", allows: "The same as Admin: write, plus change the mailbox settings." },
];
const DEFAULT_ROLE: MailboxRole = "write";

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

// Check if user is admin
if (!authStore.isAdmin) {
	router.push("/");
}

// Register User State
const newUser = ref({ email: "", password: "" });
const registerLoading = ref(false);
const registerError = ref("");
const registerSuccess = ref("");

// Users List State
const users = ref<User[]>([]);
const usersLoading = ref(false);
const usersError = ref("");
const actionError = ref("");
/** The user whose row action is running: its buttons are disabled meanwhile. */
const busyUserId = ref("");

// Mailboxes, for the picker and to show a grant by name
const mailboxes = ref<Mailbox[]>([]);
const mailboxesError = ref("");

// Access Management State. The user is looked up by id, so the modal follows a reload of the list.
const accessUserId = ref("");
const accessUser = computed(() => users.value.find((user) => user.id === accessUserId.value) || null);
const accessForm = ref<{ mailboxId: string; role: MailboxRole }>({ mailboxId: "", role: DEFAULT_ROLE });
const accessLoading = ref(false);
const accessError = ref("");
const accessDialog = ref<HTMLElement | null>(null);
const grantMailboxSelect = ref<HTMLSelectElement | null>(null);

// Reset Password State
const resetUser = ref<User | null>(null);
const resetPasswordValue = ref("");
const resetPasswordInput = ref<HTMLInputElement | null>(null);
const resetSaving = ref(false);
const resetError = ref("");

const isChangePasswordOpen = ref(false);

// Confirmation State
interface PendingConfirm {
	title: string;
	message: string;
	confirmText: string;
	danger: boolean;
	run: () => Promise<unknown>;
}
const pendingConfirm = ref<PendingConfirm | null>(null);
const confirmLoading = ref(false);

onMounted(() => {
	loadUsers();
	loadMailboxes();
});

const isSelf = (user: User) => user.id === authStore.currentUser?.id;
const grantsOf = (user: User): Grant[] => user.mailboxes || [];
const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label || role;

// A grant made before this release can spell the address in another letter case than the mailbox id.
const sameMailbox = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const mailboxLabel = (mailboxId: string) => {
	const mailbox = mailboxes.value.find((m) => sameMailbox(m.id, mailboxId));
	if (!mailbox) return mailboxId;
	return mailbox.name && mailbox.name !== mailbox.email ? `${mailbox.name} (${mailbox.email})` : mailbox.email;
};
/** Mailboxes the open user has no grant on yet: the picker offers only these. */
const grantableMailboxes = computed(() => {
	const user = accessUser.value;
	if (!user) return [];
	return mailboxes.value.filter((m) => !grantsOf(user).some((g) => sameMailbox(g.mailboxId, m.id)));
});

async function handleRegisterUser() {
	registerLoading.value = true;
	registerError.value = "";
	registerSuccess.value = "";

	try {
		await api.adminRegisterUser(newUser.value.email, newUser.value.password);
		registerSuccess.value = `User ${newUser.value.email} created. Grant them a mailbox below.`;
		newUser.value = { email: "", password: "" };
		await loadUsers();
	} catch (error: any) {
		registerError.value = apiErrorMessage(error, "Failed to create user");
	} finally {
		registerLoading.value = false;
	}
}

async function loadUsers() {
	usersLoading.value = true;
	usersError.value = "";
	try {
		const response = await api.adminListUsers();
		users.value = Array.isArray(response.data) ? response.data : [];
	} catch (error: any) {
		usersError.value = apiErrorMessage(error, "The users could not be loaded.");
	} finally {
		usersLoading.value = false;
	}
}

async function loadMailboxes() {
	mailboxesError.value = "";
	try {
		const response = await api.listMailboxes();
		mailboxes.value = Array.isArray(response.data) ? response.data : [];
	} catch (error: any) {
		mailboxesError.value = apiErrorMessage(error, "The mailboxes could not be loaded.");
	}
}

/**
 * One change to a user. The server's own sentence is shown when it refuses (409 for the last
 * active admin or your own account, 400, 404), and the list is reloaded either way.
 */
async function changeUser(user: User, change: () => Promise<unknown>, done: string, fallback: string) {
	busyUserId.value = user.id;
	actionError.value = "";
	try {
		await change();
		toast.success(done);
	} catch (error: any) {
		actionError.value = apiErrorMessage(error, fallback);
	} finally {
		busyUserId.value = "";
		await loadUsers();
	}
}

async function runPendingConfirm() {
	const pending = pendingConfirm.value;
	if (!pending || confirmLoading.value) return;
	confirmLoading.value = true;
	try {
		await pending.run();
	} finally {
		confirmLoading.value = false;
		pendingConfirm.value = null;
	}
}

function setDisabled(user: User, disabled: boolean) {
	return changeUser(
		user,
		() => api.adminUpdateUser(user.id, { disabled }),
		disabled ? `${user.email} is disabled and signed out.` : `${user.email} can sign in again.`,
		disabled ? "The user could not be disabled." : "The user could not be enabled.",
	);
}

function confirmDisable(user: User) {
	pendingConfirm.value = {
		title: "Disable this user?",
		message: `${user.email} is signed out and cannot sign in until you enable the account again. Their mailbox grants are kept.`,
		confirmText: "Disable",
		danger: true,
		run: () => setDisabled(user, true),
	};
}

function confirmSetAdmin(user: User, isAdmin: boolean) {
	pendingConfirm.value = {
		title: isAdmin ? "Make this user an admin?" : "Remove admin?",
		message: isAdmin
			? `${user.email} will be able to open and change every mailbox, and to manage users on this page.`
			: `${user.email} will keep only the mailboxes granted to them.`,
		confirmText: isAdmin ? "Make admin" : "Remove admin",
		danger: !isAdmin,
		run: () =>
			changeUser(
				user,
				() => api.adminUpdateUser(user.id, { isAdmin }),
				isAdmin ? `${user.email} is now an admin.` : `${user.email} is no longer an admin.`,
				"The admin setting could not be changed.",
			),
	};
}

function confirmRevokeSessions(user: User) {
	pendingConfirm.value = {
		title: "Sign out everywhere?",
		message: isSelf(user)
			? "Every session of your account is ended, this one included: you will have to sign in again."
			: `Every session of ${user.email} is ended. They can sign in again with their password.`,
		confirmText: "Sign out everywhere",
		danger: true,
		run: () =>
			changeUser(
				user,
				() => api.adminRevokeUserSessions(user.id),
				`${user.email} was signed out everywhere.`,
				"The sessions could not be ended.",
			),
	};
}

function confirmDelete(user: User) {
	pendingConfirm.value = {
		title: "Delete this user?",
		message: `${user.email} is removed with their sessions and mailbox grants. The mailboxes and their mail are not touched. This can't be undone.`,
		confirmText: "Delete user",
		danger: true,
		run: () =>
			changeUser(user, () => api.adminDeleteUser(user.id), `${user.email} was deleted.`, "The user could not be deleted."),
	};
}

function openResetPassword(user: User) {
	resetUser.value = user;
	resetPasswordValue.value = "";
	resetError.value = "";
	nextTick(() => resetPasswordInput.value?.focus());
}

function closeResetPassword() {
	if (!resetSaving.value) resetUser.value = null;
}

async function handleResetPassword() {
	const user = resetUser.value;
	if (!user || resetSaving.value) return;
	const password = resetPasswordValue.value;
	if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
		resetError.value = `The password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`;
		return;
	}
	resetSaving.value = true;
	resetError.value = "";
	try {
		await api.adminUpdateUser(user.id, { password });
		toast.success(`The password of ${user.email} was changed.`);
		resetUser.value = null;
	} catch (error: any) {
		resetError.value = apiErrorMessage(error, "The password could not be changed.");
	} finally {
		resetSaving.value = false;
	}
}

function openAccessModal(user: User) {
	accessUserId.value = user.id;
	accessForm.value = { mailboxId: "", role: DEFAULT_ROLE };
	accessError.value = "";
	// Focus inside the dialog: for keyboard users, and so that Esc reaches it. The picker is not
	// there when the user already holds every mailbox, so the dialog itself is the fallback.
	nextTick(() => (grantMailboxSelect.value ?? accessDialog.value)?.focus());
}

function closeAccessModal() {
	accessUserId.value = "";
	accessForm.value = { mailboxId: "", role: DEFAULT_ROLE };
	accessError.value = "";
}

/** One change to the open user's grants; the list is reloaded so the modal shows what the server holds. */
async function changeAccess(change: () => Promise<unknown>, done: string, fallback: string) {
	accessLoading.value = true;
	accessError.value = "";
	try {
		await change();
		toast.success(done);
	} catch (error: any) {
		accessError.value = apiErrorMessage(error, fallback);
	} finally {
		await loadUsers();
		accessLoading.value = false;
	}
}

async function handleGrantAccess() {
	const user = accessUser.value;
	const { mailboxId, role } = accessForm.value;
	if (!user || !mailboxId) return;
	await changeAccess(
		() => api.adminGrantAccess(user.id, mailboxId, role),
		`${user.email} now has ${roleLabel(role)} access to ${mailboxLabel(mailboxId)}.`,
		"Failed to grant access",
	);
	if (!accessError.value) accessForm.value = { mailboxId: "", role: DEFAULT_ROLE };
}

// Granting again with another role changes the role: the server keeps one grant per user and mailbox.
async function changeRole(grant: Grant, event: Event) {
	const select = event.target as HTMLSelectElement;
	const role = select.value;
	const user = accessUser.value;
	if (!user || role === grant.role) return;
	await changeAccess(
		() => api.adminGrantAccess(user.id, grant.mailboxId, role),
		`${user.email} now has ${roleLabel(role)} access to ${mailboxLabel(grant.mailboxId)}.`,
		"Failed to change the role",
	);
	// Refused: the grant still has its old role, so the control goes back to it.
	if (accessError.value) select.value = grant.role;
}

function confirmRevoke(grant: Grant) {
	const user = accessUser.value;
	if (!user) return;
	pendingConfirm.value = {
		title: "Revoke access?",
		message: `${user.email} will no longer be able to open ${mailboxLabel(grant.mailboxId)}.`,
		confirmText: "Revoke",
		danger: true,
		run: () =>
			changeAccess(
				() => api.adminRevokeAccess(user.id, grant.mailboxId),
				`${user.email} can no longer open ${mailboxLabel(grant.mailboxId)}.`,
				"Failed to revoke access",
			),
	};
}

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
</script>
