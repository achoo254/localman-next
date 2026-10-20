/**
 * Adapted from chat-next/apps/web/vite-brand.ts @a5be0b4. Localman changes:
 * no %APP_*% placeholders or inline splash logo (index.html carries the name
 * as text, guarded by brand-static-files.test.ts), and the whole plugin is
 * gated by brand.config.json "webInstall".
 *
 * Makes the site installable from the brand: with "webInstall": true it
 * - links the favicon (ICO and SVG), Apple touch icon, manifest,
 *   theme-color and iOS home-screen title in the head of index.html;
 * - serves those files at the site root in dev and emits them in builds:
 *   the icons pnpm brand:gen writes to packages/brand/generated/icons/, the
 *   brand SVG, and manifest.webmanifest (the web.webmanifest.json pnpm
 *   brand:gen writes there; scripts/brand/localman-brand.test.ts keeps it
 *   equal to the brand).
 *
 * With "webInstall": false (the default while the icon is a placeholder) the
 * plugin has no hooks, so the build output is the same as without it.
 * docs/decisions/0006-brand-config-and-product-name.md says how to turn it on.
 */
import { readFileSync } from "node:fs";
import {
	type BrandConfigWith,
	DEFAULT_FAVICON_SVG,
	FAVICON_ICO,
	RASTER_ICONS,
	loadBrandConfig,
	webIconFiles,
} from "@shared-next/brand/build";
import type { Plugin } from "vite";

/** The brand fields the plugin reads beyond the schema's required ones. */
export type InstallBrand = BrandConfigWith<"webInstall" | "colors.primary">;

/** Repository root: the directory of brand.config.json and its icon paths. */
export const BRAND_ROOT = new URL("../../../../", import.meta.url);
/** Where pnpm brand:gen writes web.webmanifest.json and icons/. */
export const GENERATED_DIR = new URL("packages/brand/generated/", BRAND_ROOT);

export const MANIFEST_PATH = "manifest.webmanifest";
const PLUGIN_NAME = "localman:brand-install-assets";

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
};

function escapeHtml(value: string): string {
	return value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
}

const CONTENT_TYPES: Record<string, string> = {
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".webmanifest": "application/manifest+json",
};

function contentType(path: string): string {
	const extension = path.slice(path.lastIndexOf("."));
	return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/** The manifest pnpm brand:gen wrote, compact (the file is indented for git). */
function generatedManifest(): string {
	const file = new URL("web.webmanifest.json", GENERATED_DIR);
	return `${JSON.stringify(JSON.parse(readFileSync(file, "utf8")))}\n`;
}

/** URL path (no leading slash) to file contents, read on use so pnpm brand:gen shows up without a restart. */
function installFiles(
	brand: InstallBrand,
): ReadonlyMap<string, () => Buffer | string> {
	const icons = webIconFiles(brand, {
		root: BRAND_ROOT,
		generatedDir: GENERATED_DIR,
	});
	return new Map<string, () => Buffer | string>([
		...icons.map((icon) => [icon.path, () => readFileSync(icon.file)] as const),
		[MANIFEST_PATH, generatedManifest],
	]);
}

/** Head tags that link the files of installFiles. */
function installHeadTags(brand: InstallBrand): string {
	const appleTouch = RASTER_ICONS.find((icon) =>
		icon.file.startsWith("apple-touch-icon"),
	);
	if (appleTouch === undefined) {
		throw new Error("brand: no Apple touch icon in RASTER_ICONS");
	}
	// Browsers with SVG favicons take the SVG; the others fall back to the ICO.
	return [
		`<link rel="icon" href="/${FAVICON_ICO}" sizes="16x16 32x32 48x48">`,
		`<link rel="icon" href="/${DEFAULT_FAVICON_SVG}" type="image/svg+xml">`,
		`<link rel="apple-touch-icon" href="/${appleTouch.file}" sizes="${appleTouch.size}x${appleTouch.size}">`,
		`<link rel="manifest" href="/${MANIFEST_PATH}">`,
		`<meta name="theme-color" content="${escapeHtml(brand.colors.primary)}">`,
		`<meta name="apple-mobile-web-app-title" content="${escapeHtml(brand.shortName)}">`,
	].join("\n\t\t");
}

export function brandInstallAssets(
	brand: InstallBrand = loadBrandConfig(BRAND_ROOT, {
		require: ["webInstall", "colors.primary"],
	}),
): Plugin {
	if (!brand.webInstall) return { name: PLUGIN_NAME };
	const files = installFiles(brand);
	const tags = installHeadTags(brand);

	return {
		name: PLUGIN_NAME,
		transformIndexHtml: {
			order: "pre",
			handler(html) {
				if (!html.includes("</title>")) {
					throw new Error("index.html has no <title> to put brand links after");
				}
				return html.replace("</title>", `</title>\n\t\t${tags}`);
			},
		},
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const path = req.url?.split("?")[0]?.slice(1) ?? "";
				const read = files.get(path);
				if (read === undefined) {
					next();
					return;
				}
				try {
					res.setHeader("Content-Type", contentType(path));
					res.end(read());
				} catch (error) {
					next(error);
				}
			});
		},
		generateBundle() {
			for (const [fileName, read] of files) {
				this.emitFile({ type: "asset", fileName, source: read() });
			}
		},
	};
}
