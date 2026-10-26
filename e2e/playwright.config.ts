import { defineConfig, devices } from "@playwright/test";
import { WEB_ORIGIN } from "./support/ports.js";

/**
 * End-to-end specs against the whole stack (see support/stack.ts). Two
 * workers: each test signs in as its own user, so they share one API and
 * one database without seeing each other's projects.
 *
 * Tests whose title ends in `@smoke` are the critical journeys run on every
 * push (`pnpm e2e:smoke`); the rest need a real browser and run nightly
 * with them (`pnpm e2e`). Business logic belongs in unit and API tests.
 */
export default defineConfig({
	testDir: "./specs",
	fullyParallel: true,
	workers: 2,
	retries: 0,
	forbidOnly: Boolean(process.env.CI),
	reporter: "list",
	outputDir: "test-results",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	globalSetup: "./support/global-setup.ts",
	globalTeardown: "./support/global-teardown.ts",
	use: {
		baseURL: WEB_ORIGIN,
		// The app's own test ids are `data-id`, as in every component.
		testIdAttribute: "data-id",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
