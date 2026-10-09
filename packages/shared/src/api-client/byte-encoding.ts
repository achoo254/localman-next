/**
 * UTF-8 and base64 helpers that run the same in the browser and in Node,
 * without `Buffer` and without `btoa` (which rejects anything outside
 * Latin-1, so a Vietnamese password would throw).
 */

const ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_PATTERN =
	/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const LOOKUP = new Map<string, number>(
	[...ALPHABET].map((char, index) => [char, index]),
);

const encoder = new TextEncoder();

export function utf8Encode(text: string): Uint8Array {
	return encoder.encode(text);
}

/** Bytes `text` takes in UTF-8, without allocating them. */
export function utf8ByteLength(text: string): number {
	let bytes = 0;
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code < 0x80) bytes += 1;
		else if (code < 0x800) bytes += 2;
		else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
			const next = text.charCodeAt(i + 1);
			if (next >= 0xdc00 && next <= 0xdfff) {
				bytes += 4;
				i++;
			} else bytes += 3;
		} else bytes += 3;
	}
	return bytes;
}

/** The text, or `null` when the bytes are not valid UTF-8. */
export function decodeUtf8OrNull(bytes: Uint8Array): string | null {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

function charAt(index: number): string {
	return ALPHABET.charAt(index & 63);
}

export function bytesToBase64(bytes: Uint8Array): string {
	const out: string[] = [];
	let i = 0;
	for (; i + 2 < bytes.length; i += 3) {
		const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
		out.push(charAt(n >> 18) + charAt(n >> 12) + charAt(n >> 6) + charAt(n));
	}
	const rest = bytes.length - i;
	if (rest === 1) {
		const n = bytes[i] << 16;
		out.push(`${charAt(n >> 18)}${charAt(n >> 12)}==`);
	} else if (rest === 2) {
		const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
		out.push(`${charAt(n >> 18)}${charAt(n >> 12)}${charAt(n >> 6)}=`);
	}
	return out.join("");
}

export function isBase64(text: string): boolean {
	return BASE64_PATTERN.test(text);
}

/** Decoded size of a valid base64 string, without decoding it. */
export function base64DecodedLength(text: string): number {
	const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
	return (text.length / 4) * 3 - padding;
}

/** Throws on anything but canonical, padded base64. */
export function base64ToBytes(text: string): Uint8Array {
	if (!isBase64(text)) throw new Error("Invalid base64");
	const out = new Uint8Array(base64DecodedLength(text));
	let o = 0;
	for (let i = 0; i < text.length; i += 4) {
		const a = LOOKUP.get(text.charAt(i)) ?? 0;
		const b = LOOKUP.get(text.charAt(i + 1)) ?? 0;
		const c = LOOKUP.get(text.charAt(i + 2)) ?? 0;
		const d = LOOKUP.get(text.charAt(i + 3)) ?? 0;
		const n = (a << 18) | (b << 12) | (c << 6) | d;
		if (o < out.length) out[o++] = (n >> 16) & 255;
		if (o < out.length) out[o++] = (n >> 8) & 255;
		if (o < out.length) out[o++] = n & 255;
	}
	return out;
}
