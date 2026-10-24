import { readFileSync } from "node:fs";
import {
	LOG_ENVELOPE_FIELDS,
	NIGHTLY_BACKUPS_KEPT,
	REQUEST_LOG_FIELDS,
	WEB_SERVER_LOG_FIELDS,
} from "@localman/shared/data-policy";
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
import { type LogCapture, captureLogs } from "../test-support/log-capture.js";

useMockTestKit();

const allowed = new Set<string>([
	...REQUEST_LOG_FIELDS,
	...LOG_ENVELOPE_FIELDS,
]);

function repoFile(path: string): string {
	return readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8");
}

function unlistedKeys(logs: LogCapture): string[] {
	return logs
		.entries("request")
		.flatMap((entry) => Object.keys(entry))
		.filter((key) => !allowed.has(key));
}

/** nginx variables of `log_format localman`, by the policy's field name. */
const NGINX_VARIABLES: Readonly<
	Record<(typeof WEB_SERVER_LOG_FIELDS)[number], string>
> = {
	ip: "$remote_addr",
	time: "$time_local",
	method: "$request_method",
	path: "$localman_logged_uri",
	status: "$status",
	bytes: "$body_bytes_sent",
	userAgent: "$http_user_agent",
	duration: "$request_time",
};

describe("the server logs and keeps only what the data policy says", () => {
	it("a dashboard request line holds only the listed fields", async () => {
		const project = await createMockProject();
		const logs = captureLogs();
		const app = createDashboardApp({
			logger: logs.logger,
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
		await request(app)
			.get(`/api/v1/projects/${project.id}?page=2`)
			.set("x-test-sub", OWNER);
		await request(app).get("/no/such/route?page=2");
		expect(logs.entries("request")).toHaveLength(2);
		expect(unlistedKeys(logs)).toEqual([]);
	});

	it("a mock request line holds only the listed fields, the secret masked", async () => {
		const project = await createMockProject();
		const logs = captureLogs();
		const app = createMockApp({
			logger: logs.logger,
			usageMeter: new UsageMeter({ logger: logs.logger, warn: async () => {} }),
		});
		await request(app)
			.get(`/m/${project.secret}/users/1?page=2`)
			.set("host", "localhost");
		expect(logs.entries("request")).toHaveLength(1);
		expect(unlistedKeys(logs)).toEqual([]);
		expect(logs.lines.join("")).not.toContain(project.secret);
	});

	it("the request logger writes exactly the listed fields", () => {
		const source = repoFile("apps/api/src/http/request-log.ts");
		const call = source.slice(
			source.indexOf("logger.info("),
			source.indexOf('"request"'),
		);
		const keys = new Set([
			...[...call.matchAll(/\b(\w+):/g)].map((match) => match[1]),
			...[...call.matchAll(/\{\s*(\w+)\s*\}/g)].map((match) => match[1]),
		]);
		expect([...keys].sort()).toEqual([...REQUEST_LOG_FIELDS].sort());
	});

	it("the web server's access log has exactly the listed fields", () => {
		const conf = repoFile("infra/localman/nginx/localman-http.conf");
		const start = conf.indexOf("log_format localman");
		const format = conf.slice(start, conf.indexOf(";", start));
		const used = [...format.matchAll(/\$\w+/g)].map((match) => match[0]);
		expect(used.sort()).toEqual(Object.values(NGINX_VARIABLES).sort());
		expect(Object.keys(NGINX_VARIABLES).sort()).toEqual(
			[...WEB_SERVER_LOG_FIELDS].sort(),
		);
	});

	it("the nightly backup keeps as many archives as the policy says", () => {
		const script = repoFile("infra/localman/backup-localman-db.sh");
		expect(script).toMatch(new RegExp(`^KEEP=${NIGHTLY_BACKUPS_KEPT}$`, "m"));
	});
});
