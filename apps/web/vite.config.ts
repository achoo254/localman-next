import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {
	type Plugin,
	type ResolvedConfig,
	createServer,
	defineConfig,
	loadEnv,
} from "vite";
import { apiProxy } from "./src/config/dev-api-proxy";
import { parseFeatureFlags } from "./src/config/feature-flags";

/**
 * Vendor chunks, so the app chunk stays small and libraries are cached
 * across deploys. Each group only loads where it is used: CodeMirror with
 * the resource modals, zod with forms that validate on the client.
 */
const VENDOR_CHUNKS: ReadonlyArray<readonly [string, RegExp]> = [
	[
		"vendor-react",
		/^(?:react|react-dom|scheduler|react-router|cookie|set-cookie-parser)$/,
	],
	["vendor-query", /^@tanstack\//],
	[
		"vendor-radix",
		/^(?:@radix-ui\/|@floating-ui\/|aria-hidden|react-remove-scroll|react-remove-scroll-bar|react-style-singleton|use-callback-ref|use-sidecar|get-nonce|detect-node-es|tslib)/,
	],
	[
		"vendor-codemirror",
		/^(?:@codemirror\/|@lezer\/|@marijn\/|style-mod|w3c-keyname|crelt)/,
	],
	["vendor-zod", /^zod$/],
];

/** Package name of a module inside node_modules (pnpm layout included). */
function packageOf(id: string): string | null {
	const index = id.lastIndexOf("/node_modules/");
	if (index === -1) return null;
	const [scope = "", name = ""] = id.slice(index + 14).split("/");
	return scope.startsWith("@") ? `${scope}/${name}` : scope;
}

function vendorChunk(id: string): string | undefined {
	const name = packageOf(id);
	if (name === null) return undefined;
	return VENDOR_CHUNKS.find(([, pattern]) => pattern.test(name))?.[0];
}

const ENTRY_SCRIPT =
	/<script type="module" crossorigin src="([^"]+)"><\/script>\s*/;
const MODULE_PRELOAD =
	/<link rel="modulepreload" crossorigin href="([^"]+)">\s*/g;

/**
 * Replaces the entry `<script>` and its `modulepreload` links with a small
 * loader. On a prerendered page (the landing "/") the markup is already
 * readable (its sign-in links are plain anchors), so the app (about
 * 185 kB) starts downloading after its first contentful paint (or 3 s, for
 * background tabs and browsers without paint timing) and leaves the
 * bandwidth to the stylesheet and fonts; every other path (whose markup the
 * inline script of index.html has dropped) loads at once. The loader is the
 * same in every prerendered file, so the CSP hashes it once per build
 * (infra/localman/csp-hashes.mjs; its asset names change with every build).
 */
function deferAppScripts(html: string): string {
	const entry = ENTRY_SCRIPT.exec(html)?.[1];
	if (!entry) throw new Error("dist/index.html has no module entry script");
	const preloads = [...html.matchAll(MODULE_PRELOAD)].map((match) => match[1]);
	const loader = `<script>(function(){function load(){${JSON.stringify(preloads)}.forEach(function(href){var link=document.createElement("link");link.rel="modulepreload";link.crossOrigin="";link.href=href;document.head.append(link)});var script=document.createElement("script");script.type="module";script.crossOrigin="";script.src=${JSON.stringify(entry)};document.head.append(script)}var started=false;function start(){if(!started){started=true;setTimeout(load)}}if(document.getElementById("app").firstElementChild){try{new PerformanceObserver(function(list){if(list.getEntriesByName("first-contentful-paint").length)start()}).observe({type:"paint",buffered:true})}catch(error){start()}setTimeout(start,3000)}else start()})()</script>`;
	return html
		.replace(ENTRY_SCRIPT, "")
		.replace(MODULE_PRELOAD, "")
		.replace("</body>", `${loader}\n\t</body>`);
}

function isFileList(
	value: unknown,
): value is Array<{ file: string; html: string }> {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every(
			(item: unknown) =>
				typeof item === "object" &&
				item !== null &&
				"file" in item &&
				typeof item.file === "string" &&
				/^[a-z-]+\.html$/.test(item.file) &&
				"html" in item &&
				typeof item.html === "string",
		)
	);
}

/**
 * After `vite build`, renders the public pages of `src/prerender.tsx` (the
 * landing into `dist/index.html`;
 * anonymous visitor, this build's flags), so their first paint does not
 * wait for JavaScript or `/users/me` and crawlers read them. `main.tsx`
 * hydrates that markup. Never runs in dev; a failure fails the build.
 */
function prerenderPages(): Plugin {
	let config: ResolvedConfig | null = null;
	return {
		name: "localman:prerender-pages",
		apply: "build",
		configResolved(resolved) {
			config = resolved;
		},
		async closeBundle() {
			if (!config || config.build.ssr) return;
			const server = await createServer({
				configFile: false,
				root: config.root,
				mode: config.mode,
				logLevel: "error",
				appType: "custom",
				server: { middlewareMode: true, hmr: false, ws: false },
			});
			try {
				const entry = await server.ssrLoadModule("/src/prerender.tsx");
				const render: unknown = entry.renderPrerenderedFiles;
				if (typeof render !== "function") {
					throw new Error(
						"src/prerender.tsx must export renderPrerenderedFiles",
					);
				}
				// `--outDir` may be absolute (resolve keeps it) or relative to the root.
				const outDir = resolve(config.root, config.build.outDir);
				const template = await readFile(join(outDir, "index.html"), "utf8");
				const files: unknown = await render(template);
				if (!isFileList(files)) {
					throw new Error("renderPrerenderedFiles returned no pages");
				}
				for (const { file, html } of files) {
					await writeFile(join(outDir, file), deferAppScripts(html));
				}
			} finally {
				await server.close();
			}
		},
	};
}

const ROOT = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
	// A misspelt feature flag stops `vite build` and the dev server here,
	// instead of failing in the browser at startup.
	parseFeatureFlags(loadEnv(mode, ROOT, "VITE_").VITE_FEATURES);
	return {
		plugins: [react(), tailwindcss(), prerenderPages()],
		// The API client's script worker imports QuickJS lazily, which needs
		// code splitting inside the worker: only the ES format allows it.
		worker: { format: "es" },
		optimizeDeps: {
			// Its WASM is found with `new URL("…wasm", import.meta.url)`, a path
			// pre-bundling would break in dev; Vite serves the file as is.
			exclude: ["@jitl/quickjs-wasmfile-release-sync"],
		},
		server: {
			port: 5173,
			strictPort: true,
			// Same-origin API calls in development, like production behind nginx.
			// Localman MCP and its OAuth metadata, for agents on PUBLIC_URL.
			proxy: apiProxy("http://localhost:4000"),
		},
		build: {
			// Fonts stay separate files: inlined as base64 they would sit in the
			// render-blocking stylesheet whether the page uses them or not.
			assetsInlineLimit: (file) =>
				file.endsWith(".woff2") ? false : undefined,
			rollupOptions: {
				output: { manualChunks: vendorChunk },
				treeshake: {
					// @localman/shared only declares constants, schemas and pure
					// functions (no module-level effects). Marking it side-effect
					// free drops unused re-exports of its root entry; light code
					// imports `@localman/shared/constants` (no zod, no Faker
					// catalog) and the resource modals `…/faker-catalog`.
					moduleSideEffects: (id) => !id.includes("/packages/shared/src/"),
				},
			},
		},
		preview: {
			port: 4173,
			strictPort: true,
		},
	};
});
