/**
 * `pnpm brand:gen`: writes what the platforms derive from brand.config.json
 * to packages/brand/generated/: web.webmanifest.json, capacitor.json and the
 * PNG/ICO icons drawn from the brand SVGs with Playwright's Chromium. Run it
 * after editing the brand, then commit the generated files.
 * scripts/brand/localman-brand.test.ts fails while they are stale.
 */
import { chromiumRenderer, writeBrandFiles } from "@shared-next/brand/build";
import { chromium } from "playwright";
import {
	BRAND_INDENT,
	BRAND_MANIFESTS,
	BRAND_ROOT,
	GENERATED_DIR,
	loadLocalmanBrand,
} from "./brand/localman-brand.js";

async function main(): Promise<void> {
	const written = await writeBrandFiles({
		brand: loadLocalmanBrand(),
		root: BRAND_ROOT,
		generatedDir: GENERATED_DIR,
		manifests: BRAND_MANIFESTS,
		indent: BRAND_INDENT,
		renderer: chromiumRenderer(chromium),
	});
	console.log(
		`Wrote ${written.length} files to ${GENERATED_DIR.pathname}: ${written.join(", ")}`,
	);
}

main().catch((error: unknown) => {
	console.error("brand:gen failed:", error);
	process.exitCode = 1;
});
