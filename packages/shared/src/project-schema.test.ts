import { describe, expect, it } from "vitest";
import {
	PROJECT_NAME_MAX,
	normalizePrefix,
	projectInputSchema,
} from "./project-schema.js";

describe("normalizePrefix", () => {
	it.each([
		["", ""],
		["/", ""],
		["api", "/api"],
		["api/v1/", "/api/v1"],
		["//api//v1//", "/api/v1"],
		["  /x/y  ", "/x/y"],
	])("%j becomes %j", (raw, expected) => {
		expect(normalizePrefix(raw)).toBe(expected);
	});
});

describe("projectInputSchema", () => {
	it("accepts Vietnamese names and normalizes the prefix", () => {
		expect(
			projectInputSchema.parse({ name: " Dự án thử_1 (copy) ", prefix: "v1/" }),
		).toEqual({ name: "Dự án thử_1 (copy)", prefix: "/v1" });
	});

	it("composes decomposed Vietnamese input to NFC", () => {
		const decomposed = "Dự án".normalize("NFD");
		const parsed = projectInputSchema.parse({ name: decomposed });
		expect(parsed.name).toBe("Dự án".normalize("NFC"));
		expect(parsed.prefix).toBe("");
	});

	it.each([
		{ name: "" },
		{ name: "   " },
		{ name: "a".repeat(PROJECT_NAME_MAX + 1) },
		{ name: "<script>" },
		{ name: "a/b" },
		{ name: "(copy)" },
		{ name: "_hidden" },
		{ name: "-dash" },
		{ name: "ok", prefix: "/a b" },
		{ name: "ok", prefix: "/a?b" },
		{ name: "ok", prefix: "/a.b" },
	])("rejects %j", (input) => {
		expect(projectInputSchema.safeParse(input).success).toBe(false);
	});
});
