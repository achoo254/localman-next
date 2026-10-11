/**
 * Cutting imported text to the server's limits. Lengths are UTF-16 code
 * units, as zod's `.max` counts them; a cut never splits a surrogate pair.
 * Example bodies are limited in UTF-8 bytes and cut at a code point.
 */
import { utf8ByteLength } from "../byte-encoding.js";
import type { ImportContext } from "./import-context.js";

/** `text` cut to at most `max` code units. */
export function sliceUnits(text: string, max: number): string {
	if (text.length <= max) return text;
	const last = text.charCodeAt(max - 1);
	const splitsPair = last >= 0xd800 && last <= 0xdbff;
	return text.slice(0, splitsPair ? max - 1 : max);
}

function utf8Size(codePoint: number): number {
	if (codePoint < 0x80) return 1;
	if (codePoint < 0x800) return 2;
	return codePoint < 0x10000 ? 3 : 4;
}

/** `text` cut to at most `maxBytes` UTF-8 bytes, between code points. */
export function sliceUtf8(text: string, maxBytes: number): string {
	if (utf8ByteLength(text) <= maxBytes) return text;
	let bytes = 0;
	let end = 0;
	for (const char of text) {
		const size = utf8Size(char.codePointAt(0) ?? 0);
		if (bytes + size > maxBytes) break;
		bytes += size;
		end += char.length;
	}
	return text.slice(0, end);
}

/** `text` cut to `max` code units, with a `TEXT_TRUNCATED` warning. */
export function fitText(
	text: string,
	max: number,
	ctx: ImportContext,
	path: string,
): string {
	if (text.length <= max) return text;
	ctx.warn("TEXT_TRUNCATED", path, { max });
	return sliceUnits(text, max);
}

/** A name the server accepts: not blank (else `fallback`), at most `max`. */
export function fitName(
	name: string,
	fallback: string,
	max: number,
	ctx: ImportContext,
	path: string,
): string {
	const named = name.trim() ? name : fallback.trim() ? fallback : "Untitled";
	return fitText(named, max, ctx, path);
}
