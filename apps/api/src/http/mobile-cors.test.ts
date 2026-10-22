import request from "supertest";
import { describe, expect, it } from "vitest";
import { createDashboardApp } from "../dashboard-server.js";
import { createLogger } from "../logger.js";
import { MOBILE_APP_ORIGINS, isMobileCorsPath } from "./mobile-cors.js";

const app = createDashboardApp({
	logger: createLogger("silent"),
	allowedOrigins: ["https://localman.test"],
	operations: [],
});

function preflight(path: string, origin: string) {
	return request(app)
		.options(path)
		.set("origin", origin)
		.set("access-control-request-method", "POST")
		.set("access-control-request-headers", "authorization, content-type");
}

describe("CORS of the dashboard API", () => {
	it("allows exactly the Capacitor WebView origins", () => {
		expect(MOBILE_APP_ORIGINS).toEqual([
			"capacitor://localhost",
			"https://localhost",
		]);
	});

	it("answers the app's preflight without ever allowing credentials", async () => {
		for (const origin of MOBILE_APP_ORIGINS) {
			for (const path of [
				"/api/v1/projects",
				"/api/v1/projects/p1/request-logs/stream",
				"/auth/mobile/token",
				"/auth/mobile/logout",
			]) {
				const res = await preflight(path, origin);
				expect(res.status, `${origin} ${path}`).toBe(204);
				expect(res.headers["access-control-allow-origin"]).toBe(origin);
				expect(res.headers["access-control-allow-headers"]).toBe(
					"Authorization, Content-Type, Accept, Last-Event-ID",
				);
				expect(res.headers["access-control-allow-methods"]).toMatch(/PATCH/);
				expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
				expect(res.headers.vary).toMatch(/Origin/);
			}
		}
	});

	it("adds the origin to the app's real requests, errors included", async () => {
		const res = await request(app)
			.get("/api/v1/nothing-here")
			.set("origin", "capacitor://localhost");
		expect(res.status).toBe(404);
		expect(res.headers["access-control-allow-origin"]).toBe(
			"capacitor://localhost",
		);
		expect(res.headers["access-control-expose-headers"]).toBe("Retry-After");
		expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
	});

	it("sends no CORS header to other origins or on cookie-only routes", async () => {
		for (const origin of [
			"https://evil.example",
			"https://localman.test",
			"capacitor://evil",
			"http://localhost",
		]) {
			const res = await preflight("/api/v1/projects", origin);
			expect(
				res.headers["access-control-allow-origin"],
				origin,
			).toBeUndefined();
		}
		for (const path of [
			"/auth/login",
			"/auth/logout",
			"/auth/mobile/confirm",
			"/m/auth/callback",
			"/.well-known/apple-app-site-association",
		]) {
			expect(isMobileCorsPath(path), path).toBe(false);
			const res = await preflight(path, "capacitor://localhost");
			expect(res.headers["access-control-allow-origin"], path).toBeUndefined();
		}
	});
});
