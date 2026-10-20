/**
 * Copied from chat-next/packages/brand @a5be0b4; keep in sync until shared
 * package exists.
 *
 * Writes what the platforms derive from the brand to packages/brand/generated/:
 * the platform manifests from brand.config.json and the PNG/ICO icons drawn
 * from the brand SVGs. Run after editing the brand:
 *
 *   pnpm brand:gen
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadBrandConfig } from "./config.js";
import { generateManifests } from "./generate.js";
import { encodeIco } from "./ico.js";
import {
	FAVICON_ICO,
	FAVICON_ICO_SIZES,
	GENERATED_ICONS_DIR,
	ICONS_SOURCE_FILE,
	RASTER_ICONS,
	iconSourceHashes,
} from "./icons.js";
import { rasterize } from "./rasterize.js";

function json(value: unknown): string {
	return `${JSON.stringify(value, null, "\t")}\n`;
}

async function main(): Promise<void> {
	const brand = loadBrandConfig();
	const outDir = new URL("../generated/", import.meta.url);
	mkdirSync(outDir, { recursive: true });
	const manifests = generateManifests(brand);
	for (const [name, content] of Object.entries(manifests)) {
		writeFileSync(new URL(name, outDir), json(content));
	}
	console.log(
		`Wrote ${Object.keys(manifests).length} manifests to ${outDir.pathname}`,
	);

	mkdirSync(GENERATED_ICONS_DIR, { recursive: true });
	const pngs = await rasterize([
		...RASTER_ICONS.map((icon) => ({
			svg: brand[icon.source],
			size: icon.size,
		})),
		...FAVICON_ICO_SIZES.map((size) => ({ svg: brand.icon, size })),
	]);
	RASTER_ICONS.forEach((icon, index) => {
		const png = pngs[index];
		if (png === undefined)
			throw new Error(`brand:gen: no image for ${icon.file}`);
		writeFileSync(new URL(icon.file, GENERATED_ICONS_DIR), png);
	});
	const icoImages = FAVICON_ICO_SIZES.map((size, index) => {
		const png = pngs[RASTER_ICONS.length + index];
		if (png === undefined) throw new Error(`brand:gen: no ${size}px favicon`);
		return { size, png };
	});
	writeFileSync(
		new URL(FAVICON_ICO, GENERATED_ICONS_DIR),
		encodeIco(icoImages),
	);
	writeFileSync(
		new URL(ICONS_SOURCE_FILE, GENERATED_ICONS_DIR),
		json(iconSourceHashes(brand)),
	);
	console.log(
		`Wrote ${RASTER_ICONS.length + 1} icons to ${GENERATED_ICONS_DIR.pathname}`,
	);
}

main().catch((error: unknown) => {
	console.error("brand:gen failed:", error);
	process.exitCode = 1;
});
