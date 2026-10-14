import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
	readFileSync(
		fileURLToPath(
			new URL(`../../packages/design-tokens/${path}`, import.meta.url),
		),
		"utf8",
	);

/** The light theme's value of a token in tokens.css (its first definition). */
function token(css: string, name: string): string {
	const match = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css);
	if (!match?.[1]) throw new Error(`no ${name}`);
	return match[1].toLowerCase();
}

describe("Run in Localman badge", () => {
	it("uses the primary button colours of the design tokens", () => {
		const css = read("tokens.css");
		const svg = read("run-button.svg").toLowerCase();
		const fills = [...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
		expect(new Set(fills)).toEqual(
			new Set([token(css, "--c-primary-solid"), token(css, "--c-on-primary")]),
		);
	});

	it("names itself for screen readers", () => {
		const svg = read("run-button.svg");
		expect(svg).toContain('aria-label="Run in Localman"');
		expect(svg).toContain("<title>Run in Localman</title>");
	});
});
