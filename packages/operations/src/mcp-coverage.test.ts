import { describe, expect, it } from "vitest";
import { sampleOperations } from "./__fixtures__/sample-operations.js";
import { findMcpCoverageViolations } from "./mcp-coverage.js";

describe("findMcpCoverageViolations", () => {
	it("passes a registry where every operation has MCP or a reasoned exemption", () => {
		expect(findMcpCoverageViolations(sampleOperations)).toEqual([]);
	});

	it("flags an operation that declares no MCP exposure", () => {
		const { mcp: _mcp, ...withoutMcp } = sampleOperations[0] ?? {};
		const violations = findMcpCoverageViolations([withoutMcp]);
		expect(violations).toEqual([
			expect.objectContaining({
				operationId: "mock.getResource",
				code: "MISSING_MCP",
			}),
		]);
	});

	it("flags empty exemptions, malformed mcp values and unsafe destructive ops", () => {
		const violations = findMcpCoverageViolations([
			{ id: "client.a", mcp: { exempt: "" } },
			{ id: "client.b", mcp: false },
			{
				id: "client.c",
				mcp: { exempt: "internal" },
				annotations: { destructive: true },
			},
			"not an operation",
		]);
		expect(violations.map((v) => [v.operationId, v.code])).toEqual([
			["client.a", "EMPTY_EXEMPT_REASON"],
			["client.b", "INVALID_MCP"],
			["client.c", "DESTRUCTIVE_WITHOUT_DRY_RUN"],
			["<operation #3>", "INVALID_MCP"],
		]);
	});

	it("flags tools without description or JSON-representable input", () => {
		const violations = findMcpCoverageViolations([
			{ id: "mock.listUsers", mcp: true, input: "nope" },
		]);
		expect(violations.map((v) => v.code)).toEqual([
			"MISSING_DESCRIPTION",
			"UNREPRESENTABLE_INPUT_SCHEMA",
		]);
	});

	it("flags duplicate operation ids, routes and colliding tool names", () => {
		const [getResource] = sampleOperations;
		const clone = {
			...getResource,
			id: "client.getResource",
			toolset: "client",
		};
		const violations = findMcpCoverageViolations([
			getResource,
			clone,
			getResource,
		]);
		expect(violations.map((v) => [v.operationId, v.code])).toEqual([
			["client.getResource", "DUPLICATE_ROUTE"],
			["client.getResource", "DUPLICATE_TOOL_NAME"],
			["mock.getResource", "DUPLICATE_OPERATION_ID"],
			["mock.getResource", "DUPLICATE_ROUTE"],
		]);
	});
});
