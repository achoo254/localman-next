// Copied from chat-next/packages/brand @a5be0b4; keep in sync until shared package exists.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BrandConfig } from "./brand-config.js";
import { REPO_ROOT } from "./config.js";

/** Which brand asset a raster icon is drawn from. */
export type IconSource = "icon" | "iconMaskable";

/** A PNG the generator draws from a brand SVG into generated/icons/. */
export interface RasterIcon {
	/** File name under generated/icons/ and the URL path a web app serves it at. */
	readonly file: string;
	readonly source: IconSource;
	readonly size: number;
}

/**
 * PNG icons of the app. The rounded icon serves browsers ("any"); the
 * full-bleed maskable icon serves launchers that crop to their own shape and
 * iOS, which rounds the Apple touch icon itself.
 */
export const RASTER_ICONS: readonly RasterIcon[] = [
	{ file: "icon-192.png", source: "icon", size: 192 },
	{ file: "icon-512.png", source: "icon", size: 512 },
	{ file: "icon-maskable-192.png", source: "iconMaskable", size: 192 },
	{ file: "icon-maskable-512.png", source: "iconMaskable", size: 512 },
	{ file: "apple-touch-icon.png", source: "iconMaskable", size: 180 },
];

/** Sizes packed into favicon.ico, for browsers without SVG favicons. */
export const FAVICON_ICO_SIZES: readonly number[] = [16, 32, 48];

export const FAVICON_ICO = "favicon.ico";
/** URL path of the SVG favicon (a copy of the brand icon). */
export const FAVICON_SVG = "icon.svg";
/** Records which brand SVGs the generated icons were drawn from. */
export const ICONS_SOURCE_FILE = "icons-source.json";

export const GENERATED_ICONS_DIR = new URL(
	"../generated/icons/",
	import.meta.url,
);

/** One file a web app serves at the site root, and where it comes from. */
export interface WebIconFile {
	/** URL path without the leading slash. */
	readonly path: string;
	readonly file: URL;
}

/** Every icon file a web app serves, with its source on disk. */
export function webIconFiles(brand: BrandConfig): readonly WebIconFile[] {
	return [
		{ path: FAVICON_SVG, file: new URL(brand.icon, REPO_ROOT) },
		{ path: FAVICON_ICO, file: new URL(FAVICON_ICO, GENERATED_ICONS_DIR) },
		...RASTER_ICONS.map((icon) => ({
			path: icon.file,
			file: new URL(icon.file, GENERATED_ICONS_DIR),
		})),
	];
}

/** Manifest icon entries, matching webIconFiles. */
export function manifestIcons(): readonly Record<string, string>[] {
	return [
		{
			src: `/${FAVICON_SVG}`,
			sizes: "any",
			type: "image/svg+xml",
			purpose: "any",
		},
		...RASTER_ICONS.filter((icon) => icon.file.startsWith("icon-")).map(
			(icon) => ({
				src: `/${icon.file}`,
				sizes: `${icon.size}x${icon.size}`,
				type: "image/png",
				purpose: icon.source === "iconMaskable" ? "maskable" : "any",
			}),
		),
	];
}

/**
 * sha256 of each brand SVG the raster icons come from. The generator stores
 * it next to the icons; a test compares it with the current files, so an
 * edited logo without `pnpm brand:gen` fails instead of shipping stale PNGs.
 */
export function iconSourceHashes(
	brand: BrandConfig,
): Record<IconSource, string> {
	const hash = (path: string) =>
		createHash("sha256")
			.update(readFileSync(new URL(path, REPO_ROOT)))
			.digest("hex");
	return { icon: hash(brand.icon), iconMaskable: hash(brand.iconMaskable) };
}
