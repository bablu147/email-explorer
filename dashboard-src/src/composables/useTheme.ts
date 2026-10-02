import { ref } from "vue";

export type ThemeMode = "light" | "dark";

const isDark = ref(false);

function getInitialTheme(): boolean {
	if (typeof window === "undefined") return false;
	const savedTheme = localStorage.getItem("reflect_theme");
	if (savedTheme === "dark") return true;
	if (savedTheme === "light") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTheme() {
	function initTheme() {
		if (typeof window === "undefined") return;
		isDark.value = getInitialTheme();
		applyTheme(isDark.value);
	}

	function applyTheme(dark: boolean) {
		const themeStr = dark ? "dark" : "light";
		document.documentElement.setAttribute("data-theme", themeStr);
		if (dark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}

	function toggleTheme() {
		isDark.value = !isDark.value;
		const themeStr = isDark.value ? "dark" : "light";
		localStorage.setItem("reflect_theme", themeStr);
		document.cookie = `reflect_theme=${themeStr};path=/;max-age=31536000;SameSite=Lax`;
		applyTheme(isDark.value);
	}

	return {
		isDark,
		initTheme,
		toggleTheme,
	};
}
