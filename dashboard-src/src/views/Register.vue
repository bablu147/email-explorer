<template>
	<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
		<div class="max-w-md w-full">
			<div class="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-3xl p-8 sm:p-10 shadow-xl transition-colors">
				<!-- Brand Header -->
				<div class="flex flex-col items-center text-center mb-8">
					<div class="flex items-center gap-3 mb-4">
						<svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="shadow-sm">
							<rect width="32" height="32" rx="7" fill="#0A0F0C"/>
							<text x="16" y="22" text-anchor="middle" font-family="'Inter', sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">R</text>
							<path d="M 22.5 9 L 25 9 L 25 11.5" stroke="#4ED49B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<div class="flex items-center gap-1.5">
							<span class="font-extrabold text-xl text-gray-900 dark:text-white tracking-tight">Reflect</span>
							<span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Mail</span>
						</div>
					</div>

					<h2 class="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
						Create your account
					</h2>
					<p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
						Deploy your MMP mail client & outreach pipeline
					</p>
				</div>

				<div v-if="!isRegistrationEnabled()" class="text-center py-6">
					<p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Registration Disabled</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 mb-5">Public registration is currently closed. Please contact your workspace administrator.</p>
					<router-link to="/login" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
						&larr; Return to Sign In
					</router-link>
				</div>

				<div v-else>
					<!-- Alerts -->
					<div v-if="authStore.error" class="mb-5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3.5 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>{{ authStore.error }}</span>
					</div>

					<div v-if="successMessage" class="mb-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3.5 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<span>{{ successMessage }}</span>
					</div>

					<form class="space-y-4" @submit.prevent="handleRegister">
						<div>
							<label for="email" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
								Email address
							</label>
							<input
								id="email"
								v-model="email"
								type="email"
								required
								autocomplete="email"
								placeholder="you@company.com"
								class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
							/>
						</div>

						<div>
							<label for="password" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
								Password (min 8 characters)
							</label>
							<input
								id="password"
								v-model="password"
								type="password"
								required
								minlength="8"
								autocomplete="new-password"
								placeholder="••••••••"
								class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
							/>
						</div>

						<div>
							<label for="confirm-password" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
								Confirm password
							</label>
							<input
								id="confirm-password"
								v-model="confirmPassword"
								type="password"
								required
								autocomplete="new-password"
								placeholder="••••••••"
								class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
							/>
							<p v-if="password && confirmPassword && password !== confirmPassword" class="mt-1 text-xs text-red-500 font-medium">
								Passwords do not match
							</p>
						</div>

						<div class="pt-2">
							<button
								type="submit"
								:disabled="authStore.loading || password !== confirmPassword"
								class="w-full py-2.5 px-4 text-sm font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<svg v-if="authStore.loading" class="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								<span>{{ authStore.loading ? "Creating account..." : "Create Account" }}</span>
							</button>
						</div>
					</form>

					<div class="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800/80 text-center text-xs text-gray-500 dark:text-gray-400">
						Already have an account?
						<router-link to="/login" class="font-bold text-emerald-600 dark:text-emerald-400 hover:underline ml-1">
							Sign in &rarr;
						</router-link>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAppSettings } from "@/composables/useAppSettings";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const { isRegistrationEnabled } = useAppSettings();

const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const successMessage = ref("");

async function handleRegister() {
	if (password.value !== confirmPassword.value) {
		return;
	}

	try {
		await authStore.register(email.value, password.value);
		successMessage.value = "Account created! Redirecting to workspace...";
		setTimeout(() => {
			router.push("/");
		}, 1000);
	} catch (error) {
		// Error is handled by store
	}
}
</script>
