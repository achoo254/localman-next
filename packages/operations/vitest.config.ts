import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "@localman/operations",
		include: ["src/**/*.test.ts"],
	},
});
