import { describe, expect, it } from "vitest";
import { mentionedUsernames } from "./comment-mentions.js";

describe("mentionedUsernames", () => {
	it("finds each @username once, case-insensitively, in order", () => {
		expect(
			mentionedUsernames("@eve and @Ada, then @EVE again (@vic.) @x_1"),
		).toEqual(["eve", "Ada", "vic", "x_1"]);
	});

	it("ignores emails, words glued to @ and a lone @", () => {
		expect(mentionedUsernames("mail ada@example.com or a@b, @ alone")).toEqual(
			[],
		);
	});

	it("ignores names inside inline code and fenced blocks", () => {
		expect(
			mentionedUsernames("`@ada` and\n```\n@Override\n```\nthen @eve"),
		).toEqual(["eve"]);
	});

	it("keeps at most 20 people", () => {
		const body = Array.from({ length: 25 }, (_, i) => `@user${i}`).join(" ");
		expect(mentionedUsernames(body)).toHaveLength(20);
	});
});
