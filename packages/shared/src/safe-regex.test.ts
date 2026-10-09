import { describe, expect, it } from "vitest";
import {
	MAX_REGEX_INPUT,
	MAX_REGEX_LENGTH,
	unsafeRegexReason,
} from "./safe-regex.js";

describe("rule regex safety", () => {
	it.each([
		"admin",
		"^admin$",
		"^(admin|root)$",
		"^Bearer .+$",
		"@example\\.com$",
		"\\d+",
		"^[a-z]+@[a-z]+\\.com$",
		"^v\\d{1,3}\\.\\d{1,3}$",
		"(?:ab|cd)x",
		"^\\p{L}+$",
		"^[(*+)]+$",
		"colou?r",
		"^a.*?b$",
		"(?<role>admin)",
		// Counts past the longest input cost no more than `*`.
		"a{0,5000}",
		"a{10000,}",
		"\\w{0,99999}!",
	])("accepts %s", (pattern) => {
		expect(unsafeRegexReason(pattern)).toBeNull();
	});

	it.each([
		["(a+)+$", "A group cannot be repeated"],
		["(a|aa)*b", "A group cannot be repeated"],
		["(x){2}", "A group cannot be repeated"],
		["^(\\w+\\s?)*$", "A group cannot be repeated"],
		["(a)\\1", "Backreferences are not allowed"],
		["(?<x>a)\\k<x>", "Backreferences are not allowed"],
		["a(?=b)", "Lookahead and lookbehind are not allowed"],
		["(?<!a)b", "Lookahead and lookbehind are not allowed"],
		[".*.*x", "too complex"],
		["[a-z]+@[a-z]+", "too complex"],
		["^a*a*a*b", "too complex"],
		["a{0,5000}a{0,5000}", "too complex"],
		["\\w{0,99999}\\w{0,99999}!", "too complex"],
		["^\\w{0,99999}\\w{0,99999}\\w{0,99999}!", "too complex"],
		["\\w{10000,}\\w{10000,}", "too complex"],
		["(a|a){0,99999}$", "A group cannot be repeated"],
		["(?:a|a){1,99999}b", "A group cannot be repeated"],
		["(a+){1,99999}$", "A group cannot be repeated"],
		["(ab){10000,}", "A group cannot be repeated"],
		["^a{0,2000}a{0,2000}a{0,2000}b", "too complex"],
		["[", "Not a valid"],
		["", "empty"],
	])("refuses %s", (pattern, reason) => {
		expect(unsafeRegexReason(pattern)).toContain(reason);
	});

	it("reads quantifiers with any number of digits", () => {
		// Five digits were once read as literal text, hiding the repeat.
		const hostile = `${"a".repeat(26)}!`;
		for (const pattern of ["(a|a){0,99999}$", "(?:a|a){1,99999}b"]) {
			const started = performance.now();
			expect(unsafeRegexReason(pattern)).not.toBeNull();
			expect(performance.now() - started).toBeLessThan(50);
		}
		expect(unsafeRegexReason("a{1,2}")).toBeNull();
		expect(/^a{0,99999}$/u.test(hostile)).toBe(false);
	});

	it("caps the pattern length", () => {
		expect(unsafeRegexReason("a".repeat(MAX_REGEX_LENGTH))).toBeNull();
		expect(unsafeRegexReason("a".repeat(MAX_REGEX_LENGTH + 1))).toContain(
			"at most",
		);
	});

	it("accepted patterns stay fast on hostile input", () => {
		const input = `${"a".repeat(MAX_REGEX_INPUT - 1)}!`;
		for (const pattern of [
			"^a+a$",
			"a+$",
			"^[a-z]+@[a-z]+\\.com$",
			"\\w{0,99999}!",
			"^\\w{0,99999}\\w{0,99999}!",
		]) {
			expect(unsafeRegexReason(pattern)).toBeNull();
			const started = performance.now();
			new RegExp(pattern, "u").test(input);
			expect(performance.now() - started).toBeLessThan(200);
		}
	});
});
