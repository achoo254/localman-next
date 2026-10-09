const MAX_PATH_LENGTH = 2048;
/** Placeholder origin: only the path part of the parsed URL is kept. */
const BASE = new URL("https://internal.invalid");

function hasControlCharacter(value: string): boolean {
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code < 0x20 || code === 0x7f) return true;
	}
	return false;
}

/** A browser reads `//host` and `/\host` as another host. */
function looksLikeAnotherHost(path: string): boolean {
	return path.startsWith("//") || path.startsWith("/\\");
}

/**
 * The normalized form of a path on this site, or `null`. The value must
 * start with a single `/` and hold no backslash or control character; it
 * is then resolved like a browser would (dot segments, `%2e`), must stay on
 * the same origin, and the result is checked again: `/.//evil.com` and
 * `/%2e%2e//evil.com` normalize to `//evil.com` and are refused. Callers
 * must use the returned string, never the raw input.
 */
export function normalizeInternalPath(value: unknown): string | null {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > MAX_PATH_LENGTH ||
		!value.startsWith("/") ||
		looksLikeAnotherHost(value) ||
		value.includes("\\") ||
		hasControlCharacter(value)
	) {
		return null;
	}
	let url: URL;
	try {
		url = new URL(value, BASE);
	} catch {
		return null;
	}
	if (url.origin !== BASE.origin) return null;
	const path = `${url.pathname}${url.search}${url.hash}`;
	if (looksLikeAnotherHost(path) || path.includes("\\")) return null;
	return path;
}
