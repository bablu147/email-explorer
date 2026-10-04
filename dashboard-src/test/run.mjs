// Runs the dashboard tests: `npm test` in dashboard-src. No browser, no network, a few seconds.
//
// Each suite is bundled with esbuild (installed as part of vite) and then run by Node's own test
// runner. `@/…` imports resolve to src/ as in the app, except for the modules a suite replaces with
// a stub from ./stubs. A .vue file under test is reduced to its <script setup>, compiled by the Vue
// compiler as in the build, but with the bindings returned from setup() so that a test can read and
// drive them. Every other .vue import is an empty component: nothing is rendered.
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compileScript, parse } from "@vue/compiler-sfc";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const src = path.join(root, "src");
const outDir = path.join(root, "node_modules/.tmp/test");
const stub = (name) => path.join(here, "stubs", name);

const suites = [
	{
		entry: "composer.test.ts",
		underTest: "components/ComposeEmail.vue",
		stubs: {
			"@/services/api": stub("api.ts"),
			"@/composables/useToast": stub("toast.ts"),
			"vue-router": stub("router.ts"),
		},
	},
	{
		entry: "api.test.ts",
		stubs: { axios: stub("axios.ts") },
	},
];

const plugin = (suite) => ({
	name: "dashboard-test",
	setup(b) {
		const underTest = suite.underTest ? path.join(src, suite.underTest) : null;

		b.onResolve({ filter: /.*/ }, (args) => {
			if (suite.stubs[args.path]) return { path: suite.stubs[args.path] };
			if (underTest && args.path === `@/${suite.underTest}`) return { path: underTest, namespace: "sfc-script" };
			if (args.path.endsWith(".vue")) return { path: stub("component.ts") };
			if (args.path.startsWith("@/")) {
				return b.resolve(`./${args.path.slice(2)}`, { resolveDir: src, kind: args.kind });
			}
			return undefined;
		});

		b.onLoad({ filter: /.*/, namespace: "sfc-script" }, (args) => {
			const { descriptor, errors } = parse(readFileSync(args.path, "utf8"), { filename: args.path });
			if (errors.length > 0) throw errors[0];
			const script = compileScript(descriptor, { id: "under-test", inlineTemplate: false, sourceMap: true });
			// The compiler's source map, so that a stack trace names the line in the .vue file.
			const map = script.map
				? `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(script.map)).toString("base64")}`
				: "";
			return { contents: script.content + map, loader: "ts", resolveDir: path.dirname(args.path) };
		});
	},
});

mkdirSync(outDir, { recursive: true });
process.setSourceMapsEnabled(true);

// Everything is bundled before any test runs: the tests replace the global timers.
const bundles = [];
for (const suite of suites) {
	const outfile = path.join(outDir, suite.entry.replace(/\.ts$/, ".mjs"));
	await build({
		entryPoints: [path.join(here, suite.entry)],
		outfile,
		bundle: true,
		format: "esm",
		platform: "node",
		sourcemap: "inline",
		logLevel: "warning",
		// The production build of Vue, as deployed: there, an error thrown inside a watcher is logged
		// and setup carries on, which is how the composer came to open empty.
		define: { "process.env.NODE_ENV": '"production"' },
		plugins: [plugin(suite)],
	});
	bundles.push(outfile);
}

// Importing a bundle registers its tests; Node runs them and sets the exit code.
for (const bundle of bundles) await import(pathToFileURL(bundle).href);
