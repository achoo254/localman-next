import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "./config/features";
import { resetCurrentUserCache } from "./features/auth/use-current-user";
import { en } from "./i18n/messages/en/dictionary";
import { appTitle } from "./lib/use-document-title";
import { renderWithFeatures } from "./pages/landing/landing-test-helpers";
import { VnFakeDataPage } from "./pages/tools/vn-fake-data-page";
import {
	prerenderedPages,
	renderPageHtml,
	renderPrerenderedFiles,
} from "./prerender";
import { UNAUTHENTICATED, mockFetch } from "./test/mock-fetch";

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(resolve(here, "../index.html"), "utf8");
const PATH = "/tools/vn-fake-data";
const FLAGS = { ...NO_FEATURES, vnFakeData: true };

/** Text of every table body row in `root`, in order. */
function rowsOf(root: ParentNode): string[] {
	return [...root.querySelectorAll("tbody tr")].map(
		(row) => row.textContent ?? "",
	);
}

describe("prerendered fake data tool", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("is left out of builds without the flag", () => {
		expect(prerenderedPages(NO_FEATURES).map((page) => page.path)).toEqual([
			"/",
		]);
	});

	// Hydration keeps the markup only if the browser draws the same rows:
	// the first list must not depend on the clock or a random seed. The
	// browser renders first: prerendering a lazy page leaves the router
	// context set for the client renderer sharing this test process (never
	// so in a browser), so client renders must come before any prerender.
	it("prerenders the rows the browser draws first", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		const { container, unmount } = renderWithFeatures(
			<VnFakeDataPage />,
			FLAGS,
		);
		await screen.findByRole("table");
		const browserRows = rowsOf(container);
		unmount();
		expect(browserRows).toHaveLength(10);
		const prerendered = document.createElement("div");
		prerendered.innerHTML = await renderPageHtml(PATH, FLAGS);
		expect(rowsOf(prerendered)).toEqual(browserRows);
	});

	it("is written with its English head, and the landing links to it", async () => {
		const files = await renderPrerenderedFiles(template, FLAGS);
		expect(files.map((file) => file.file)).toEqual([
			"index.html",
			"tools-vn-fake-data.html",
		]);
		const [landing, tool] = files.map((file) => file.html.replace(/\s+/g, " "));
		expect(tool).toContain(`<div id="app" data-prerendered="${PATH}">`);
		expect(tool).toContain(
			`<title>${appTitle(en.vnFakeData.meta.title)}</title>`,
		);
		expect(tool).toContain(en.vnFakeData.meta.description);
		expect(tool).toContain(en.vnFakeData.notice.title);
		expect(landing).toContain('data-id="landing-vn-fake-data-link"');
	});
});
