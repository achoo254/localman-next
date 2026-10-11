import { createRequestDraft } from "@localman/shared/api-client";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isDirty } from "./draft-compare";
import { useBindingWrites } from "./use-binding-writes";

const SOURCE = { collectionId: "c1", nodeId: "r1" };

describe("useBindingWrites", () => {
	it("sends a binding once, null to unbind, nothing for never-bound tabs", () => {
		const { result } = renderHook(() => useBindingWrites());
		const writes = result.current;
		expect(writes.write("loose", null)).toBeUndefined();
		writes.restored("t1", SOURCE);
		// A save on the way out (keepalive) sends the unbind too.
		expect(writes.peek("t1", null)).toBeNull();
		expect(writes.write("t1", null)).toBeNull();
		expect(writes.write("t1", null)).toBeUndefined();
		expect(writes.write("t1", SOURCE)).toBe(SOURCE);
	});

	it("tells when a tab's binding changed", () => {
		const { result } = renderHook(() => useBindingWrites());
		expect(result.current.changed("t1", null)).toBe(false);
		expect(result.current.changed("t1", SOURCE)).toBe(true);
		expect(result.current.changed("t1", SOURCE)).toBe(false);
	});
});

describe("isDirty", () => {
	it("compares content, whatever the key order or object", () => {
		const saved = createRequestDraft({ url: "https://a.test" });
		const same = structuredClone(saved);
		expect(isDirty(same, saved)).toBe(false);
		expect(isDirty({ ...saved, url: "https://b.test" }, saved)).toBe(true);
		expect(isDirty(saved, null)).toBe(true);
	});
});
