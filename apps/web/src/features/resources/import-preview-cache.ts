import type { ImportPreview, ImportRequest } from "./resource-import-api";

/** Previews kept per dialog: enough to switch between tabs and back. */
export const MAX_CACHED_PREVIEWS = 5;

/**
 * Short cache key of a request: its JSON length and a 53-bit hash
 * (cyrb53) of it, so the cache holds no copy of up to 5 MB of source.
 * A clash would only show another preview; creating sends the request.
 */
export function previewKey(request: ImportRequest): string {
	const text = JSON.stringify(request);
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < text.length; i += 1) {
		const code = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
	return `${text.length}:${hash.toString(36)}`;
}

/** Previews by `previewKey`, least recently used dropped first. */
export class PreviewCache {
	private readonly entries = new Map<string, ImportPreview>();

	get(key: string): ImportPreview | undefined {
		const preview = this.entries.get(key);
		if (preview !== undefined) {
			this.entries.delete(key);
			this.entries.set(key, preview);
		}
		return preview;
	}

	set(key: string, preview: ImportPreview): void {
		this.entries.delete(key);
		this.entries.set(key, preview);
		if (this.entries.size > MAX_CACHED_PREVIEWS) {
			const oldest = this.entries.keys().next();
			if (!oldest.done) this.entries.delete(oldest.value);
		}
	}
}
