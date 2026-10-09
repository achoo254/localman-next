import { describe, expect, it } from "vitest";
import {
	emptyDraft,
	feedbackSourceFor,
	fieldErrorsFromDetails,
	toFeedbackBody,
} from "./feedback-draft";

describe("feedbackSourceFor", () => {
	it.each([
		["/", "landing"],
		["/projects/abc", "projects"],
		["/invite/secret-token", "invite"],
		["/account/notifications", "account"],
		["/_primitives", "other"],
	])("%s is sent as %s", (path, source) => {
		expect(feedbackSourceFor(path)).toBe(source);
	});
});

describe("toFeedbackBody", () => {
	it("trims the text and leaves out empty optional fields", () => {
		const draft = { ...emptyDraft(null), message: "  Hi  ", name: "  " };
		expect(toFeedbackBody(draft, "docs", null)).toEqual({
			category: "feedback",
			message: "Hi",
			source: "docs",
			website: "",
		});
	});
});

describe("fieldErrorsFromDetails", () => {
	it("keeps only the form's fields", () => {
		expect(
			fieldErrorsFromDetails([
				{ path: "message", message: "Too big" },
				{ path: "source", message: "?" },
				"junk",
			]),
		).toEqual({ message: "Nhập nội dung, tối đa 2.000 ký tự." });
		expect(fieldErrorsFromDetails(undefined)).toEqual({});
	});
});
