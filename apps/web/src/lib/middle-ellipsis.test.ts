import { describe, expect, it } from "vitest";
import { MIDDLE_ELLIPSIS_TAIL, middleEllipsisParts } from "./middle-ellipsis";

describe("middleEllipsisParts", () => {
	it("keeps the last characters apart so the distinct ending stays visible", () => {
		const name = "customer-relationship-management-contacts-name-01";
		const { head, tail } = middleEllipsisParts(name);
		expect(tail).toBe("-name-01");
		expect(tail).toHaveLength(MIDDLE_ELLIPSIS_TAIL);
		expect(head + tail).toBe(name);
	});

	it("leaves a short text whole", () => {
		expect(middleEllipsisParts("users")).toEqual({ head: "users", tail: "" });
		expect(middleEllipsisParts("1234567890abcdef")).toEqual({
			head: "1234567890abcdef",
			tail: "",
		});
		expect(middleEllipsisParts("")).toEqual({ head: "", tail: "" });
	});

	it("never cuts a combining accent, a CJK character or an emoji", () => {
		// "ệ" written as e + two combining marks is one grapheme.
		const vietnamese = "Tên dự án tiếng Việt rất dài kiệu";
		const { head, tail } = middleEllipsisParts(vietnamese, 3);
		expect(tail).toBe("iệu");
		expect(head + tail).toBe(vietnamese);
		expect(middleEllipsisParts("中文项目混合树的很长名字", 2).tail).toBe(
			"名字",
		);
		expect(middleEllipsisParts("👩‍👩‍👧 family tree 👨‍👨‍👦", 2).tail).toBe(
			" 👨‍👨‍👦",
		);
	});

	it("treats a zero or negative tail as no split", () => {
		expect(middleEllipsisParts("a-very-long-name-01", 0).tail).toBe("");
		expect(middleEllipsisParts("a-very-long-name-01", -2).tail).toBe("");
	});
});
