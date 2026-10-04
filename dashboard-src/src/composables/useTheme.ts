import { ref } from "vue";

export type ThemeMode = "light" | "dark";

const isDark = ref(false);

function getInitialTheme(): boolean {
	if (typeof window === "undefined") return false;
	const cookieMatch = document.cookie.match(/reflect_theme=(dark|light)/);
	const cookieTheme = cookieMatch ? cookieMatch[1] : null;
	const savedTheme = localStorage.getItem("reflect_theme") || cookieTheme;
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
		const metaThemeColor = document.querySelector('meta[name="theme-color"]');
		if (metaThemeColor) {
			metaThemeColor.setAttribute("content", dark ? "#0E1117" : "#F6F8FA");
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
