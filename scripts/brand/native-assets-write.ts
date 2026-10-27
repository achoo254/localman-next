/**
 * Draws and writes the native app assets (scripts/brand/native-assets.ts)
 * for `pnpm brand:gen`, and records which brand inputs they came from in
 * apps/mobile/brand-assets-source.json. scripts/brand/native-assets.test.ts
 * compares that record with the current brand, so an edited logo or colour
 * fails CI until the generator has run again.
 */
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { BrandConfig } from "@achoo254/brand/build";
import { rasterize, svgPage } from "./chromium-raster.js";
import {
	type NativeBrand,
	nativePictures,
	staleNativeFiles,
} from "./native-assets.js";
import { nativeTextFiles } from "./native-resource-files.js";
import { toRgbPng } from "./png-rgb.js";

export const NATIVE_SOURCE_RECORD = "apps/mobile/brand-assets-source.json";

/**
 * The themed-icon silhouette next to the brand icons (not a brand.config.json
 * field: the shared schema has none). Derived once from the AI master.
 */
export const MONOCHROME_ICON = "packages/design-tokens/app-icon-monochrome.svg";

type BrandColours = BrandConfig["colors"] & {
	readonly primary: string;
	readonly backgroundDark: string;
};

/** The brand fields the native assets use, with the SVG files read. */
export function nativeBrandOf(
	brand: BrandConfig & { readonly colors: BrandColours },
	root: URL,
): NativeBrand {
	return {
		appName: brand.appName,
		iconSvg: readFileSync(new URL(brand.icon, root), "utf8"),
		maskableSvg: readFileSync(new URL(brand.iconMaskable, root), "utf8"),
		monochromeSvg: existsSync(new URL(MONOCHROME_ICON, root))
			? readFileSync(new URL(MONOCHROME_ICON, root), "utf8")
			: null,
		colors: {
			primary: brand.colors.primary,
			background: brand.colors.background,
			backgroundDark: brand.colors.backgroundDark,
		},
	};
}

const sha256 = (text: string): string =>
	createHash("sha256").update(text).digest("hex");

/** What the native assets depend on: a change to any of it needs a regeneration. */
export function nativeSourceRecord(
	native: NativeBrand,
): Record<string, unknown> {
	return {
		appName: native.appName,
		icon: sha256(native.iconSvg),
		iconMaskable: sha256(native.maskableSvg),
		...(native.monochromeSvg === null
			? {}
			: { iconMonochrome: sha256(native.monochromeSvg) }),
		colors: native.colors,
	};
}

/** Inter Bold of the web app (@fontsource/inter), for the Play feature graphic. */
function brandFont(root: URL): Buffer {
	const require = createRequire(new URL("apps/web/package.json", root));
	const pkg = require.resolve("@fontsource/inter/package.json");
	return readFileSync(join(dirname(pkg), "files/inter-latin-700-normal.woff2"));
}

function write(root: URL, path: string, content: string | Buffer): void {
	const file = new URL(path, root);
	mkdirSync(new URL("./", file), { recursive: true });
	writeFileSync(file, content);
}

/** Draws every native picture, writes them with the text resources; returns the repo-relative paths. */
export async function writeNativeAssets(
	native: NativeBrand,
	root: URL,
): Promise<string[]> {
	const pictures = nativePictures(native, brandFont(root));
	const pngs = await rasterize(
		pictures.map((picture) => ({
			label: picture.path,
			width: picture.width,
			height: picture.height,
			html:
				picture.html ??
				svgPage(picture.svg ?? "", picture.width, picture.height),
		})),
	);
	// Everything is drawn before anything is written: a failure leaves the files as they were.
	const written: string[] = [];
	pictures.forEach((picture, i) => {
		const png = pngs[i];
		if (png === undefined) throw new Error(`${picture.path}: not drawn`);
		write(root, picture.path, picture.opaque ? toRgbPng(png) : png);
		written.push(picture.path);
	});
	for (const { path, text } of nativeTextFiles(native)) {
		write(root, path, text);
		written.push(path);
	}
	for (const path of staleNativeFiles(native)) {
		rmSync(new URL(path, root), { force: true });
	}
	write(
		root,
		NATIVE_SOURCE_RECORD,
		`${JSON.stringify(nativeSourceRecord(native), null, "\t")}\n`,
	);
	written.push(NATIVE_SOURCE_RECORD);
	return written;
}
