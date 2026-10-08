import { defineConfig } from "vitest/config";

// Each workspace package owns its vitest config; the root only lists them so
// `pnpm test` runs every suite in one process.
export default defineConfig({
	test: {
		projects: [
			"apps/*/vitest.config.ts",
			"packages/*/vitest.config.ts",
			"tests/tunelo/vitest.config.ts",
			"scripts/vitest.config.ts",
		],
	},
});
