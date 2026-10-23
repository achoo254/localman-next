/**
 * `pnpm brand:gen`: writes what the platforms derive from brand.config.json
 * to packages/brand/generated/: web.webmanifest.json, capacitor.json and the
 * PNG/ICO icons drawn from the brand SVGs with Playwright's Chromium; then
 * the iOS/Android app icons and splash screens and the Play listing art
 * (scripts/brand/native-assets.ts). Run it after editing the brand, then
 * commit the generated files. scripts/brand/localman-brand.test.ts and
 * native-assets.test.ts fail while they are stale.
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
import {
	nativeBrandOf,
	writeNativeAssets,
} from "./brand/native-assets-write.js";

async function main(): Promise<void> {
	const brand = loadLocalmanBrand();
	const written = await writeBrandFiles({
		brand,
		root: BRAND_ROOT,
		generatedDir: GENERATED_DIR,
		manifests: BRAND_MANIFESTS,
		indent: BRAND_INDENT,
		renderer: chromiumRenderer(chromium),
	});
	console.log(
		`Wrote ${written.length} files to ${GENERATED_DIR.pathname}: ${written.join(", ")}`,
	);
	const native = await writeNativeAssets(
		nativeBrandOf(brand, BRAND_ROOT),
		BRAND_ROOT,
	);
	console.log(
		`Wrote ${native.length} native app and store files (apps/mobile/ios, apps/mobile/android, docs/store/play).`,
	);
}

main().catch((error: unknown) => {
	console.error("brand:gen failed:", error);
	process.exitCode = 1;
});
