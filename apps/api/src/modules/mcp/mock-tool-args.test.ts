import { OperationError } from "@localman/operations";
import type { MockToolAction } from "@localman/shared";
import { describe, expect, it } from "vitest";
import { readToolArgs } from "./mock-tool-args.js";
import type { MockToolDefinition } from "./mock-tool-factory.js";

function tool(action: MockToolAction, nested: boolean): MockToolDefinition {
	return {
		name: `${action}_posts`,
		title: "",
		description: "",
		inputSchema: {
			$schema: "https://json-schema.org/draft/2020-12/schema",
			type: "object",
			properties: {},
			required: [],
			additionalProperties: false,
		},
		annotations: {},
		target: {
			resourceId: "r",
			action,
			parentChain: nested ? ["parent"] : [],
		},
	};
}

function codeOf(run: () => unknown): string | null {
	try {
		run();
		return null;
	} catch (error) {
		return error instanceof OperationError ? error.code : "UNEXPECTED";
	}
}

describe("readToolArgs", () => {
	it("turns list arguments into REST query strings", () => {
		const call = readToolArgs(tool("list", true), {
			parentId: "7",
			title: "a",
			page: 2,
			done: false,
		});
		expect(call).toEqual({
			parentId: "7",
			recordId: null,
			call: {
				query: { title: "a", page: "2", done: "false" },
				body: undefined,
			},
		});
		expect(codeOf(() => readToolArgs(tool("list", false), { x: {} }))).toBe(
			"VALIDATION_ERROR",
		);
	});

	it("takes id and data for record tools", () => {
		expect(
			readToolArgs(tool("update", false), { id: "3", data: { a: 1 } }),
		).toEqual({
			parentId: null,
			recordId: "3",
			call: { query: {}, body: { a: 1 } },
		});
		expect(readToolArgs(tool("create", false), {}).call.body).toEqual({});
	});

	it("refuses arguments the tool does not advertise", () => {
		const refused = [
			() => readToolArgs(tool("get", false), { parentId: "1", id: "1" }),
			() => readToolArgs(tool("get", false), {}),
			() => readToolArgs(tool("get", false), { id: "1", extra: true }),
			() => readToolArgs(tool("create", true), { data: {} }),
			() => readToolArgs(tool("update", false), { id: "1" }),
			() => readToolArgs(tool("delete", false), { id: "x".repeat(65) }),
		];
		expect(refused.map(codeOf)).toEqual(refused.map(() => "VALIDATION_ERROR"));
	});
});
