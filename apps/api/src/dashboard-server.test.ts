import { OperationError, defineOperation } from "@localman/operations";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { API_PREFIX, createDashboardApp } from "./dashboard-server.js";
import { createLogger } from "./logger.js";

const logger = createLogger("silent");
const ORIGIN = "https://localman.test";

function failingOperation(id: string, fail: () => never) {
	return defineOperation({
		id: `client.${id}`,
		method: "POST",
		path: `/${id}`,
		summary: `Fails with ${id}`,
		input: z.object({}),
		output: z.object({}),
		scopes: [],
		annotations: { readOnly: false, destructive: false, idempotent: false },
		toolset: "client",
		mcp: true,
		handler: fail,
	});
}

const fixtureApp = createDashboardApp({
	logger,
	allowedOrigins: [ORIGIN],
	operations: [
		failingOperation("throwUnexpected", () => {
			throw new Error("secret connection string in message");
		}),
		failingOperation("throwZod", () => {
			z.object({ name: z.string() }).parse({});
			throw new Error("unreachable");
		}),
		failingOperation("throwConflict", () => {
			throw new OperationError(409, "CONFLICT", "Name already taken");
		}),
	],
});
const realApp = createDashboardApp({ logger, allowedOrigins: [ORIGIN] });

describe("dashboard server", () => {
	it("answers /healthz with 200 without a database", async () => {
		const res = await request(realApp).get("/healthz");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ status: "ok", db: "disconnected" });
		expect(res.headers["x-powered-by"]).toBeUndefined();
		expect(res.headers["x-content-type-options"]).toBe("nosniff");
	});

	it("serves the OpenAPI document generated from the registry", async () => {
		const res = await request(realApp).get(`${API_PREFIX}/openapi.json`);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			openapi: "3.1.0",
			info: { title: "Localman API" },
			servers: [{ url: API_PREFIX }],
			paths: {},
		});

		const fixtureDoc = await request(fixtureApp).get(
			`${API_PREFIX}/openapi.json`,
		);
		expect(Object.keys(fixtureDoc.body.paths)).toContain("/throwConflict");
	});

	it("returns 404 in the standard error format", async () => {
		const res = await request(realApp).get("/api/v1/does-not-exist");
		expect(res.status).toBe(404);
		expect(res.body).toEqual({
			error: { code: "NOT_FOUND", message: "Route not found" },
		});
	});

	it("rejects bodies over 100kb with 413", async () => {
		const res = await request(realApp)
			.post("/api/v1/anything")
			.set("origin", ORIGIN)
			.set("content-type", "application/json")
			.send(JSON.stringify({ data: "x".repeat(101 * 1024) }));
		expect(res.status).toBe(413);
		expect(res.body).toEqual({
			error: {
				code: "PAYLOAD_TOO_LARGE",
				message: "Request body is too large",
			},
		});
	});

	it("rejects malformed JSON with 400", async () => {
		const res = await request(realApp)
			.post("/api/v1/anything")
			.set("origin", ORIGIN)
			.set("content-type", "application/json")
			.send("{not json");
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("INVALID_JSON");
	});

	it("hides unexpected errors behind a generic 500", async () => {
		const res = await request(fixtureApp)
			.post(`${API_PREFIX}/throwUnexpected`)
			.set("origin", ORIGIN);
		expect(res.status).toBe(500);
		expect(res.body).toEqual({
			error: { code: "INTERNAL_ERROR", message: "Internal server error" },
		});
		expect(res.text).not.toContain("secret");
		expect(res.text).not.toContain("at ");
	});

	it("treats a ZodError thrown inside a handler as a server error", async () => {
		const res = await request(fixtureApp)
			.post(`${API_PREFIX}/throwZod`)
			.set("origin", ORIGIN);
		expect(res.status).toBe(500);
		expect(res.body.error.code).toBe("INTERNAL_ERROR");
		expect(res.text).not.toContain("name");
	});

	it("passes OperationError status and code through", async () => {
		const res = await request(fixtureApp)
			.post(`${API_PREFIX}/throwConflict`)
			.set("origin", ORIGIN);
		expect(res.status).toBe(409);
		expect(res.body).toEqual({
			error: { code: "CONFLICT", message: "Name already taken" },
		});
	});

	describe("CSRF origin check", () => {
		it("rejects a mutation without an allowed Origin before parsing it", async () => {
			for (const origin of [undefined, "https://abc.localman.test", "null"]) {
				const req = request(fixtureApp)
					.post(`${API_PREFIX}/throwConflict`)
					.set("content-type", "application/json");
				if (origin) req.set("origin", origin);
				const res = await req.send("{not json");
				expect(res.status).toBe(403);
				expect(res.body).toEqual({
					error: {
						code: "CSRF_REJECTED",
						message: "Cross-site request rejected",
					},
				});
			}
		});

		it("accepts Sec-Fetch-Site: same-origin and leaves reads alone", async () => {
			const res = await request(fixtureApp)
				.post(`${API_PREFIX}/throwConflict`)
				.set("sec-fetch-site", "same-origin");
			expect(res.status).toBe(409);
			const sameSite = await request(fixtureApp)
				.post(`${API_PREFIX}/throwConflict`)
				.set("sec-fetch-site", "same-site");
			expect(sameSite.status).toBe(403);
			expect((await request(realApp).get("/healthz")).status).toBe(200);
		});
	});
});
