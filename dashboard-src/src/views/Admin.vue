<template>
	<div class="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent mb-1.5 tracking-tight">
					Admin Panel
				</h1>
				<p class="text-sm text-gray-600 dark:text-gray-400">Manage user credentials and mailbox security permissions</p>
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
				<div v-if="registerError" class="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
					<p class="text-xs sm:text-sm text-red-800 dark:text-red-300">{{ registerError }}</p>
				</div>
				<div v-if="registerSuccess" class="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-500/20">
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
							minlength="8"
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
				<h2 class="text-lg font-bold text-gray-900 dark:text-white">Active Users</h2>
				<button
					@click="loadUsers"
					:disabled="usersLoading"
					class="px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50 cursor-pointer"
				>
					{{ usersLoading ? "Loading..." : "Refresh" }}
				</button>
			</div>

			<div v-if="usersLoading && users.length === 0" class="text-center py-8 text-gray-500 text-sm">
				Loading users...
			</div>

			<div v-else-if="users.length === 0" class="text-center py-8 text-gray-500 text-sm">
				No users found
			</div>

			<div v-else class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead>
						<tr>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
						<tr v-for="user in users" :key="user.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
							<td class="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ user.email }}</td>
							<td class="px-4 py-3 text-sm">
								<span v-if="user.isAdmin" class="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-500/15 dark:text-emerald-300 rounded-full border border-emerald-500/25">
									Admin
								</span>
								<span v-else class="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded-full">
									User
								</span>
							</td>
							<td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
								{{ formatDate(user.createdAt) }}
							</td>
							<td class="px-4 py-3 text-sm">
								<button
									@click="openAccessModal(user)"
									class="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 cursor-pointer"
								>
									Manage Access
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Access Management Modal -->
		<div
			v-if="selectedUser"
			class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
			@click.self="closeAccessModal"
		>
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150">
				<div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
					<h3 class="text-lg font-bold text-gray-900 dark:text-white">
						Manage Access for <span class="text-emerald-600 dark:text-emerald-400">{{ selectedUser.email }}</span>
					</h3>
					<button
						@click="closeAccessModal"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 cursor-pointer"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="p-6">
					<!-- Grant Access Form -->
					<div class="mb-6">
						<h4 class="text-sm font-bold text-gray-900 dark:text-white mb-3">Grant Mailbox Access</h4>
						<form @submit.prevent="handleGrantAccess" class="space-y-4">
							<div v-if="accessError" class="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
								<p class="text-xs text-red-800 dark:text-red-300">{{ accessError }}</p>
							</div>
							<div v-if="accessSuccess" class="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-3 border border-emerald-500/20">
								<p class="text-xs text-emerald-800 dark:text-emerald-300">{{ accessSuccess }}</p>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
										Mailbox ID / Email
									</label>
									<input
										v-model="accessForm.mailboxId"
										type="text"
										required
										class="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-900/50 dark:border-gray-600 dark:text-white"
										placeholder="user@example.com"
									/>
								</div>
								<div>
									<label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
										Role
									</label>
									<select
										v-model="accessForm.role"
										required
										class="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-900/50 dark:border-gray-600 dark:text-white"
									>
										<option value="owner">Owner</option>
										<option value="admin">Admin</option>
										<option value="write">Write</option>
										<option value="read">Read</option>
									</select>
								</div>
							</div>
							<div class="flex gap-2.5">
								<button
									type="submit"
									:disabled="accessLoading"
									class="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 font-bold text-xs disabled:opacity-50 transition-all shadow-sm cursor-pointer"
								>
									{{ accessLoading ? "Granting..." : "Grant Access" }}
								</button>
								<button
									type="button"
									@click="handleRevokeAccess"
									:disabled="accessLoading || !accessForm.mailboxId"
									class="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-xs disabled:opacity-50 transition-all cursor-pointer"
								>
									{{ accessLoading ? "Revoking..." : "Revoke Access" }}
								</button>
							</div>
						</form>
					</div>

					<!-- Role Descriptions -->
					<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
						<h4 class="text-xs font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wider">Role Permissions:</h4>
						<ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
							<li><strong class="text-gray-900 dark:text-gray-200">Owner:</strong> Full control of mailbox domain, keys, and deletion</li>
							<li><strong class="text-gray-900 dark:text-gray-200">Admin:</strong> Can configure settings, signatures, and manage member access</li>
							<li><strong class="text-gray-900 dark:text-gray-200">Write:</strong> Can compose, send, and triage incoming and outgoing emails</li>
							<li><strong class="text-gray-900 dark:text-gray-200">Read:</strong> View-only read access to message threads</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";

interface User {
	id: string;
	email: string;
	isAdmin: boolean;
	createdAt: number;
	updatedAt: number;
}

const router = useRouter();
const authStore = useAuthStore();

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

// Access Management State
const selectedUser = ref<User | null>(null);
const accessForm = ref({ mailboxId: "", role: "read" });
const accessLoading = ref(false);
const accessError = ref("");
const accessSuccess = ref("");

onMounted(() => {
	loadUsers();
});

async function handleRegisterUser() {
	registerLoading.value = true;
	registerError.value = "";
	registerSuccess.value = "";

	try {
		await api.adminRegisterUser(newUser.value.email, newUser.value.password);
		registerSuccess.value = `User ${newUser.value.email} created successfully!`;
		newUser.value = { email: "", password: "" };
		await loadUsers();
	} catch (error: any) {
		registerError.value =
			error.response?.data?.error || "Failed to create user";
	} finally {
		registerLoading.value = false;
	}
}

async function loadUsers() {
	usersLoading.value = true;
	try {
		const response = await api.adminListUsers();
		users.value = response.data;
	} catch (error: any) {
		console.error("Failed to load users:", error);
	} finally {
		usersLoading.value = false;
	}
}

function openAccessModal(user: User) {
	selectedUser.value = user;
	accessForm.value = { mailboxId: "", role: "read" };
	accessError.value = "";
	accessSuccess.value = "";
}

function closeAccessModal() {
	selectedUser.value = null;
	accessForm.value = { mailboxId: "", role: "read" };
	accessError.value = "";
	accessSuccess.value = "";
}

async function handleGrantAccess() {
	if (!selectedUser.value) return;

	accessLoading.value = true;
	accessError.value = "";
	accessSuccess.value = "";

	try {
		await api.adminGrantAccess(
			selectedUser.value.id,
			accessForm.value.mailboxId,
			accessForm.value.role,
		);
		accessSuccess.value = `Access granted successfully!`;
		accessForm.value.mailboxId = "";
	} catch (error: any) {
		accessError.value = error.response?.data?.error || "Failed to grant access";
	} finally {
		accessLoading.value = false;
	}
}

async function handleRevokeAccess() {
	if (!selectedUser.value || !accessForm.value.mailboxId) return;

	if (
		!confirm(
			`Revoke access to ${accessForm.value.mailboxId} for ${selectedUser.value.email}?`,
		)
	) {
		return;
	}

	accessLoading.value = true;
	accessError.value = "";
	accessSuccess.value = "";

	try {
		await api.adminRevokeAccess(
			selectedUser.value.id,
			accessForm.value.mailboxId,
		);
		accessSuccess.value = `Access revoked successfully!`;
		accessForm.value.mailboxId = "";
	} catch (error: any) {
		accessError.value =
			error.response?.data?.error || "Failed to revoke access";
	} finally {
		accessLoading.value = false;
	}
}

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
</script>
