import http, { type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import {
	type AuthHarness,
	PUBLIC_URL,
	startAuthHarness,
} from "./testing/auth-harness.js";
import { TEST_MOBILE_APPS, mobileToken } from "./testing/mobile-sign-in.js";

let harness: AuthHarness;
let teardownMongo: () => Promise<void>;
let server: Server;
let origin = "";

beforeAll(async () => {
	teardownMongo = await connectTestMongo();
	harness = await startAuthHarness({ mobile: TEST_MOBILE_APPS });
	server = harness.app.listen(0, "127.0.0.1");
	await new Promise<void>((resolve) => server.once("listening", resolve));
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
	server?.closeAllConnections();
	await new Promise<void>((resolve) => server?.close(() => resolve()));
	await harness?.close();
	await teardownMongo?.();
});

beforeEach(async () => {
	await clearCollections();
});

const bearer = (token: string) => `Bearer ${token}`;

describe("Bearer mobile session", () => {
	it("is the only credential read when present, and only for mobile sessions", async () => {
		const token = await mobileToken(harness);
		const web = await harness.signIn();
		const webValue = web.cookie.split("=")[1] ?? "";
		const me = (headers: Record<string, string>) =>
			request(harness.app).get("/api/v1/users/me").set(headers);

		expect((await me({ authorization: bearer("x".repeat(43)) })).status).toBe(
			401,
		);
		expect((await me({ authorization: "Bearer " })).status).toBe(401);
		// A wrong Bearer does not fall back to a valid cookie.
		const both = await me({
			authorization: bearer("x".repeat(43)),
			cookie: web.cookie,
		});
		expect(both.status).toBe(401);
		// A browser cookie is no Bearer token, an app token no cookie.
		expect((await me({ authorization: bearer(webValue) })).status).toBe(401);
		expect(
			(await me({ cookie: `${web.cookie.split("=")[0]}=${token}` })).status,
		).toBe(401);
		expect((await me({ authorization: bearer(token) })).status).toBe(200);
	});

	it("sends mutations without Origin; a Bearer with cookies from elsewhere is refused", async () => {
		const token = await mobileToken(harness);
		const created = await request(harness.app)
			.post("/api/v1/projects")
			.set("authorization", bearer(token))
			.send({ name: "From the app" });
		expect(created.status).toBe(201);

		const web = await harness.signIn();
		const forged = await request(harness.app)
			.post("/api/v1/notifications/read-all")
			.set("authorization", bearer(token))
			.set("cookie", web.cookie)
			.set("origin", "https://evil.example");
		expect(forged.status).toBe(403);
		expect(forged.body.error.code).toBe("CSRF_REJECTED");
		const allowed = await request(harness.app)
			.post("/api/v1/notifications/read-all")
			.set("authorization", bearer(token))
			.set("origin", PUBLIC_URL);
		expect(allowed.status).toBe(200);
	});

	it("opens the live log with Bearer, and its sign-out ends the stream", async () => {
		const token = await mobileToken(harness);
		const created = await request(harness.app)
			.post("/api/v1/projects")
			.set("authorization", bearer(token))
			.send({ name: "Streamed" });
		expect(created.status).toBe(201);
		const projectId: unknown = created.body.id;
		const url = `${origin}/api/v1/projects/${String(projectId)}/request-logs/stream`;
		const stream = await new Promise<IncomingMessage>((resolve, reject) => {
			http
				.get(
					url,
					{
						headers: {
							authorization: bearer(token),
							accept: "text/event-stream",
							origin: "capacitor://localhost",
						},
					},
					resolve,
				)
				.once("error", reject);
		});
		expect(stream.statusCode).toBe(200);
		expect(stream.headers["content-type"]).toMatch(/^text\/event-stream/);
		expect(stream.headers["access-control-allow-origin"]).toBe(
			"capacitor://localhost",
		);
		const ended = new Promise<void>((resolve) => {
			stream.resume();
			stream.once("end", () => resolve());
		});

		const logout = await request(harness.app)
			.post("/auth/mobile/logout")
			.set("authorization", bearer(token))
			.set("origin", "https://localhost");
		expect(logout.status).toBe(204);
		expect(logout.headers["access-control-allow-origin"]).toBe(
			"https://localhost",
		);
		await ended;
		const me = await request(harness.app)
			.get("/api/v1/users/me")
			.set("authorization", bearer(token));
		expect(me.status).toBe(401);
	});

	it("signs out with a Bearer only", async () => {
		// Without a Bearer it is a cookie request: the Origin check applies.
		const forged = await request(harness.app).post("/auth/mobile/logout");
		expect(forged.status).toBe(403);
		const res = await request(harness.app)
			.post("/auth/mobile/logout")
			.set("origin", PUBLIC_URL);
		expect(res.status).toBe(401);
		expect(res.body.error.code).toBe("UNAUTHENTICATED");
		const unknown = await request(harness.app)
			.post("/auth/mobile/logout")
			.set("authorization", bearer("x".repeat(43)));
		expect(unknown.status).toBe(204);
	});
});
