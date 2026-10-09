import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "scripts",
		include: [
			"check-tokens/**/*.test.ts",
			"check-i18n/**/*.test.ts",
			"check-mcp-docs/**/*.test.ts",
		],
	},
});
