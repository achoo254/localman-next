import { describe, expect, it } from "vitest";
import { trafficOperations } from "./traffic-operations.js";

/** Settings an agent could use to send credentials away or read them. */
const UI_ONLY = ["traffic.setProjectUpstream", "traffic.setRedactHeaders"];

describe("traffic settings over MCP", () => {
	it.each(UI_ONLY)("%s has no MCP tool", (id) => {
		const operation = trafficOperations.find((op) => op.id === id);
		expect(operation?.mcp).toEqual({ exempt: expect.any(String) });
	});
});
