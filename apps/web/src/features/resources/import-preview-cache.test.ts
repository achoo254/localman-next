import { describe, expect, it } from "vitest";
import {
	MAX_CACHED_PREVIEWS,
	PreviewCache,
	previewKey,
} from "./import-preview-cache";
import type { ImportPreview } from "./resource-import-api";

const preview = (relatedCount: number): ImportPreview => ({
	resources: [],
	warnings: [],
	schemaNames: [],
	selectedSchema: null,
	relatedCount,
	resourcesLeft: null,
});

describe("import preview cache", () => {
	it("keys a request by a short hash of its content", () => {
		const input = "x".repeat(2 * 1024 * 1024);
		const key = previewKey({ format: "csv", input });
		expect(key.length).toBeLessThan(32);
		expect(previewKey({ format: "csv", input })).toBe(key);
		expect(previewKey({ format: "csv", input: `${input.slice(1)}y` })).not.toBe(
			key,
		);
		expect(previewKey({ format: "json", input })).not.toBe(key);
	});

	it("keeps the most recently used previews only", () => {
		const cache = new PreviewCache();
		for (let i = 0; i <= MAX_CACHED_PREVIEWS; i += 1) {
			cache.set(`k${i}`, preview(i));
			if (i === 0) continue;
			// Reading k0 keeps it fresh while the others pile up.
			expect(cache.get("k0")?.relatedCount).toBe(0);
		}
		expect(cache.get("k1")).toBeUndefined();
		expect(cache.get("k0")?.relatedCount).toBe(0);
		expect(cache.get(`k${MAX_CACHED_PREVIEWS}`)?.relatedCount).toBe(
			MAX_CACHED_PREVIEWS,
		);
	});
});
