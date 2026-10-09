import { describe, expect, it } from "vitest";
import { isTestFile, scanHtml, scanScript } from "./scan-copy.js";

const BOTH = new Set(["vietnamese", "competitor"] as const);

describe("scanScript", () => {
	it("flags Vietnamese in string literals, templates and JSX text", () => {
		const source = [
			'const a = "Đăng nhập";',
			"const b = `Có ${n} project`;",
			"const c = <p>Xin chào</p>;",
			'const d = <Button aria-label="Xoá">x</Button>;',
		].join("\n");
		expect(
			scanScript(source, "a.tsx", BOTH).map((v) => [v.line, v.rule]),
		).toEqual([
			[1, "vietnamese"],
			[2, "vietnamese"],
			[3, "vietnamese"],
			[4, "vietnamese"],
		]);
	});

	it("ignores comments, English and Chinese", () => {
		const source = [
			"// Bỏ qua tới nội dung, so với mockapi.io",
			"/** Postman có code mock */",
			'const a = "Sign in";',
			'const b = "免费开始";',
		].join("\n");
		expect(scanScript(source, "a.ts", BOTH)).toEqual([]);
	});

	it("flags competitor names in any case", () => {
		const source =
			'const a = "Compared with Postman";\nconst b = `MockAPI.io`;';
		expect(
			scanScript(source, "a.ts", new Set(["competitor"])).map((v) => v.line),
		).toEqual([1, 2]);
	});

	it("applies only the rules asked for", () => {
		expect(
			scanScript('const a = "Đăng nhập";', "vi.ts", new Set(["competitor"])),
		).toEqual([]);
	});

	it("skips a line with an ignore marker that gives a reason", () => {
		const source = [
			'const a = "Tiếng Việt"; // check-i18n-ignore: endonym',
			'const b = "Tiếng Việt"; // check-i18n-ignore:',
		].join("\n");
		expect(scanScript(source, "a.ts", BOTH).map((v) => v.line)).toEqual([2]);
	});
});

describe("scanHtml", () => {
	it("reads the page but not its comments", () => {
		const html = [
			"<!-- như mockapi.io",
			"     và Postman -->",
			"<title>Localman</title>",
			'<meta name="description" content="Dựng mock" />',
			"<p>Better than Postman</p>",
		].join("\n");
		expect(scanHtml(html, "index.html").map((v) => [v.line, v.rule])).toEqual([
			[4, "vietnamese"],
			[5, "competitor"],
		]);
	});
});

describe("isTestFile", () => {
	it.each([
		["apps/web/src/a.test.ts", true],
		["apps/web/src/a.test.tsx", true],
		["apps/web/src/pages/landing/landing-test-helpers.tsx", true],
		["apps/web/src/test/fixtures.ts", true],
		["apps/web/src/pages/landing/landing-page.tsx", false],
		["apps/web/src/i18n/messages/vi/layout.ts", false],
	])("%s is a test file: %s", (file, expected) => {
		expect(isTestFile(file)).toBe(expected);
	});
});
