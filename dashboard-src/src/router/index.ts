import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
const Admin = () => import("@/views/Admin.vue");
const Contacts = () => import("@/views/Contacts.vue");
const DiscoverApps = () => import("@/views/DiscoverApps.vue");
const Pipeline = () => import("@/views/Pipeline.vue");
const EmailDetail = () => import("@/views/EmailDetail.vue");
const EmailList = () => import("@/views/EmailList.vue");
const ForgotPassword = () => import("@/views/ForgotPassword.vue");
const Home = () => import("@/views/Home.vue");
const Login = () => import("@/views/Login.vue");
const Mailbox = () => import("@/views/Mailbox.vue");
const NotFound = () => import("@/views/NotFound.vue");
const Register = () => import("@/views/Register.vue");
const ResetPassword = () => import("@/views/ResetPassword.vue");
const SearchResults = () => import("@/views/SearchResults.vue");
const Settings = () => import("@/views/Settings.vue");

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: "/login",
			name: "Login",
			component: Login,
			meta: { title: "Login", public: true },
		},
		{
			path: "/register",
			name: "Register",
			component: Register,
			meta: { title: "Register", public: true },
		},
		{
			path: "/forgot-password",
			name: "ForgotPassword",
			component: ForgotPassword,
			meta: { title: "Forgot Password", public: true },
		},
		{
			path: "/reset-password",
			name: "ResetPassword",
			component: ResetPassword,
			meta: { title: "Reset Password", public: true },
		},
		{
			path: "/",
			name: "Home",
			component: Home,
			meta: { title: "Home", requiresAuth: true },
		},
		{
			path: "/admin",
			name: "Admin",
			component: Admin,
			meta: { title: "Admin Panel", requiresAuth: true, requiresAdmin: true },
		},
		{
			path: "/mailbox/:mailboxId",
			name: "Mailbox",
			component: Mailbox,
			meta: { requiresAuth: true },
			redirect: (to) => {
				return {
					name: "EmailList",
					params: { mailboxId: to.params.mailboxId, folder: "inbox" },
				};
			},
			children: [
				{
					path: "emails/:folder",
					name: "EmailList",
					component: EmailList,
					meta: { title: "Emails" },
				},
				{
					path: "email/:id",
					name: "EmailDetail",
					component: EmailDetail,
					meta: { title: "Email" },
				},
				{
					path: "contacts",
					name: "Contacts",
					component: Contacts,
					meta: { title: "Contacts" },
				},
				{
					path: "settings",
					name: "Settings",
					component: Settings,
					meta: { title: "Settings" },
				},
				{
					path: "discover",
					name: "DiscoverApps",
					component: DiscoverApps,
					meta: { title: "App Discovery & MMP Outreach" },
				},
				{
					path: "pipeline",
					name: "Pipeline",
					component: Pipeline,
					meta: { title: "Outreach Pipeline" },
				},
				{
					path: "search",
					name: "SearchResults",
					component: SearchResults,
					meta: { title: "Search" },
				},
			],
		},
		{
			path: "/:pathMatch(.*)*",
			name: "NotFound",
			component: NotFound,
			meta: { title: "Not Found" },
		},
	],
});

// Navigation guard for authentication
router.beforeEach(async (to, _from, next) => {
	const authStore = useAuthStore();
	const isPublicRoute = to.meta.public === true;
	const requiresAuth = to.meta.requiresAuth !== false; // Auth required by default
	const requiresAdmin = to.meta.requiresAdmin === true;

	// The stored expiry is what the server said at the last sign-in. Past it, the server is asked
	// again (not waited for: a slow answer must not hold the page). Only its 401 signs the user
	// out; this browser's clock alone never does.
	if (authStore.session && !authStore.loading) {
		const { expiresAt } = authStore.session;
		if (expiresAt > 0 && expiresAt < Date.now()) {
			void authStore.checkAuth();
		}
	}

	if (!isPublicRoute && requiresAuth && !authStore.isAuthenticated) {
		// Redirect to login if not authenticated
		next({ name: "Login", query: { redirect: to.fullPath } });
	} else if (requiresAdmin && !authStore.isAdmin) {
		// Redirect to home if not admin
		next({ name: "Home" });
	} else if (
		isPublicRoute &&
		authStore.isAuthenticated &&
		(to.name === "Login" ||
			to.name === "Register" ||
			to.name === "ForgotPassword")
	) {
		// Redirect to home if already authenticated and trying to access login/register/forgot-password
		next({ name: "Home" });
	} else {
		next();
	}
});

router.afterEach((to) => {
	if (to.meta.title) {
		document.title = `${to.meta.title} — Reflect Mail`;
	} else {
		document.title = "Reflect Mail";
	}
});

export default router;
