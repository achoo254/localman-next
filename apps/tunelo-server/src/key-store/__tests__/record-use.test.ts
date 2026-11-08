import { expect, test } from "vitest";
import { shouldRecordUse } from "../mongo-key-store.js";

test("lastUsedAt is written at most once a minute per key", () => {
	const t0 = 1_000_000;
	expect(shouldRecordUse("k-throttle", t0)).toBe(true);
	expect(shouldRecordUse("k-throttle", t0 + 59_000)).toBe(false);
	expect(shouldRecordUse("k-other", t0 + 59_000)).toBe(true);
	expect(shouldRecordUse("k-throttle", t0 + 60_000)).toBe(true);
});
