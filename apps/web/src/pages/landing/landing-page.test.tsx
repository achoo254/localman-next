import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FREE_LIMITS } from "@localman/shared/constants";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { DEMO_USERS, DEMO_USER_SCHEMA } from "../../content/landing-samples";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import { seriousViolations } from "../../test/axe";
import {
	UNRELEASED_WORDS,
	unreleasedMentions,
} from "../../test/unreleased-copy";
import { LandingPage } from "./landing-page";
import { ALL_FEATURES, renderWithFeatures } from "./landing-test-helpers";

/** Top-level landing blocks of the spec, in the order they appear. */
const BLOCKS = new Set([
	"landing-hero",
	"landing-live-sync",
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

	it("follows the phase order with one h1 and points 'See how it works' at the relations demo", () => {
		const { container } = renderWithFeatures(<LandingPage />);
		expect(sectionOrder(container)).toEqual([
			"landing-hero",
			"landing-pricing",
			"landing-modeling",
			"landing-relations",
			"landing-features",
			"landing-cta",
		]);
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
		expect(
			screen.getByRole("heading", {
				level: 1,
				name: /Stateful mock REST APIs/,
			}),
		).toHaveTextContent(`${FREE_LIMITS.projects} projects on the Free plan`);
		expect(
			screen.getByRole("link", { name: "See how it works" }),
		).toHaveAttribute("href", "#relations");
	});

	it("switches the hero and loads Live Mock Sync once the flags are on", async () => {
		const { container } = renderWithFeatures(<LandingPage />, ALL_FEATURES);
		expect(
			await screen.findByRole("heading", {
				name: "Change the mock, the collection follows",
			}),
		).toBeInTheDocument();
		expect(container).toHaveTextContent("Localhost right in your browser");
		expect(
			screen.getByRole("link", { name: "See how it works" }),
		).toHaveAttribute("href", "#live-sync");
		expect(
			container.querySelector('[data-id="landing-hero-preview-tunnel"]'),
		).toHaveTextContent("via Tunelo");
	});

	it("names the tab after the hero message of the current flags", () => {
		const off = renderWithFeatures(<LandingPage />);
		expect(document.title).toBe(en.landing.meta.titleMock);
		off.unmount();
		renderWithFeatures(<LandingPage />, ALL_FEATURES);
		expect(document.title).toBe(en.landing.meta.titleLocalhost);
	});

	it("names no competitor, whatever the flags", async () => {
		for (const flags of [NO_FEATURES, ALL_FEATURES]) {
			const { container, unmount } = renderWithFeatures(<LandingPage />, flags);
			await screen.findByRole("heading", { level: 1 });
			expect(container.textContent).not.toMatch(/mockapi|postman/i);
			expect(container.querySelector('[data-id="landing-compare"]')).toBeNull();
			unmount();
		}
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

	it("carries the English landing copy with the project count from plan-limits", () => {
		const { t } = createTranslator("en", en);
		const description = t("landing.meta.description", {
			projects: FREE_LIMITS.projects,
		});
		const title = en.landing.meta.titleMock;
		const flat = html.replace(/\s+/g, " ");
		expect(flat).toContain('<html lang="en">');
		expect(flat).toContain(`<title>${title}</title>`);
		expect(flat).toContain(`name="description" content="${description}"`);
		expect(flat).toContain(
			`property="og:description" content="${description}"`,
		);
		expect(flat).toContain(`property="og:title" content="${title}"`);
	});

	it("keeps the strict referrer policy and advertises no unreleased feature", () => {
		expect(html).toContain('<meta name="referrer" content="strict-origin" />');
		const head = html.slice(0, html.indexOf("<script>"));
		const metas = head.replace(/<!--[\s\S]*?-->/g, "");
		for (const word of UNRELEASED_WORDS) expect(metas).not.toMatch(word);
	});
});
