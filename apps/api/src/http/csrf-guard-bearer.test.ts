import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger } from "../logger.js";
import { createCsrfGuard } from "./csrf-guard.js";
import { createErrorHandler } from "./error-handler.js";

const DASHBOARD = "https://localman.test";

const app = express()
	.use(createCsrfGuard({ allowedOrigins: [DASHBOARD] }))
	.post("/api/v1/thing", (_req, res) => {
		res.status(204).end();
	})
	.use(createErrorHandler(createLogger("silent")));

const post = () => request(app).post("/api/v1/thing");

describe("CSRF guard and Bearer requests", () => {
	it("lets a Bearer request without cookies through from any origin", async () => {
		expect((await post().set("authorization", "Bearer abc")).status).toBe(204);
		const app = await post()
			.set("authorization", "bearer abc")
			.set("origin", "capacitor://localhost");
		expect(app.status).toBe(204);
	});

	it("checks the Origin of a Bearer request that carries cookies", async () => {
		const forged = await post()
			.set("authorization", "Bearer abc")
			.set("cookie", "__Host-lm_session=x")
			.set("origin", "https://evil.example");
		expect(forged.status).toBe(403);
		expect(forged.body.error.code).toBe("CSRF_REJECTED");
		const same = await post()
			.set("authorization", "Bearer abc")
			.set("cookie", "__Host-lm_session=x")
			.set("origin", DASHBOARD);
		expect(same.status).toBe(204);
	});

	it("keeps refusing cookie or other schemes without an allowed Origin", async () => {
		expect((await post().set("cookie", "a=b")).status).toBe(403);
		expect((await post().set("authorization", "Basic YTpi")).status).toBe(403);
		const sibling = await post().set("origin", "https://secret.localman.test");
		expect(sibling.status).toBe(403);
	});
});
