import request from "supertest";
import { describe, expect, it } from "vitest";
import { createDashboardApp } from "../../dashboard-server.js";
import { createLogger } from "../../logger.js";
import { operations } from "../../operations/registry.js";
import { servedOperations } from "./public-sharing-gate.js";
import { publicSharingOperations } from "./public-sharing-operations.js";

describe("PUBLIC_SHARING_ENABLED", () => {
	it("leaves every public sharing operation out while off", () => {
		const off = servedOperations(operations, false);
		for (const operation of publicSharingOperations) {
			expect(operations).toContain(operation);
			expect(off).not.toContain(operation);
		}
		expect(off).toHaveLength(
			operations.length - publicSharingOperations.length,
		);
		expect(servedOperations(operations, true)).toBe(operations);
	});

	it("offers no MCP tool of public sharing while off", () => {
		const tools = servedOperations(operations, false).filter(
			(operation) => operation.mcp === true,
		);
		const ids = new Set(tools.map((operation) => operation.id));
		for (const operation of publicSharingOperations) {
			expect(ids.has(operation.id)).toBe(false);
		}
	});

	it("answers 404 on their paths while off", async () => {
		const app = createDashboardApp({
			logger: createLogger("silent"),
			allowedOrigins: ["https://localman.test"],
			operations: servedOperations(operations, false),
		});
		const res = await request(app).get("/api/v1/public/links/anything");
		expect(res.status).toBe(404);
	});
});
