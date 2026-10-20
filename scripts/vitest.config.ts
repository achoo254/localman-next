import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "scripts",
		include: [
			"check-tokens/**/*.test.ts",
			"check-i18n/**/*.test.ts",
			"check-brand/**/*.test.ts",
			"check-mcp-docs/**/*.test.ts",
			"nginx-log-map/**/*.test.ts",
		],
	},
});
