import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "@localman/api",
		include: ["src/**/*.test.ts"],
		globalSetup: ["src/test-support/mongo-global-setup.ts"],
		setupFiles: ["src/test-support/tenant-setup.ts"],
		testTimeout: 30_000,
		hookTimeout: 120_000,
		// Shared 16 GB machine: at most two workers however the suite starts.
		maxWorkers: 2,
		minWorkers: 1,
	},
});
