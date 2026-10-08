import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "scripts",
		include: ["check-tokens/**/*.test.ts"],
	},
});
