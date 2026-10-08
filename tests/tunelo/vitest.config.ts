import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "tunelo-e2e",
		include: ["e2e/**/*.test.ts"],
		testTimeout: 30_000,
	},
	resolve: {
		alias: {
			"@tunelo/shared": resolve(
				__dirname,
				"../../packages/tunelo-shared/src/index.ts",
			),
		},
	},
});
