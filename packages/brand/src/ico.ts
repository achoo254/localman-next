// Copied from chat-next/packages/brand @a5be0b4; keep in sync until shared package exists.
export interface IcoImage {
	readonly size: number;
	readonly png: Uint8Array;
}

const HEADER = 6;
const ENTRY = 16;

/**
 * Packs PNG images into an .ico file (PNG-compressed entries, supported by
 * every browser that reads favicon.ico). Sizes must be 1 to 256 pixels.
 */
export function encodeIco(images: readonly IcoImage[]): Uint8Array {
	if (images.length === 0) throw new Error("encodeIco: no images");
	let offset = HEADER + ENTRY * images.length;
	const total =
		offset + images.reduce((sum, image) => sum + image.png.byteLength, 0);
	const out = new Uint8Array(total);
	const view = new DataView(out.buffer);
	view.setUint16(0, 0, true); // reserved
	view.setUint16(2, 1, true); // type: icon
	view.setUint16(4, images.length, true);
	images.forEach((image, index) => {
		if (!Number.isInteger(image.size) || image.size < 1 || image.size > 256) {
			throw new Error(`encodeIco: size ${image.size} is outside 1..256`);
		}
		const entry = HEADER + ENTRY * index;
		// Width and height 256 are written as 0.
		view.setUint8(entry, image.size % 256);
		view.setUint8(entry + 1, image.size % 256);
		view.setUint8(entry + 2, 0); // palette colours
		view.setUint8(entry + 3, 0); // reserved
		view.setUint16(entry + 4, 1, true); // colour planes
		view.setUint16(entry + 6, 32, true); // bits per pixel
		view.setUint32(entry + 8, image.png.byteLength, true);
		view.setUint32(entry + 12, offset, true);
		out.set(image.png, offset);
		offset += image.png.byteLength;
	});
	return out;
}
