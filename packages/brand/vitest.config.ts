import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "@localman/brand",
		include: ["src/**/*.test.ts"],
	},
});
