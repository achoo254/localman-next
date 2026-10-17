import request from "supertest";
import { describe, expect, it } from "vitest";
import { createDashboardApp } from "../dashboard-server.js";
import { createLogger } from "../logger.js";
import { commentOperations } from "../modules/comments/comment-operations.js";
import { publicSharingOperations } from "../modules/public-sharing/public-sharing-operations.js";
import { tuneloOperations } from "../modules/tunelo/tunelo-operations.js";
import { watchOperations } from "../modules/watch/watch-operations.js";
import { servedOperations } from "./feature-gates.js";
import { operations } from "./registry.js";

const ALL_ON = {
	publicSharing: true,
	comments: true,
	forks: true,
	tuneloAccounts: true,
};
const SHARING_OFF = { ...ALL_ON, publicSharing: false };

describe("PUBLIC_SHARING_ENABLED", () => {
	it("leaves every public sharing operation out while off", () => {
		const off = servedOperations(operations, SHARING_OFF);
		for (const operation of publicSharingOperations) {
			expect(operations).toContain(operation);
			expect(off).not.toContain(operation);
		}
		expect(off).toHaveLength(
			operations.length - publicSharingOperations.length,
		);
		expect(servedOperations(operations, ALL_ON)).toBe(operations);
	});

	it("offers no MCP tool of public sharing while off", () => {
		const tools = servedOperations(operations, SHARING_OFF).filter(
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
			operations: servedOperations(operations, SHARING_OFF),
		});
		const res = await request(app).get("/api/v1/public/links/anything");
		expect(res.status).toBe(404);
	});
});

describe("COMMENTS_ENABLED", () => {
	it("leaves comments and watch out, with their MCP tools, while off", async () => {
		const gated = [...commentOperations, ...watchOperations];
		const off = servedOperations(operations, { ...ALL_ON, comments: false });
		for (const operation of gated) {
			expect(operations).toContain(operation);
			expect(off).not.toContain(operation);
		}
		expect(off).toHaveLength(operations.length - gated.length);
		const app = createDashboardApp({
			logger: createLogger("silent"),
			allowedOrigins: ["https://localman.test"],
			operations: off,
		});
		const res = await request(app).get("/api/v1/collections/c1/comments");
		expect(res.status).toBe(404);
	});
});

describe("TUNELO_ACCOUNTS_ENABLED", () => {
	it("leaves the Tunelo account operations out while off", async () => {
		const off = servedOperations(operations, {
			...ALL_ON,
			tuneloAccounts: false,
		});
		for (const operation of tuneloOperations) {
			expect(operations).toContain(operation);
			expect(off).not.toContain(operation);
		}
		expect(off).toHaveLength(operations.length - tuneloOperations.length);
		const app = createDashboardApp({
			logger: createLogger("silent"),
			allowedOrigins: ["https://localman.test"],
			operations: off,
		});
		const res = await request(app).get("/api/v1/client/local-tunnels");
		expect(res.status).toBe(404);
	});
});
