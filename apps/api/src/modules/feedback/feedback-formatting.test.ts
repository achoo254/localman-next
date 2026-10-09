import { describe, expect, it } from "vitest";
import { maskEmail } from "../../lib/mask-email.js";
import { csvCell, toCsv } from "./csv-export.js";

describe("maskEmail", () => {
	it.each([
		["nguyen@gmail.com", "ng***@gm***.com"],
		["a@b.co", "a***@b***.co"],
		["dev@mail.example.vn", "de***@ma***.vn"],
		["broken", "***"],
	])("%s becomes %s", (email, masked) => {
		expect(maskEmail(email)).toBe(masked);
	});
});

describe("CSV export", () => {
	it.each([
		["=1+1", "'=1+1"],
		["+84 912", "'+84 912"],
		["-2", "'-2"],
		["@SUM(A1)", "'@SUM(A1)"],
		["\tcmd", "'\tcmd"],
		["plain", "plain"],
		['say "hi", ok', '"say ""hi"", ok"'],
		["line\nbreak", '"line\nbreak"'],
		[null, ""],
		[3, "3"],
	])("%j becomes %j", (value, expected) => {
		expect(csvCell(value)).toBe(expected);
	});

	it("starts with a BOM and ends rows with CRLF", () => {
		expect(toCsv(["a", "b"], [["1", null]])).toBe("\uFEFFa,b\r\n1,\r\n");
	});
});
