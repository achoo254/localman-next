import { existsSync, readFileSync, readdirSync } from "node:fs";
import {
	FAVICON_ICO,
	formatGenerated,
	generateManifests,
	iconSourceHashes,
	parseBrandConfig,
	webIconFiles,
} from "@shared-next/brand/build";
import { describe, expect, it } from "vitest";
import {
	BRAND_INDENT,
	BRAND_MANIFESTS,
	BRAND_REQUIRE,
	BRAND_ROOT,
	GENERATED_DIR,
	loadLocalmanBrand,
} from "./localman-brand.js";

const brand = loadLocalmanBrand();
const tokensCss = readFileSync(
	new URL("packages/design-tokens/tokens.css", BRAND_ROOT),
	"utf8",
);
const readGenerated = (name: string): Buffer =>
	readFileSync(new URL(name, GENERATED_DIR));

/** Value of a colour token in a tokens.css block (light `:root` or dark). */
function token(block: string, name: string): string {
	const match = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(block);
	if (!match?.[1]) throw new Error(`tokens.css has no ${name}`);
	return match[1].toLowerCase();
}

describe("brand.config.json", () => {
	it("passes the schema with the fields Localman requires", () => {
		expect(brand.urlScheme).toBe(brand.appIds.ios);
	});

	it("rejects an invalid bundle id, color and unknown field", () => {
		expect(() =>
			parseBrandConfig({
				...brand,
				appIds: { ...brand.appIds, ios: "Not A Bundle" },
				colors: { ...brand.colors, primary: "blue" },
				extra: true,
			}),
		).toThrow(/appIds\/ios.*colors\/primary|colors\/primary.*appIds\/ios/s);
	});

	it("requires webInstall, an explicit boolean switch", () => {
		const { webInstall: _webInstall, ...missing } = brand;
		expect(() => parseBrandConfig(missing, { require: BRAND_REQUIRE })).toThrow(
			/webInstall/,
		);
		expect(() => parseBrandConfig({ ...brand, webInstall: "false" })).toThrow(
			/webInstall must be boolean/,
		);
	});

	it("has no desktop app id: desktop is the installable web app", () => {
		expect(brand.appIds).not.toHaveProperty("desktop");
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
			const svg = readFileSync(new URL(path, BRAND_ROOT), "utf8").toLowerCase();
			const fills = [...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(
				(match) => match[1],
			);
			expect(fills.length, path).toBeGreaterThan(0);
			for (const fill of fills)
				expect(allowed.has(fill ?? ""), path).toBe(true);
		}
	});
});

describe("generated files (run pnpm brand:gen after editing the brand)", () => {
	const manifests = generateManifests(brand, BRAND_MANIFESTS);

	it("are exactly the manifests the brand gives, byte for byte", () => {
		for (const [name, content] of Object.entries(manifests)) {
			expect(readGenerated(name).toString("utf8"), name).toBe(
				formatGenerated(content, BRAND_INDENT),
			);
		}
	});

	it("hold only those manifests and icons/ (no native desktop shell)", () => {
		expect(readdirSync(GENERATED_DIR).sort()).toEqual(
			[...Object.keys(manifests), "icons"].sort(),
		);
	});

	it("keep the Capacitor WebView on its own origin, not a tenant's host", () => {
		expect(manifests["capacitor.json"]).not.toHaveProperty("server");
	});

	it("drew the icons from the current brand SVGs", () => {
		const recorded: unknown = JSON.parse(
			readGenerated("icons/icons-source.json").toString("utf8"),
		);
		expect(recorded).toEqual(iconSourceHashes(brand, BRAND_ROOT));
	});

	it("have a file for every icon the web app serves and the manifest lists", () => {
		const served = webIconFiles(brand, {
			root: BRAND_ROOT,
			generatedDir: GENERATED_DIR,
		});
		for (const icon of served) {
			expect(existsSync(icon.file), icon.path).toBe(true);
		}
		const paths = new Set(served.map((icon) => `/${icon.path}`));
		for (const icon of BRAND_MANIFESTS.web.icons) {
			expect(paths.has(icon.src), icon.src).toBe(true);
		}
	});

	it("keep favicon.ico readable as an icon file", () => {
		const ico = readGenerated(`icons/${FAVICON_ICO}`);
		expect(ico.readUInt16LE(2)).toBe(1);
		expect(ico.readUInt16LE(4)).toBe(3);
	});
});
