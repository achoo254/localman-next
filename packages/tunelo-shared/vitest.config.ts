import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		testTimeout: 30_000,
	},
	resolve: {
		alias: {
			"@tunelo/shared": resolve(__dirname, "./src/index.ts"),
		},
	},
});
