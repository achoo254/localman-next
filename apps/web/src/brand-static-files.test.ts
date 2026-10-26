import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brand } from "@localman/shared/brand";
import { describe, expect, it } from "vitest";

/**
 * Files served without a build step cannot import the brand, so they carry
 * the product name as text; these tests keep that text equal to
 * brand.config.json, so a rename cannot miss them.
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string): string =>
	readFileSync(resolve(webRoot, path), "utf8");

describe("static files follow the brand", () => {
	it("titles push notifications without a title with the product name", () => {
		const title = /const DEFAULT_TITLE = "([^"]*)";/.exec(read("public/sw.js"));
		expect(title?.[1]).toBe(brand.appName);
	});

	it("names the site in index.html link previews and the tab title", () => {
		const html = read("index.html").replace(/\s+/g, " ");
		expect(html).toContain(
			`<meta property="og:site_name" content="${brand.appName}" />`,
		);
		expect(html).toContain(`<title>${brand.appName} · `);
	});

	it("points link previews at the share image on the web host", () => {
		const host = brand.hostTemplates.web.replace(
			"{domain}",
			brand.primaryTenant.domain,
		);
		const image = `https://${host}/og-image.jpg`;
		const html = read("index.html").replace(/\s+/g, " ");
		expect(html).toContain(`<meta property="og:image" content="${image}" />`);
		expect(html).toContain(`<meta name="twitter:image" content="${image}" />`);
		expect(
			readFileSync(resolve(webRoot, "public/og-image.jpg")).length,
		).toBeGreaterThan(0);
	});
});
