import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		globalSetup: ["src/test-support/mongo-global-setup.ts"],
		testTimeout: 30_000,
		hookTimeout: 120_000,
		// Shared 16 GB machine: at most two workers however the suite starts.
		maxWorkers: 2,
		minWorkers: 1,
		env: {
			// Primary first; the second shows another domain is accepted too.
			TUNNEL_DOMAINS: "tunnel.hoandat.com,tunnel.example.test",
		},
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
