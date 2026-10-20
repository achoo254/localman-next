// @vitest-environment node
// Runs Vite itself (build and dev server), which jsdom's globals break.
import {
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brand } from "@localman/shared/brand";
import { webIconFiles } from "@shared-next/brand/build";
import { type Rollup, build, createServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	BRAND_ROOT,
	GENERATED_DIR,
	type InstallBrand,
	MANIFEST_PATH,
	brandInstallAssets,
} from "./brand-install-assets";

const on: InstallBrand = { ...brand, webInstall: true };
const off: InstallBrand = { ...brand, webInstall: false };
const INDEX_HTML =
	"<!doctype html>\n<html>\n\t<head>\n\t\t<title>Fixture</title>\n\t</head>\n\t<body></body>\n</html>\n";
/** What pnpm brand:gen wrote; the plugin must serve exactly this. */
const generatedManifest: unknown = JSON.parse(
	readFileSync(new URL("web.webmanifest.json", GENERATED_DIR), "utf8"),
);
/** Every icon the site serves, from the shared package directly. */
const iconFiles = (config: InstallBrand) =>
	webIconFiles(config, { root: BRAND_ROOT, generatedDir: GENERATED_DIR });

let root = "";
beforeAll(() => {
	// Real path: on macOS tmpdir() is a symlink, which Vite resolves.
	root = realpathSync(mkdtempSync(join(tmpdir(), "brand-install-assets-")));
	writeFileSync(join(root, "index.html"), INDEX_HTML);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

function isOutput(value: unknown): value is Rollup.RollupOutput {
	return typeof value === "object" && value !== null && "output" in value;
}

/** Files a production build of the fixture page writes, by name. */
async function buildFiles(
	config: InstallBrand,
): Promise<Map<string, string | Uint8Array>> {
	const result = await build({
		root,
		configFile: false,
		logLevel: "silent",
		plugins: [brandInstallAssets(config)],
		build: { write: false, outDir: join(root, "dist") },
	});
	if (!isOutput(result)) throw new Error("vite build returned no output");
	return new Map(
		result.output.map((file) => [
			file.fileName,
			file.type === "asset" ? file.source : file.code,
		]),
	);
}

const text = (value: string | Uint8Array | undefined): string =>
	typeof value === "string" ? value : new TextDecoder().decode(value);

describe("brandInstallAssets", () => {
	it("is off in brand.config.json until the icon is designed", () => {
		expect(brand.webInstall).toBe(false);
	});

	it("off: has no hooks; the build emits index.html only, unchanged", async () => {
		expect(Object.keys(brandInstallAssets(off))).toEqual(["name"]);
		const files = await buildFiles(off);
		expect([...files.keys()]).toEqual(["index.html"]);
		expect(text(files.get("index.html"))).toBe(INDEX_HTML);
	});

	it("on: emits the generated manifest and every icon, linked after the title", async () => {
		const files = await buildFiles(on);
		const icons = iconFiles(on);
		expect([...files.keys()].sort()).toEqual(
			["index.html", MANIFEST_PATH, ...icons.map((icon) => icon.path)].sort(),
		);
		for (const icon of icons) {
			expect(Buffer.from(files.get(icon.path) ?? ""), icon.path).toEqual(
				readFileSync(icon.file),
			);
		}
		expect(JSON.parse(text(files.get(MANIFEST_PATH)))).toEqual(
			generatedManifest,
		);
		const html = text(files.get("index.html"));
		const tags = [
			'<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">',
			'<link rel="icon" href="/icon.svg" type="image/svg+xml">',
			'<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">',
			`<link rel="manifest" href="/${MANIFEST_PATH}">`,
			`<meta name="theme-color" content="${on.colors.primary}">`,
			`<meta name="apple-mobile-web-app-title" content="${on.shortName}">`,
		];
		for (const tag of tags) expect(html).toContain(tag);
		expect(html.indexOf("</title>")).toBeLessThan(html.indexOf(tags[0] ?? ""));
	});

	it("on: the dev server serves the files with their types", async () => {
		const server = await createServer({
			root,
			configFile: false,
			logLevel: "silent",
			plugins: [brandInstallAssets(on)],
			server: { port: 0, host: "127.0.0.1", hmr: false, ws: false },
		});
		try {
			await server.listen();
			const address = server.httpServer?.address();
			if (typeof address !== "object" || address === null) {
				throw new Error("dev server is not listening on a port");
			}
			const get = (path: string) =>
				fetch(`http://127.0.0.1:${address.port}/${path}`);
			const manifest = await get(`${MANIFEST_PATH}?v=1`);
			expect(manifest.headers.get("content-type")).toBe(
				"application/manifest+json",
			);
			expect(await manifest.json()).toEqual(generatedManifest);
			const png = await get("icon-192.png");
			expect(png.headers.get("content-type")).toBe("image/png");
			const icon = iconFiles(on).find((f) => f.path === "icon-192.png");
			if (icon === undefined) throw new Error("no icon-192.png in the brand");
			expect(Buffer.from(await png.arrayBuffer())).toEqual(
				readFileSync(icon.file),
			);
		} finally {
			await server.close();
		}
	});
});
