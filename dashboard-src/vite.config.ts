import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue(), vueJsx(), vueDevTools()],
	build: {
		outDir: "../dashboard",
		emptyOutDir: true,
		rollupOptions: {
			output: {
				manualChunks: {
					tiptap: [
						"@tiptap/vue-3",
						"@tiptap/starter-kit",
						"@tiptap/extension-link",
						"@tiptap/extension-image",
						"@tiptap/extension-color",
						"@tiptap/extension-highlight",
						"@tiptap/extension-text-align",
						"@tiptap/extension-text-style",
						"@tiptap/extension-underline",
					],
				},
			},
		},
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
});
