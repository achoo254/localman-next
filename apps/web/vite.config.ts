import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 5173,
		strictPort: true,
		// Same-origin API calls in development, like production behind nginx.
		proxy: {
			"/api": "http://localhost:4000",
			"/auth": "http://localhost:4000",
		},
	},
	build: {
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
});
