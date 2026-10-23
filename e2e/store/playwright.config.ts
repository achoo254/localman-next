import { defineConfig, devices } from "@playwright/test";
import { WEB_ORIGIN } from "../support/ports.js";

/**
 * Store screenshots (`pnpm store:screenshots`), not a test run: the web app
 * the iOS/Android shell wraps, on the E2E stack (support/stack.ts, fixed
 * ports 46xx) with demo data, in Vietnamese, saved as RGB PNGs under
 * docs/store/screenshots/<project>/. One project per display class the
 * stores take, at its exact pixel size (CSS viewport × device scale).
 * One worker: the projects run one after another on a shared machine.
 */
const PHONE = devices["iPhone 15"];

export default defineConfig({
	testDir: ".",
	testMatch: "store-screenshots.spec.ts",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: "list",
	outputDir: "../test-results/store",
	timeout: 120_000,
	expect: { timeout: 15_000 },
	globalSetup: "../support/global-setup.ts",
	globalTeardown: "../support/global-teardown.ts",
	use: {
		baseURL: WEB_ORIGIN,
		testIdAttribute: "data-id",
		locale: "vi-VN",
		timezoneId: "Asia/Saigon",
		colorScheme: "light",
		// Chromium for every project: the stack's browser (devices' iPhones default to WebKit).
		browserName: "chromium",
	},
	projects: [
		// App Store: iPhone 6.9" (Dynamic Island, large), 1320 × 2868.
		{
			name: "ios-6.9",
			use: {
				...PHONE,
				viewport: { width: 440, height: 956 },
				deviceScaleFactor: 3,
			},
		},
		// App Store: iPhone 6.5" (Face ID, large), 1284 × 2778.
		{
			name: "ios-6.5",
			use: {
				...PHONE,
				viewport: { width: 428, height: 926 },
				deviceScaleFactor: 3,
			},
		},
		// Google Play phone, 9:16 at 1080 × 1920 (a common Android phone width in CSS px).
		{
			name: "android",
			use: {
				...devices["Pixel 7"],
				viewport: { width: 432, height: 768 },
				deviceScaleFactor: 2.5,
			},
		},
	],
});
