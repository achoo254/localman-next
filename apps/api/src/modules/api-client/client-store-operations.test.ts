import { findMcpCoverageViolations } from "@localman/operations";
import { describe, expect, it } from "vitest";
import { operations } from "../../operations/registry.js";
import { clientStoreOperations } from "./client-store-operations.js";

describe("client store operations", () => {
	it("are registered once, without MCP gaps or route and tool clashes", () => {
		const ids = new Set(operations.map((op) => op.id));
		for (const op of clientStoreOperations)
			expect(ids.has(op.id), op.id).toBe(true);
		expect(findMcpCoverageViolations(operations)).toEqual([]);
	});

	it("belong to the client toolset and need a signed-in user", () => {
		for (const op of clientStoreOperations) {
			expect(op.toolset, op.id).toBe("client");
			expect(op.scopes, op.id).toEqual(["user"]);
		}
	});
});
