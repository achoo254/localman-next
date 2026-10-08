import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger } from "../logger.js";
import { asyncHandler } from "./async-handler.js";
import { createErrorHandler } from "./error-handler.js";

describe("asyncHandler", () => {
	it("forwards a rejected promise to the error handler", async () => {
		const app = express();
		app.get(
			"/fail",
			asyncHandler(async () => {
				throw new Error("async failure");
			}),
		);
		app.get(
			"/ok",
			asyncHandler(async (_req, res) => {
				res.json({ ok: true });
			}),
		);
		app.use(createErrorHandler(createLogger("silent")));

		const failed = await request(app).get("/fail");
		expect(failed.status).toBe(500);
		expect(failed.body.error.code).toBe("INTERNAL_ERROR");
		expect((await request(app).get("/ok")).body).toEqual({ ok: true });
	});
});
