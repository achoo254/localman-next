import { describe, expect, it } from "vitest";
import { findBrandLiterals, isScanned } from "./scan-brand.js";

const scan = (source: string, file = "apps/web/src/a.ts") =>
	findBrandLiterals(source, file, "Localman");

describe("findBrandLiterals", () => {
	it("flags the product name as a whole string literal in any quote", () => {
		const source = [
			'const a = "Localman";',
			"const b = 'Localman';",
			"const c = `Localman`;",
		].join("\n");
		expect(scan(source).map((v) => v.line)).toEqual([1, 2, 3]);
	});

	it("lets sentences and identifiers that contain the name pass", () => {
		const source = [
			'const header = "X-Localman-Proxy";',
			'const summary = "Send a request through the Localman proxy";',
			"const title = `${page} · ${brand.appName}`;",
			'const other = "Tunelo";',
		].join("\n");
		expect(scan(source)).toEqual([]);
	});

	it("skips a line with a reasoned ignore marker, not a bare one", () => {
		expect(
			scan('const t = "Localman"; // check-brand-ignore: static file'),
		).toEqual([]);
		expect(scan('const t = "Localman"; // check-brand-ignore:')).toHaveLength(
			1,
		);
	});

	it("checks code only, never tests or other files", () => {
		expect(isScanned("apps/api/src/a.ts")).toBe(true);
		expect(isScanned("apps/web/public/sw.js")).toBe(true);
		expect(isScanned("apps/web/src/a.test.tsx")).toBe(false);
		expect(isScanned("apps/tunelo-server/src/__tests__/a.ts")).toBe(false);
		expect(isScanned("apps/api/src/modules/auth/testing/fake-idp.ts")).toBe(
			false,
		);
		expect(isScanned("apps/web/src/i18n/messages/en/layout.json")).toBe(false);
	});
});
