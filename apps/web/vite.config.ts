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
	preview: {
		port: 4173,
		strictPort: true,
	},
});
