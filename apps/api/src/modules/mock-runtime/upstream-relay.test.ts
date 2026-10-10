import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	type ProxyConcurrency,
	createProxyConcurrency,
} from "../api-client/proxy-concurrency.js";
import {
	echoOf,
	headerValues,
	testGuard,
	useTestServer,
} from "../api-client/proxy-test-server.js";
import { ProjectModel } from "../projects/project-model.js";
import { UserModel } from "../users/user-model.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";
import { createUpstreamDeps } from "./upstream-proxy.js";

const server = useTestServer();
const OTHER = "acc_upstream_other";
let concurrency: ProxyConcurrency = createProxyConcurrency({
	perUser: 1,
	total: 8,
});
const kit = useMockTestKit({
	upstream: () => {
		concurrency = createProxyConcurrency({ perUser: 1, total: 8 });
		return createUpstreamDeps({
			guard: testGuard(),
			timeoutMs: 5_000,
			concurrency,
			findTunnel: async () => server.origin,
		});
	},
});

async function tunnelProject(owner = OWNER) {
	const created = await as(owner).send("post", "/projects", { name: "Up" });
	expect(created.status, JSON.stringify(created.body)).toBe(201);
	const { id, secret } = created.body;
	const set = await as(owner).send("put", `/projects/${id}/upstream`, {
		upstream: { kind: "tunnel", port: 3000 },
	});
	expect(set.status, JSON.stringify(set.body)).toBe(200);
	return kit.client(secret);
}

server.routes.set("/hostile", (_req, res) => {
	res.writeHead(200, {
		"Content-Type": "text/html",
		"Set-Cookie": "__Host-lm_session=attacker; Secure; Path=/",
		"Content-Security-Policy": "script-src *",
		"Content-Security-Policy-Report-Only": "default-src *",
		"Access-Control-Allow-Origin": "https://evil.example",
		"Access-Control-Allow-Credentials": "true",
		"Strict-Transport-Security": "max-age=0",
		"Content-Disposition": "inline",
		Refresh: "0; url=https://evil.example",
		Link: "<https://evil.example/x.js>; rel=preload",
		"X-Frame-Options": "ALLOWALL",
		"X-XSS-Protection": "1",
		"X-Accel-Redirect": "/api/v1/me",
		"X-Localman-Source": "forged",
		"X-Custom": "kept",
		"X-Request-Id": "req-1",
		"Cache-Control": "no-store",
		ETag: '"v1"',
		Vary: "Accept, Cookie",
	});
	res.end("<script>alert(1)</script>");
});
server.routes.set("/redirect", (req, res) => {
	const to = new URL(req.url ?? "/", "http://x").searchParams.get("to") ?? "";
	res.writeHead(302, { Location: to.replace("{origin}", server.origin) });
	res.end();
});

describe("hybrid mock upstream: what crosses the mock origin", () => {
	it("relays only allowed upstream headers", async () => {
		const mock = await tunnelProject();
		const res = await mock.get("/hostile");
		expect(res.status).toBe(200);
		const h = res.headers;
		for (const name of [
			"set-cookie",
			"content-security-policy-report-only",
			"access-control-allow-credentials",
			"content-disposition",
			"refresh",
			"link",
			"x-accel-redirect",
		]) {
			expect(h[name], name).toBeUndefined();
		}
		expect(h["content-security-policy"]).toContain("sandbox");
		expect(h["access-control-allow-origin"]).toBe("*");
		expect(h["strict-transport-security"]).not.toBe("max-age=0");
		// The runtime's own values (helmet), not the upstream's.
		expect(h["x-frame-options"]).toBe("DENY");
		expect(h["x-xss-protection"]).toBe("0");
		expect(h["x-localman-source"]).toBe("upstream");
		expect(h).toMatchObject({
			"x-custom": "kept",
			"x-request-id": "req-1",
			"cache-control": "no-store",
			etag: '"v1"',
			vary: "Accept",
		});
	});

	it.each([
		["/next?a=1", "/next?a=1"],
		["{origin}/next?a=1", "/next?a=1"],
		["{origin}//evil.example/x", "/evil.example/x"],
		["https://evil.example/x", undefined],
		["//evil.example/x", undefined],
		["/\\evil.example/x", undefined],
		["javascript:alert(1)", undefined],
	])("relays Location %s as %s", async (to, shown) => {
		const mock = await tunnelProject();
		const res = await mock.get("/redirect").query({ to });
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe(shown);
	});

	it("never forwards cookies (Localman's or other *.hoandat.com apps')", async () => {
		const mock = await tunnelProject();
		const mixed = await mock
			.get("/echo")
			.set("cookie", "__Host-lm_session=s1; idp_session=x; theme=dark");
		expect(headerValues(echoOf(mixed.text), "cookie")).toEqual([]);
	});

	it.each([
		"/%2e%2e/%2e%2e/admin",
		"/%2E%2E/%2E%2E/admin",
		"/v1/..%2f..%2f..%2fadmin",
		"/v1/%5c..%5c..%5cadmin",
		"/v1/%2e%2e%5c%2e%2e%5cadmin",
	])("refuses %s, which leaves the base path", async (path) => {
		const project = await createMockProject();
		await ProjectModel.updateOne(
			{ _id: project.id },
			{
				$set: { upstream: { kind: "url", baseUrl: "https://public.test/v1" } },
			},
		);
		const res = await kit.client(project.secret).get(path);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("UPSTREAM_PATH_INVALID");
	});

	it("forwards encoded slashes that stay below the base", async () => {
		const mock = await tunnelProject();
		const res = await mock.get("/files/a%2Fb/c%5Cd");
		expect(res.status).toBe(200);
		expect(echoOf(res.text).path).toBe("/files/a%2Fb/c%5Cd");
	});

	it("limits upstream exchanges per owner across their projects", async () => {
		await UserModel.create({ sub: OTHER, username: "other" });
		const first = await tunnelProject();
		const second = await tunnelProject();
		const others = await tunnelProject(OTHER);
		// A slow exchange of the owner's first project holds its only slot.
		const held = concurrency.acquire(OWNER);
		expect(held.ok).toBe(true);
		const busy = await second.get("/echo");
		expect(busy.status).toBe(503);
		expect(busy.body.error.code).toBe("UPSTREAM_BUSY");
		expect((await others.get("/echo")).status).toBe(200);
		if (held.ok) held.release();
		expect((await first.get("/echo")).status).toBe(200);
	});
});
