import { describe, expect, it } from "vitest";
import { availableSnippets } from "./script-snippets";

describe("availableSnippets", () => {
	it("offers scope writers only while environments are on", () => {
		const off = availableSnippets(false).map((snippet) => snippet.code);
		expect(
			off.some((code) =>
				/lm\.(environment|globals|collectionVariables)\./.test(code),
			),
		).toBe(false);
		expect(off).toContain('lm.variables.set("key", "value");');
		const on = availableSnippets(true).map((snippet) => snippet.id);
		expect(on).toEqual(
			expect.arrayContaining([
				"setEnvironment",
				"setCollectionVariable",
				"setGlobal",
				"saveToken",
			]),
		);
	});
});
