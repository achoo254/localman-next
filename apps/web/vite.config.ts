import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
			treeshake: {
				// @localman/shared only declares constants, schemas and pure
				// functions. Marking it side-effect free lets the main chunk take
				// `limitsFor` without the zod schemas (and zod) it does not use;
				// those load with the lazy pages and the Pro interest form.
				moduleSideEffects: (id) => !id.includes("/packages/shared/src/"),
			},
		},
	},
	preview: {
		port: 4173,
		strictPort: true,
	},
});
