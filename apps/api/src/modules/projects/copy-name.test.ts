import { PROJECT_NAME_MAX, projectNameSchema } from "@localman/shared";
import { describe, expect, it } from "vitest";
import { copyName } from "./project-service.js";

describe("copyName", () => {
	it("appends (copy) to a short name", () => {
		expect(copyName("Shop")).toBe("Shop (copy)");
	});

	it("shortens a long name to fit, without trailing spaces", () => {
		const name = `${"a".repeat(52)} bcdefgh`;
		const copy = copyName(name);
		expect(copy).toBe(`${"a".repeat(52)} (copy)`);
		expect(copy.length).toBeLessThanOrEqual(PROJECT_NAME_MAX);
	});

	it("never splits a character outside the BMP and stays a valid name", () => {
		// U+1D400 is a letter encoded as a surrogate pair.
		const name = "\u{1D400}".repeat(PROJECT_NAME_MAX / 2);
		const copy = copyName(name);
		expect(copy.length).toBeLessThanOrEqual(PROJECT_NAME_MAX);
		expect(copy).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
		expect(Array.from(copy.replace(" (copy)", ""))).toEqual(
			Array(26).fill("\u{1D400}"),
		);
		expect(projectNameSchema.safeParse(copy).success).toBe(true);
	});
});
