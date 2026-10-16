import { describe, expect, it } from "vitest";
import {
	completeMention,
	mentionAt,
	suggestPeople,
} from "./mention-suggestions";

const PEOPLE = [
	{ username: "eve", name: "Eve Tran" },
	{ username: "ada", name: "Ada" },
	{ username: "adam", name: null },
];

describe("mention suggestions", () => {
	it("finds the @prefix right before the caret", () => {
		expect(mentionAt("hi @ad", 6)).toEqual({ start: 3, prefix: "ad" });
		expect(mentionAt("@", 1)).toEqual({ start: 0, prefix: "" });
		expect(mentionAt("mail a@b", 8)).toBeNull();
		expect(mentionAt("@ada done", 9)).toBeNull();
	});

	it("matches usernames and names from the start", () => {
		expect(suggestPeople(PEOPLE, "AD").map((p) => p.username)).toEqual([
			"ada",
			"adam",
		]);
		expect(suggestPeople(PEOPLE, "tran")).toEqual([]);
		expect(suggestPeople(PEOPLE, "Eve").map((p) => p.username)).toEqual([
			"eve",
		]);
	});

	it("completes the mention and moves the caret after it", () => {
		const query = { start: 3, prefix: "ad" };
		expect(completeMention("hi @ad!", 6, query, "adam")).toEqual({
			text: "hi @adam !",
			caret: 9,
		});
	});
});
