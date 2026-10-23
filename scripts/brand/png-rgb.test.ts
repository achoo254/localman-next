import { deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { pngInfo, toRgbPng, unfilterRows } from "./png-rgb.js";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A chunk with a zero CRC: the converter does not check CRCs of its input. */
function chunk(type: string, data: Buffer): Buffer {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(data.length, 0);
	head.write(type, 4, "latin1");
	return Buffer.concat([head, data, Buffer.alloc(4)]);
}

/** An unfiltered 8-bit RGBA PNG of `pixels`. */
function rgbaPng(pixels: number[], width: number, height: number): Buffer {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const raw: number[] = [];
	for (let y = 0; y < height; y++) {
		raw.push(0, ...pixels.slice(y * width * 4, (y + 1) * width * 4));
	}
	return Buffer.concat([
		SIGNATURE,
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(Buffer.from(raw))),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** Decoded RGB pixels of an RGB PNG. */
function rgbPixels(png: Buffer): number[] {
	const { width, height } = pngInfo(png);
	const idatAt = png.indexOf("IDAT", 8, "latin1");
	const length = png.readUInt32BE(idatAt - 4);
	const data = inflateSync(png.subarray(idatAt + 4, idatAt + 4 + length));
	return [...unfilterRows(data, width, height, 3)];
}

describe("toRgbPng", () => {
	// 3 × 2, varied enough that the row filters differ.
	const rgba = [
		[110, 86, 207],
		[255, 255, 255],
		[17, 17, 19],
		[249, 249, 251],
		[0, 128, 255],
		[110, 86, 207],
	].flatMap(([r = 0, g = 0, b = 0]) => [r, g, b, 255]);

	it("keeps every pixel and drops the alpha channel", () => {
		const out = toRgbPng(rgbaPng(rgba, 3, 2));
		expect(pngInfo(out)).toEqual({ width: 3, height: 2, colourType: 2 });
		expect(rgbPixels(out)).toEqual(rgba.filter((_, i) => i % 4 !== 3));
	});

	it("returns an RGB PNG unchanged", () => {
		const rgb = toRgbPng(rgbaPng(rgba, 3, 2));
		expect(toRgbPng(rgb)).toBe(rgb);
	});

	it("refuses transparent pixels instead of changing the picture", () => {
		const holed = [...rgba];
		holed[7] = 0;
		expect(() => toRgbPng(rgbaPng(holed, 3, 2))).toThrow(/transparent/);
	});

	it("refuses what is not a PNG", () => {
		expect(() => toRgbPng(Buffer.from("not a png"))).toThrow(/not a PNG/);
	});
});
