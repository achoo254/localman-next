/**
 * App Store Connect refuses an app icon or screenshot with an alpha channel,
 * and Chromium (Playwright) always writes RGBA PNGs. `toRgbPng` rewrites
 * such a PNG (8-bit, not interlaced: what Chromium writes) as an 8-bit RGB
 * PNG with the same pixels. Every pixel must already be opaque: dropping
 * real transparency would change the picture, so that fails instead.
 */
import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOUR_RGB = 2;
const COLOUR_RGBA = 6;

interface Chunk {
	readonly type: string;
	readonly data: Buffer;
}

function readChunks(png: Buffer): Chunk[] {
	if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
	const chunks: Chunk[] = [];
	let at = 8;
	while (at + 8 <= png.length) {
		const length = png.readUInt32BE(at);
		const type = png.toString("latin1", at + 4, at + 8);
		chunks.push({ type, data: png.subarray(at + 8, at + 8 + length) });
		at += 12 + length;
	}
	return chunks;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(bytes: Buffer): number {
	let c = 0xffffffff;
	for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function encodeChunk(type: string, data: Buffer): Buffer {
	const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data]);
	const out = Buffer.alloc(8 + data.length + 4);
	out.writeUInt32BE(data.length, 0);
	typeAndData.copy(out, 4);
	out.writeUInt32BE(crc32(typeAndData), 8 + data.length);
	return out;
}

function paeth(a: number, b: number, c: number): number {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	return pb <= pc ? b : c;
}

/** Prediction of PNG filter `type` from the left (a), upper (b) and upper-left (c) bytes. */
function predict(type: number, a: number, b: number, c: number): number {
	switch (type) {
		case 0:
			return 0;
		case 1:
			return a;
		case 2:
			return b;
		case 3:
			return (a + b) >> 1;
		case 4:
			return paeth(a, b, c);
		default:
			throw new Error(`PNG row filter ${type} is not defined`);
	}
}

/** Raw pixel rows of filtered PNG image data, `bpp` bytes per pixel. */
export function unfilterRows(
	data: Buffer,
	width: number,
	height: number,
	bpp: number,
): Buffer {
	const stride = width * bpp;
	if (data.length < (stride + 1) * height) throw new Error("PNG data is short");
	const out = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		const type = data[y * (stride + 1)] ?? 0;
		const src = y * (stride + 1) + 1;
		const row = y * stride;
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? (out[row + x - bpp] ?? 0) : 0;
			const b = y > 0 ? (out[row - stride + x] ?? 0) : 0;
			const c = x >= bpp && y > 0 ? (out[row - stride + x - bpp] ?? 0) : 0;
			out[row + x] = ((data[src + x] ?? 0) + predict(type, a, b, c)) & 0xff;
		}
	}
	return out;
}

/** Filters each row with whichever PNG filter gives the smallest absolute sum (the usual heuristic). */
function filterRows(
	pixels: Buffer,
	width: number,
	height: number,
	bpp: number,
): Buffer {
	const stride = width * bpp;
	const out = Buffer.alloc((stride + 1) * height);
	const candidate = Buffer.alloc(stride);
	for (let y = 0; y < height; y++) {
		const row = y * stride;
		let best = Number.POSITIVE_INFINITY;
		for (let type = 0; type <= 4; type++) {
			let cost = 0;
			for (let x = 0; x < stride; x++) {
				const a = x >= bpp ? (pixels[row + x - bpp] ?? 0) : 0;
				const b = y > 0 ? (pixels[row - stride + x] ?? 0) : 0;
				const c = x >= bpp && y > 0 ? (pixels[row - stride + x - bpp] ?? 0) : 0;
				const value = ((pixels[row + x] ?? 0) - predict(type, a, b, c)) & 0xff;
				candidate[x] = value;
				cost += value < 128 ? value : 256 - value;
			}
			if (cost < best) {
				best = cost;
				out[y * (stride + 1)] = type;
				candidate.copy(out, y * (stride + 1) + 1);
			}
		}
	}
	return out;
}

/** Width, height and colour type of a PNG, read from its header. */
export function pngInfo(png: Buffer): {
	width: number;
	height: number;
	colourType: number;
} {
	const header = readChunks(png).find((c) => c.type === "IHDR")?.data;
	if (!header) throw new Error("PNG without IHDR");
	return {
		width: header.readUInt32BE(0),
		height: header.readUInt32BE(4),
		colourType: header[9] ?? -1,
	};
}

/** The same opaque image as an RGB PNG (no alpha channel); an RGB PNG comes back unchanged. */
export function toRgbPng(png: Buffer): Buffer {
	const chunks = readChunks(png);
	const header = chunks.find((c) => c.type === "IHDR")?.data;
	if (!header) throw new Error("PNG without IHDR");
	const width = header.readUInt32BE(0);
	const height = header.readUInt32BE(4);
	const [depth, colour, , , interlace] = header.subarray(8, 13);
	if (colour === COLOUR_RGB && depth === 8) return png;
	if (depth !== 8 || interlace !== 0 || colour !== COLOUR_RGBA) {
		throw new Error(
			`unsupported PNG (depth ${depth}, colour ${colour}, interlace ${interlace})`,
		);
	}
	const idat = Buffer.concat(
		chunks.filter((c) => c.type === "IDAT").map((c) => c.data),
	);
	const rgba = unfilterRows(inflateSync(idat), width, height, 4);
	const rgb = Buffer.alloc(width * height * 3);
	for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
		if (rgba[i + 3] !== 0xff) {
			throw new Error("the image has transparent pixels; flatten it first");
		}
		rgb[j] = rgba[i] ?? 0;
		rgb[j + 1] = rgba[i + 1] ?? 0;
		rgb[j + 2] = rgba[i + 2] ?? 0;
	}
	const ihdr = Buffer.from(header);
	ihdr[9] = COLOUR_RGB;
	return Buffer.concat([
		SIGNATURE,
		encodeChunk("IHDR", ihdr),
		encodeChunk(
			"IDAT",
			deflateSync(filterRows(rgb, width, height, 3), { level: 9 }),
		),
		encodeChunk("IEND", Buffer.alloc(0)),
	]);
}
