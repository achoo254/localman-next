import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		testTimeout: 30_000,
		// Shared 16 GB machine: at most two workers however the suite starts.
		maxWorkers: 2,
		minWorkers: 1,
	},
});
