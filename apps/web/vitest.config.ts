import { defineConfig } from "vitest/config";

// No Vite plugins here: vitest 3 bundles its own Vite major, so the app's
// plugin instances are not type-compatible. esbuild's automatic JSX runtime
// is all the tests need.
export default defineConfig({
	esbuild: { jsx: "automatic" },
	test: {
		name: "@localman/web",
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		css: false,
	},
});
