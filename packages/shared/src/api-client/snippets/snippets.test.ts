import { describe, expect, it } from "vitest";
import type { PreparedRequest } from "../request-preparer.js";
import {
	SNIPPET_TARGETS,
	type SnippetTarget,
	generateSnippet,
	isSnippetTarget,
	snippetSyntax,
} from "./snippet-registry.js";
import {
	BINARY_PUT,
	HOSTILE_PATCH,
	JSON_POST,
	UTF8_BYTES_POST,
	preparedRequest,
} from "./snippet-test-fixtures.js";

const code = (target: SnippetTarget, request: PreparedRequest): string =>
	generateSnippet(target, request).code;

describe("snippet registry", () => {
	it("has the 16 targets, each with a syntax", () => {
		expect(SNIPPET_TARGETS).toHaveLength(16);
		expect(new Set(SNIPPET_TARGETS).size).toBe(16);
		for (const target of SNIPPET_TARGETS)
			expect(snippetSyntax(target)).toBeTruthy();
		expect(isSnippetTarget("curl")).toBe(true);
		expect(isSnippetTarget("wget")).toBe(false);
	});

	it("refuses an unknown target or a method outside the list", () => {
		expect(() => generateSnippet("nope" as SnippetTarget, JSON_POST)).toThrow(
			RangeError,
		);
		const bad = {
			...JSON_POST,
			method: "GET; rm -rf /",
		} as unknown as PreparedRequest;
		expect(() => generateSnippet("curl", bad)).toThrow(RangeError);
	});

	it("omits a binary body and says so; keeps UTF-8 bytes", () => {
		const binary = generateSnippet("python-requests", BINARY_PUT);
		expect(binary.bodyOmitted).toBe(true);
		expect(binary.code).not.toContain("data=");
		const multipart = generateSnippet("curl", UTF8_BYTES_POST);
		expect(multipart.bodyOmitted).toBe(false);
		expect(multipart.code).toContain("Việt");
	});
});

describe.each(SNIPPET_TARGETS)("%s snippet", (target) => {
	it("matches the golden output for a JSON POST", () => {
		expect(code(target, JSON_POST)).toMatchSnapshot();
	});

	it("matches the golden output for hostile text", () => {
		expect(code(target, HOSTILE_PATCH)).toMatchSnapshot();
	});

	it("handles a bare GET and a HEAD", () => {
		for (const method of ["GET", "HEAD"] as const) {
			const output = code(target, preparedRequest({ method }));
			expect(output).toContain("api.example.com/users?page=1");
			expect(output).not.toMatch(/undefined|null\)|\[object/);
		}
	});
});
