import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSquareSvg, splitMaskable } from "./icon-svg.js";
import { BRAND_ROOT, loadLocalmanBrand } from "./localman-brand.js";
import {
	NATIVE_SOURCE_RECORD,
	nativeBrandOf,
	nativeSourceRecord,
} from "./native-assets-write.js";
import { nativePictures } from "./native-assets.js";
import { nativeTextFiles } from "./native-resource-files.js";
import { pngInfo } from "./png-rgb.js";

const native = nativeBrandOf(loadLocalmanBrand(), BRAND_ROOT);
const read = (path: string): Buffer => readFileSync(new URL(path, BRAND_ROOT));
const svg = (body: string, size = 512) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${body}</svg>`;

describe("splitMaskable", () => {
	it("splits the brand maskable icon into a background and its artwork", () => {
		const { background, foreground } = splitMaskable(
			native.maskableSvg,
			"iconMaskable",
		);
		expect(parseSquareSvg(background, "bg").body).toMatch(/^<rect\b/);
		expect(background).not.toContain("<path");
		expect(foreground).toContain("<path");
		expect(foreground).not.toContain("<rect");
	});

	it("keeps <defs> with both layers so gradients still resolve", () => {
		const defs = '<defs><linearGradient id="g"/></defs>';
		const layers = splitMaskable(
			svg(
				`${defs}<rect width="512" height="512" fill="url(#g)"/><circle r="9"/>`,
			),
			"test",
		);
		expect(layers.background).toContain(defs);
		expect(layers.foreground).toContain(defs);
	});

	it("fails on an SVG that breaks the background-first convention", () => {
		expect(() => splitMaskable(svg('<circle r="9"/>'), "test")).toThrow(
			/first element/,
		);
		expect(() =>
			splitMaskable(
				svg('<rect width="400" height="512"/><circle r="9"/>'),
				"test",
			),
		).toThrow(/cover the canvas/);
		expect(() =>
			splitMaskable(svg('<rect width="512" height="512"/>'), "test"),
		).toThrow(/no artwork/);
		expect(() =>
			parseSquareSvg('<svg viewBox="0 0 10 20"></svg>', "test"),
		).toThrow(/square viewBox/);
	});
});

describe("native app assets (run pnpm brand:gen after editing the brand)", () => {
	it("were drawn from the current brand SVGs, colours and name", () => {
		const recorded: unknown = JSON.parse(
			read(NATIVE_SOURCE_RECORD).toString("utf8"),
		);
		expect(recorded).toEqual(nativeSourceRecord(native));
	});

	it("have every picture at its size, without alpha where stores require it", () => {
		for (const picture of nativePictures(native, Buffer.alloc(0))) {
			expect(existsSync(new URL(picture.path, BRAND_ROOT)), picture.path).toBe(
				true,
			);
			const info = pngInfo(read(picture.path));
			expect([info.width, info.height], picture.path).toEqual([
				picture.width,
				picture.height,
			]);
			if (picture.opaque) expect(info.colourType, picture.path).toBe(2);
		}
	});

	it("include the App Store icon at 1024 px", () => {
		const icon = nativePictures(native, Buffer.alloc(0)).find((picture) =>
			picture.path.includes("AppIcon.appiconset/"),
		);
		expect(icon).toMatchObject({ width: 1024, height: 1024, opaque: true });
	});

	it("have the text resources byte for byte", () => {
		for (const { path, text } of nativeTextFiles(native)) {
			expect(read(path).toString("utf8"), path).toBe(text);
		}
	});
});
