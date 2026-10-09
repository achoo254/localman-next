import { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createDashboardApp } from "../dashboard-server.js";
import { createMockApp } from "../mock-server.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../modules/mock-runtime/testing/mock-test-kit.js";
import { UsageMeter } from "../modules/mock-runtime/usage-meter.js";
import { captureLogs } from "../test-support/log-capture.js";
import { UNMATCHED_ROUTE } from "./request-log.js";

useMockTestKit();

function dashboardWith(logger: ReturnType<typeof captureLogs>["logger"]) {
	return createDashboardApp({
		logger,
		allowedOrigins: ["https://localman.test"],
		auth: {
			router: Router(),
			csrfExempt: [],
			authenticate: async (req) => {
				const sub = req.headers["x-test-sub"];
				return typeof sub === "string" ? { id: `s-${sub}`, sub } : null;
			},
		},
	});
}

describe("request log", () => {
	it("logs a dashboard request as one line with its id, template and project", async () => {
		const project = await createMockProject();
		const logs = captureLogs();
		const app = dashboardWith(logs.logger);
		const res = await request(app)
			.get(`/api/v1/projects/${project.id}?token=query-secret`)
			.set("x-test-sub", OWNER)
			.set("cookie", "lm_session=cookie-secret");
		expect(res.status).toBe(200);
		const id = res.headers["x-localman-request-id"];
		expect(id).toMatch(/^[0-9a-f-]{36}$/);
		const [entry] = logs.entries("request");
		expect(entry).toMatchObject({
			requestId: id,
			method: "GET",
			route: "/api/v1/projects/:projectId",
			status: 200,
			projectId: project.id,
		});
		expect(typeof entry?.ms).toBe("number");
		const raw = logs.lines.join("");
		for (const secret of ["query-secret", "cookie-secret", project.secret]) {
			expect(raw).not.toContain(secret);
		}
	});

	it("keeps the full template when an error leaves the router, and hides unmatched paths", async () => {
		const logs = captureLogs();
		const app = dashboardWith(logs.logger);
		const missing = "0123456789abcdef01234567";
		await request(app)
			.get(`/api/v1/projects/${missing}`)
			.set("x-test-sub", OWNER);
		await request(app).get("/api/v1/no-such-route/private-token");
		const [notFound, unmatched] = logs.entries("request");
		expect(notFound).toMatchObject({
			route: "/api/v1/projects/:projectId",
			status: 404,
			projectId: missing,
		});
		expect(unmatched).toMatchObject({ route: UNMATCHED_ROUTE, status: 404 });
		expect(logs.lines.join("")).not.toContain("private-token");
	});

	it("masks the secret of mock requests and drops the query", async () => {
		const project = await createMockProject();
		const logs = captureLogs();
		const app = createMockApp({
			logger: logs.logger,
			usageMeter: new UsageMeter({ logger: logs.logger, warn: async () => {} }),
		});
		const viaPath = await request(app)
			.get(`/m/${project.secret}/users?apiKey=query-secret`)
			.set("host", "localhost");
		const viaHost = await request(app)
			.get("/users/1")
			.set("host", `${project.secret}.localman.test`);
		const [first, second] = logs.entries("request");
		expect(first).toMatchObject({
			requestId: viaPath.headers["x-localman-request-id"],
			route: `/m/${project.secret.slice(0, 4)}…/users`,
			status: viaPath.status,
			projectId: project.id,
		});
		expect(second).toMatchObject({
			requestId: viaHost.headers["x-localman-request-id"],
			route: "/users/1",
			projectId: project.id,
		});
		const raw = logs.lines.join("");
		expect(raw).not.toContain(project.secret);
		expect(raw).not.toContain("query-secret");
	});
});
