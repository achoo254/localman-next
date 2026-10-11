import { describe, expect, it } from "vitest";
import {
	COLLECTION_TAGS_MAX,
	type CollectionStatus,
	collectionStatusSchema,
	collectionTagsSchema,
	isSingleEmoji,
	normalizeTags,
	validateStatus,
} from "./collection-tags.js";

const codes = (tags: string[]) =>
	normalizeTags(tags).problems.map((problem) => problem.code);
const custom = (name: string, emoji: string): CollectionStatus => ({
	kind: "custom",
	name,
	emoji,
});

describe("collection tags", () => {
	it("trims, lower-cases and drops repeats, case-insensitively", () => {
		expect(normalizeTags([" Payments ", "payments", "PAYMENTS", "v2"])).toEqual(
			{
				tags: ["payments", "v2"],
				problems: [],
			},
		);
	});

	it("accepts 1 to 64 characters and Unicode letters", () => {
		expect(codes(["a", "x".repeat(64), "đơn-hàng", "日本語", "β2"])).toEqual(
			[],
		);
		expect(codes(["x".repeat(65)])).toEqual(["too-long"]);
		expect(codes(["  "])).toEqual(["empty"]);
	});

	it("must start and end with a letter or digit", () => {
		expect(codes(["-api", "api-", "_x", "a b", "a-b"])).toEqual([
			"edges",
			"edges",
			"edges",
		]);
		expect(codes(["🙂"])).toEqual(["edges"]);
	});

	it("allows at most 10 distinct tags", () => {
		const ten = Array.from({ length: COLLECTION_TAGS_MAX }, (_, i) => `t${i}`);
		expect(codes(ten)).toEqual([]);
		expect(codes([...ten, "T0"])).toEqual([]);
		expect(codes([...ten, "t10"])).toEqual(["too-many"]);
	});

	it("parses through the schema to the normalized list", () => {
		expect(collectionTagsSchema.parse(["API", "api", "Docs"])).toEqual([
			"api",
			"docs",
		]);
		expect(collectionTagsSchema.safeParse(["-bad"]).success).toBe(false);
	});
});

describe("collection text hygiene", () => {
	it("normalizes to NFC and refuses invisible characters", () => {
		const decomposed = "cafe\u0301";
		expect(normalizeTags([decomposed, "café"]).tags).toEqual(["café"]);
		expect(codes(["a\u200bb", "a\u0000b", "a\u2028b", "a\u202eb"])).toEqual([
			"characters",
			"characters",
			"characters",
			"characters",
		]);
		expect(validateStatus(custom("Be\u200bta", "🧪"))).toBe("name-characters");
		const parsed = collectionStatusSchema.parse(custom(" Cafe\u0301 ", "☕"));
		expect(parsed).toEqual(custom("Café", "☕"));
	});

	it("refuses an emoji grapheme longer than 16 code points", () => {
		expect(isSingleEmoji(`👍${"\u0301".repeat(20)}`)).toBe(false);
	});
});

describe("collection status", () => {
	it("accepts presets and rejects unknown ones", () => {
		expect(validateStatus({ kind: "preset", preset: "stable" })).toBeNull();
		const unknown = collectionStatusSchema.safeParse({
			kind: "preset",
			preset: "gold",
		});
		expect(unknown.success).toBe(false);
	});

	it("needs a 2-64 character name starting with a letter", () => {
		expect(validateStatus(custom("QA", "🧪"))).toBeNull();
		expect(validateStatus(custom("Đang thử", "🚧"))).toBeNull();
		expect(validateStatus(custom("Q", "🧪"))).toBe("name-length");
		expect(validateStatus(custom("x".repeat(65), "🧪"))).toBe("name-length");
		expect(validateStatus(custom("2nd pass", "🧪"))).toBe("name-start");
	});

	it("needs exactly one emoji, multi-code-point ones included", () => {
		expect(isSingleEmoji("👍🏽")).toBe(true);
		expect(isSingleEmoji("👨‍👩‍👧")).toBe(true);
		expect(isSingleEmoji("🇻🇳")).toBe(true);
		expect(isSingleEmoji("1️⃣")).toBe(true);
		expect(isSingleEmoji("1")).toBe(false);
		expect(isSingleEmoji("🧪🧪")).toBe(false);
		expect(isSingleEmoji("a")).toBe(false);
		expect(isSingleEmoji("")).toBe(false);
		expect(validateStatus(custom("Lab", "x"))).toBe("emoji");
		expect(
			collectionStatusSchema.safeParse(custom("Lab", "🧪🧪")).success,
		).toBe(false);
	});
});
