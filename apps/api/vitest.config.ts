import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "@localman/api",
		include: ["src/**/*.test.ts"],
		testTimeout: 30_000,
	},
});
