/**
 * `vite preview` for the E2E build of the web app. The app's own preview
 * proxies the API paths (`/api`, `/auth`, Localman MCP) to the dev API port
 * (4000); this config points them at the E2E API so the browser stays on
 * one origin, as in production.
 */
import { fileURLToPath } from "node:url";
import { apiProxy } from "../../apps/web/src/config/dev-api-proxy.js";
import { PORTS } from "./ports.js";

const API = `http://127.0.0.1:${PORTS.api}`;

export default {
	root: fileURLToPath(new URL("../../apps/web", import.meta.url)),
	// Relative to `root`, the same directory `vite build` writes (see stack.ts).
	build: { outDir: "../../e2e/.web-dist" },
	preview: {
		host: "127.0.0.1",
		port: PORTS.web,
		strictPort: true,
		proxy: apiProxy(API),
	},
};
