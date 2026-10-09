import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";
import { createMockApp } from "./mock-server.js";
import { UsageMeter } from "./modules/mock-runtime/usage-meter.js";

const logger = createLogger("silent");
const app = createMockApp({
	logger,
	usageMeter: new UsageMeter({ logger, warn: async () => {} }),
});

describe("mock server", () => {
	it("answers /healthz with 200 without a database", async () => {
		const res = await request(app).get("/healthz");
		expect(res.status).toBe(200);
		expect(res.body.status).toBe("ok");
		expect(res.headers["x-powered-by"]).toBeUndefined();
	});

	it("returns 404 in the standard error format", async () => {
		const res = await request(app).get("/unknown");
		expect(res.status).toBe(404);
		expect(res.body).toEqual({
			error: { code: "NOT_FOUND", message: "Route not found" },
		});
	});

	it("rejects bodies over 100kb with 413", async () => {
		const res = await request(app)
			.post("/anything")
			.send({ data: "x".repeat(101 * 1024) });
		expect(res.status).toBe(413);
		expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
	});
});
