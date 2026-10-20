import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadBrandConfig, parseBrandConfig } from "./build.js";
import { brand } from "./index.js";

const loaded = loadBrandConfig();
const tokensCss = readFileSync(
	new URL("../../design-tokens/tokens.css", import.meta.url),
	"utf8",
);

/** Value of a colour token in a tokens.css block (light `:root` or dark). */
function token(block: string, name: string): string {
	const match = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(block);
	if (!match?.[1]) throw new Error(`tokens.css has no ${name}`);
	return match[1].toLowerCase();
}

describe("brand.config.json", () => {
	it("passes its schema, and the runtime copy is the same file", () => {
		expect(brand).toEqual(loaded);
		expect(brand.urlScheme).toBe(brand.appIds.ios);
	});

	it("rejects an invalid bundle id, color and unknown field", () => {
		expect(() =>
			parseBrandConfig({
				...loaded,
				appIds: { ...loaded.appIds, ios: "Not A Bundle" },
				colors: { ...loaded.colors, primary: "blue" },
				extra: true,
			}),
		).toThrow(/appIds\/ios.*colors\/primary|colors\/primary.*appIds\/ios/s);
	});

	it("copies its colours from the design tokens, the one colour source", () => {
		const darkStart = tokensCss.indexOf("@media (prefers-color-scheme: dark)");
		expect(darkStart).toBeGreaterThan(0);
		const light = tokensCss.slice(0, darkStart);
		const dark = tokensCss.slice(darkStart);
		expect(brand.colors).toEqual({
			primary: token(light, "--c-primary-solid"),
			background: token(light, "--c-bg"),
			backgroundDark: token(dark, "--c-bg"),
		});
	});

	it("draws the icons in the primary button colours only", () => {
		const allowed = new Set([
			token(tokensCss, "--c-primary-solid"),
			token(tokensCss, "--c-on-primary"),
		]);
		for (const path of [brand.icon, brand.iconMaskable]) {
			const svg = readFileSync(
				new URL(`../../../${path}`, import.meta.url),
				"utf8",
			).toLowerCase();
			const fills = [...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(
				(match) => match[1],
			);
			expect(fills.length, path).toBeGreaterThan(0);
			for (const fill of fills)
				expect(allowed.has(fill ?? ""), path).toBe(true);
		}
	});
});
