import { describe, expect, it } from "vitest";
import { normalizeInternalPath } from "../../http/internal-path.js";
import { DEFAULT_RETURN_TO, safeReturnTo } from "./return-to.js";
import { DOT_SEGMENT_REDIRECTS } from "./testing/redirect-payloads.js";

describe("safeReturnTo", () => {
	it.each([
		["/projects", "/projects"],
		["/projects/a?tab=api#x", "/projects/a?tab=api#x"],
		["/a/../b", "/b"],
		["/a/./b//c", "/a/b//c"],
		// An encoded backslash is only a path character, not a host switch.
		["/%5Cevil", "/%5Cevil"],
		// The Run button page returns to itself after sign-in.
		["/run/AbCdEf_-0123456789xy", "/run/AbCdEf_-0123456789xy"],
	])("keeps the internal path %s as %s", (value, expected) => {
		expect(safeReturnTo(value)).toBe(expected);
	});

	it.each([
		undefined,
		"",
		"projects",
		"https://evil.example",
		"//evil.example",
		"/\\evil.example",
		"/x\nLocation: https://evil.example",
		// Browsers drop tabs and newlines in URLs: `/\t/evil` is `//evil`.
		"/\t/evil.com",
		"/\n/evil.com",
		"javascript:alert(1)",
		["/projects"],
		`/${"a".repeat(3000)}`,
		...DOT_SEGMENT_REDIRECTS,
	])("falls back to the default for %j", (value) => {
		expect(safeReturnTo(value)).toBe(DEFAULT_RETURN_TO);
	});

	it("never returns a value a browser reads as another host", () => {
		for (const value of DOT_SEGMENT_REDIRECTS) {
			expect(normalizeInternalPath(value)).toBeNull();
		}
	});
});
