import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FREE_LIMITS } from "@localman/shared/constants";
import { describe, expect, it } from "vitest";
import { en } from "./i18n/messages/en/dictionary";
import { createTranslator } from "./i18n/translate";
import { applyPageHead, renderPrerenderedFiles } from "./prerender";

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(resolve(here, "../index.html"), "utf8");
const { t } = createTranslator("en", en);

function fileNamed(files: Array<{ file: string; html: string }>, name: string) {
	const found = files.find((entry) => entry.file === name);
	if (!found) throw new Error(`no ${name}`);
	return found.html.replace(/\s+/g, " ");
}

describe("prerendered files", () => {
	it("writes the landing and the pricing page, each marked with its path", async () => {
		const files = await renderPrerenderedFiles(template);
		expect(files.map((entry) => entry.file)).toEqual([
			"index.html",
			"pricing.html",
		]);
		const landing = fileNamed(files, "index.html");
		expect(landing).toContain('<div id="app" data-prerendered="/">');
		expect(landing).toContain('data-id="landing-hero"');
		expect(landing).toContain(`<title>${en.landing.meta.titleMock}</title>`);

		const pricing = fileNamed(files, "pricing.html");
		expect(pricing).toContain('<div id="app" data-prerendered="/pricing">');
		expect(pricing).toContain('data-id="landing-pricing"');
		expect(pricing).not.toContain('data-id="landing-hero"');
		const description = t("landing.meta.pricingDescription", {
			projects: FREE_LIMITS.projects,
		});
		expect(pricing).toContain("<title>Pricing · Localman</title>");
		expect(pricing).toContain(`name="description" content="${description}"`);
		expect(pricing).toContain(
			'property="og:title" content="Pricing · Localman"',
		);
		expect(pricing).toContain(
			`property="og:description" content="${description}"`,
		);
		expect(pricing).not.toContain(en.landing.meta.titleMock);
	});

	it("escapes the head text and refuses a template without the tags", () => {
		const head = { title: 'A <b> & "c"', description: "d" };
		expect(applyPageHead(template, head)).toContain(
			"<title>A &lt;b&gt; &amp; &quot;c&quot;</title>",
		);
		expect(() => applyPageHead("<html></html>", head)).toThrow(/title/);
	});
});
