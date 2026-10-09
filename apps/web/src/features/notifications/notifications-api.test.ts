import { describe, expect, it } from "vitest";
import { inAppPath } from "./notifications-api";

describe("inAppPath", () => {
	it("keeps in-app paths and same-origin URLs", () => {
		expect(inAppPath("/projects/demo?tab=log#top")).toBe(
			"/projects/demo?tab=log#top",
		);
		expect(inAppPath(`${window.location.origin}/account`)).toBe("/account");
		expect(inAppPath(null)).toBeNull();
	});

	it("drops links to other origins", () => {
		for (const link of [
			"https://evil.com/x",
			"//evil.com/x",
			"/\\evil.com",
			"javascript:alert(1)",
		]) {
			expect(inAppPath(link)).toBeNull();
		}
	});

	it.each([
		"/.//evil.com",
		"/%2e//evil.com",
		"/..//evil.com",
		"/a/../..//evil.com",
	])("drops %s, which resolves to a protocol-relative path", (link) => {
		expect(inAppPath(link)).toBeNull();
	});
});
