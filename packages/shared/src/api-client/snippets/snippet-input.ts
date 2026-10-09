/**
 * What a snippet generator receives: the prepared request with its body as
 * text (`null` when there is none or it is not UTF-8), plus header helpers
 * for languages whose header API is a map and cannot repeat a name.
 */
import type { HeaderEntry, HttpMethod } from "../request-model.js";

export interface SnippetRequest {
	method: HttpMethod;
	url: string;
	/** In order; a name may repeat. */
	headers: readonly HeaderEntry[];
	body: string | null;
}

export type SnippetGenerator = (request: SnippetRequest) => string;

const sameName = (a: string, b: string): boolean =>
	a.toLowerCase() === b.toLowerCase();

/**
 * One entry per name (first spelling kept) for map-based header APIs.
 * Repeated values are joined as HTTP allows: `, ` (`; ` for Cookie).
 */
export function mergedHeaders(headers: readonly HeaderEntry[]): HeaderEntry[] {
	const out: HeaderEntry[] = [];
	for (const header of headers) {
		const found = out.find((h) => sameName(h.name, header.name));
		if (!found) out.push({ ...header });
		else {
			const separator = sameName(header.name, "cookie") ? "; " : ", ";
			found.value = `${found.value}${separator}${header.value}`;
		}
	}
	return out;
}

/** Value of the first header named `name`, or `null`. */
export function headerValue(
	headers: readonly HeaderEntry[],
	name: string,
): string | null {
	return headers.find((h) => sameName(h.name, name))?.value ?? null;
}

/** The headers without those named `name`. */
export function withoutHeader(
	headers: readonly HeaderEntry[],
	name: string,
): HeaderEntry[] {
	return headers.filter((h) => !sameName(h.name, name));
}

/** `true` when every character is ASCII (no encoding question arises). */
export function isAscii(text: string): boolean {
	for (let i = 0; i < text.length; i += 1) {
		if (text.charCodeAt(i) > 0x7f) return false;
	}
	return true;
}

/**
 * `items` each followed by `,` and indented (every line of a multi-line
 * item, so blocks nest), between the `open` and `close` lines. Items must
 * not hold a raw line break inside a string literal: it would be indented.
 */
export function block(
	open: string,
	items: readonly string[],
	close: string,
	indent = "  ",
): string {
	const body = items.map((item) =>
		`${item},`
			.split("\n")
			.map((line) => `${indent}${line}`)
			.join("\n"),
	);
	return [open, ...body, close].join("\n");
}
