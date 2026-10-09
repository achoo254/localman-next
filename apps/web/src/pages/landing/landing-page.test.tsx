import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FREE_LIMITS } from "@localman/shared/constants";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { DEMO_USERS, DEMO_USER_SCHEMA } from "../../content/landing-samples";
import { seriousViolations } from "../../test/axe";
import {
	UNRELEASED_WORDS,
	unreleasedMentions,
} from "../../test/unreleased-copy";
import { LANDING_TITLES, LandingPage } from "./landing-page";
import { ALL_FEATURES, renderWithFeatures } from "./landing-test-helpers";

/** Top-level landing blocks of the spec, in the order they appear. */
const BLOCKS = new Set([
	"landing-hero",
	"landing-live-sync",
	"landing-compare",
	"landing-pricing",
	"landing-modeling",
	"landing-relations",
	"landing-features",
	"landing-cta",
]);

function sectionOrder(container: HTMLElement): string[] {
	return [...container.querySelectorAll("[data-id]")]
		.map((element) => element.getAttribute("data-id") ?? "")
		.filter((id) => BLOCKS.has(id));
}

beforeEach(() => {
	// axe probes fonts through canvas, which jsdom lacks.
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

describe("LandingPage", () => {
	it("does not mention unreleased features while every flag is off", () => {
		const { container } = renderWithFeatures(<LandingPage />, NO_FEATURES);
		expect(unreleasedMentions(container)).toEqual([]);
		expect(container.querySelector('[data-id="landing-live-sync"]')).toBeNull();
	});

	it("follows the phase order with one h1 and points 'Xem cách hoạt động' at the relations demo", () => {
		const { container } = renderWithFeatures(<LandingPage />);
		expect(sectionOrder(container)).toEqual([
			"landing-hero",
			"landing-compare",
			"landing-pricing",
			"landing-modeling",
			"landing-relations",
			"landing-features",
			"landing-cta",
		]);
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
		expect(
			screen.getByRole("heading", { level: 1, name: /REST API có trạng thái/ }),
		).toHaveTextContent(`gói Free ${FREE_LIMITS.projects} project`);
		expect(
			screen.getByRole("link", { name: "Xem cách hoạt động" }),
		).toHaveAttribute("href", "#relations");
	});

	it("switches the hero and loads Live Mock Sync once the flags are on", async () => {
		const { container } = renderWithFeatures(<LandingPage />, ALL_FEATURES);
		expect(
			await screen.findByRole("heading", {
				name: "Đổi mock, collection tự cập nhật",
			}),
		).toBeInTheDocument();
		expect(container).toHaveTextContent("Localhost ngay trên trình duyệt");
		expect(
			screen.getByRole("link", { name: "Xem cách hoạt động" }),
		).toHaveAttribute("href", "#live-sync");
		expect(
			container.querySelector('[data-id="landing-hero-preview-tunnel"]'),
		).toHaveTextContent("qua Tunelo");
	});

	it("names the tab after the hero message of the current flags", () => {
		const off = renderWithFeatures(<LandingPage />);
		expect(document.title).toBe(LANDING_TITLES.mock);
		off.unmount();
		renderWithFeatures(<LandingPage />, ALL_FEATURES);
		expect(document.title).toBe(LANDING_TITLES.localhost);
	});

	it("has no serious axe violations", async () => {
		const { container } = renderWithFeatures(<LandingPage />);
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("keeps demo samples in the shape of the demo schema", () => {
		const fields = DEMO_USER_SCHEMA.map((field) => field.name).sort();
		for (const user of DEMO_USERS) {
			expect(Object.keys(user).sort()).toEqual(fields);
		}
	});
});

describe("index.html SEO", () => {
	const here = dirname(fileURLToPath(import.meta.url));
	const html = readFileSync(resolve(here, "../../../index.html"), "utf8");

	it("describes the Free plan with the project count from plan-limits", () => {
		const description = /<meta\s+name="description"\s+content="([^"]+)"/.exec(
			html,
		)?.[1];
		expect(description).toContain(`${FREE_LIMITS.projects} project`);
		expect(html).toMatch(/property="og:description"\s+content="[^"]+"/);
		expect(html).toContain(`<title>${LANDING_TITLES.mock}</title>`);
		expect(html).toContain(`content="${LANDING_TITLES.mock}"`);
	});

	it("keeps the strict referrer policy and advertises no unreleased feature", () => {
		expect(html).toContain('<meta name="referrer" content="strict-origin" />');
		const head = html.slice(0, html.indexOf("<script>"));
		const metas = head.replace(/<!--[\s\S]*?-->/g, "");
		for (const word of UNRELEASED_WORDS) expect(metas).not.toMatch(word);
	});
});
