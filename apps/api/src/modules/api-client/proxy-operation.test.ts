import { toMcpToolDescriptor } from "@localman/operations";
import { describe, expect, it } from "vitest";
import { DEFAULT_RUNTIME_SETTINGS } from "../../config/runtime-settings.js";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { captureLogs } from "../../test-support/log-capture.js";
import { createProxyOperations } from "./proxy-operations.js";
import { PROXY_TEST_USER, postProxy, proxyTestApp } from "./proxy-test-app.js";
import {
	echoOf,
	headerValues,
	testGuard,
	testResolver,
	useTestServer,
} from "./proxy-test-server.js";
import { createSsrfGuard } from "./ssrf-guard.js";

const server = useTestServer();
const logs = captureLogs();
const open = proxyTestApp({ logger: logs.logger });
const strict = proxyTestApp({
	guard: createSsrfGuard({ resolve: testResolver }),
});

useDashboardTestDb();

describe("client.sendRequest", () => {
	it("requires a signed-in user", async () => {
		const res = await postProxy(
			open,
			{ method: "GET", url: server.origin },
			null,
		);
		expect(res.status).toBe(401);
		expect(res.body.error.code).toBe("UNAUTHENTICATED");
	});

	it("forwards only the envelope: the caller's cookie and auth stay home", async () => {
		const res = await postProxy(open, {
			method: "GET",
			url: server.origin,
			headers: [{ name: "X-Mine", value: "1" }],
		})
			.set("cookie", "__Host-lm_session=s3cret; lm_session=s3cret")
			.set("authorization", "Bearer localman-token");
		expect(res.status).toBe(200);
		const echo = echoOf(res.body.body);
		expect(headerValues(echo, "cookie")).toEqual([]);
		expect(headerValues(echo, "authorization")).toEqual([]);
		expect(headerValues(echo, "x-mine")).toEqual(["1"]);
		expect(JSON.stringify(echo)).not.toMatch(/s3cret|localman-token/);
	});

	it("forwards the client IP that trust proxy resolved, never a forged one", async () => {
		const forged = await postProxy(open, {
			method: "GET",
			url: server.origin,
		}).set("x-forwarded-for", "203.0.113.9");
		const untrusted = echoOf(forged.body.body);
		expect(headerValues(untrusted, "x-forwarded-for")).toEqual(["127.0.0.1"]);
		expect(headerValues(untrusted, "x-real-ip")).toEqual(["127.0.0.1"]);

		const viaNginx = proxyTestApp({ trustProxy: "loopback" });
		const res = await postProxy(viaNginx, {
			method: "GET",
			url: server.origin,
		}).set("x-forwarded-for", "198.51.100.23");
		const trusted = echoOf(res.body.body);
		const scheme = new URL(DEFAULT_RUNTIME_SETTINGS.publicUrl).protocol;
		expect(headerValues(trusted, "x-forwarded-for")).toEqual(["198.51.100.23"]);
		expect(headerValues(trusted, "forwarded")).toEqual([
			`for=198.51.100.23;proto=${scheme.replace(":", "")}`,
		]);
	});

	it.each([
		"http://127.0.0.1/",
		"http://169.254.169.254/latest/meta-data/",
		"http://[::1]/",
		"http://10.0.0.1/",
		"http://2130706433/",
		"http://private.test/",
		"http://mixed.test/",
	])("refuses %s with 403 PROXY_TARGET_BLOCKED", async (url) => {
		const res = await postProxy(strict, { method: "GET", url });
		expect(res.status).toBe(403);
		expect(res.body.error.code).toBe("PROXY_TARGET_BLOCKED");
	});

	it("refuses a redirect into a private range", async () => {
		server.routes.set("/to-metadata", (_req, res) => {
			res.writeHead(302, {
				location: "http://169.254.169.254/latest/meta-data/",
			});
			res.end();
		});
		const res = await postProxy(open, {
			method: "GET",
			url: `${server.origin}/to-metadata`,
		});
		expect(res.status).toBe(403);
		expect(res.body.error.code).toBe("PROXY_TARGET_BLOCKED");
	});

	it("validates the envelope", async () => {
		const res = await postProxy(open, {
			method: "GET",
			url: "file:///etc/passwd",
		});
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("logs metadata only", async () => {
		logs.lines.length = 0;
		await postProxy(open, {
			method: "POST",
			url: `${server.origin}/secret-path?token=abc`,
			headers: [{ name: "Authorization", value: "Bearer hunter2" }],
			body: "password=hunter2",
			bodyType: "text",
		}).expect(200);
		const [entry] = logs.entries("proxy");
		expect(entry).toMatchObject({
			sub: PROXY_TEST_USER,
			host: "127.0.0.1",
			method: "POST",
			status: 200,
		});
		expect(typeof entry?.ms).toBe("number");
		expect(logs.lines.join("")).not.toMatch(/hunter2|secret-path|token=abc/);
	});

	it.each(["", ".", ".."])(
		"masks the project secret of a mock host in the log (trailing %j)",
		async (dots) => {
			logs.lines.length = 0;
			const mockUrl = `https://s3cretmock.${DEFAULT_RUNTIME_SETTINGS.mockBaseDomain.toUpperCase()}${dots}/users`;
			await postProxy(open, { method: "GET", url: mockUrl });
			const [entry] = logs.entries("proxy");
			expect(entry?.host).toBe(
				`[secret].${DEFAULT_RUNTIME_SETTINGS.mockBaseDomain}`,
			);
			expect(logs.lines.join("")).not.toMatch(/s3cretmock/i);
		},
	);

	it("is the MCP tool send_request of the client toolset", () => {
		const [operation] = createProxyOperations({
			guard: testGuard(),
			logger: () => logs.logger,
		});
		if (!operation) throw new Error("no operation");
		const tool = toMcpToolDescriptor(operation);
		expect(tool?.name).toBe("send_request");
		expect(tool?.scopes).toContain("client:write");
	});
});
