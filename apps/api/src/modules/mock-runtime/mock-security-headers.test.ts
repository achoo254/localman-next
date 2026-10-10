import request from "supertest";
import { describe, expect, it } from "vitest";
import { MOCK_CONTENT_SECURITY_POLICY } from "../../mock-server.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { testGuard, useTestServer } from "../api-client/proxy-test-server.js";
import { createResource } from "../resources/testing/resource-fixture.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";
import { createUpstreamDeps } from "./upstream-proxy.js";

const server = useTestServer();
const kit = useMockTestKit({
	upstream: () =>
		createUpstreamDeps({
			guard: testGuard(),
			timeoutMs: 5_000,
			findTunnel: async () => server.origin,
		}),
});

server.routes.set("/page", (_req, res) => {
	res.writeHead(200, {
		"content-type": "text/html",
		"content-security-policy": "script-src *",
		"x-content-type-options": "none",
	});
	res.end("<script>alert(1)</script>");
});

/** A project answering from every source: mock, rule, upstream, inbox. */
async function everySource() {
	const project = await createMockProject();
	await createResource(OWNER, project.id, {
		name: "users",
		endpoints: [
			{ method: "GET", path: "/:res" },
			{
				method: "POST",
				path: "/:res",
				rules: [
					{
						match: { source: "header", key: "x-role" },
						op: "eq",
						value: "admin",
						response: { status: 403, body: { error: "read-only" } },
					},
				],
			},
		],
	});
	const upstream = await as(OWNER).send(
		"put",
		`/projects/${project.id}/upstream`,
		{ upstream: { kind: "tunnel", port: 3000 } },
	);
	expect(upstream.status, JSON.stringify(upstream.body)).toBe(200);
	const inbox = await as(OWNER).send(
		"post",
		`/projects/${project.id}/inboxes`,
		{
			name: "hook",
			response: { status: 200, contentType: "text/plain", body: "ok" },
		},
	);
	expect(inbox.status, JSON.stringify(inbox.body)).toBe(201);
	return project;
}

function expectSandboxed(res: request.Response, what: string): void {
	// One header each: a second CSP from the upstream would be joined in.
	expect(res.headers["content-security-policy"], what).toBe(
		MOCK_CONTENT_SECURITY_POLICY,
	);
	expect(res.headers["x-content-type-options"], what).toBe("nosniff");
}

const CASES = [
	["mock", "get", "/users", undefined, 200],
	["rule", "post", "/users", "admin", 403],
	["upstream", "get", "/page", undefined, 200],
	["inbox", "post", "/_inbox/hook", undefined, 200],
	["unknown inbox", "get", "/_inbox/nope", undefined, 404],
] as const;

describe("security headers of every mock runtime response", () => {
	it.each(["host", "/m/ path"])(
		"sandboxes every source on the %s",
		async (via) => {
			const { secret } = await everySource();
			const mock = kit.client(secret);
			for (const [what, method, path, role, status] of CASES) {
				const test =
					via === "host"
						? mock.call(method, path)
						: request(mock.app)[method](`/m/${secret}${path}`);
				const res = await (role ? test.set("x-role", role) : test);
				expect(res.status, `${what} ${res.text}`).toBe(status);
				expectSandboxed(res, `${via} ${what}`);
			}
			const preflight = await request(mock.app)
				.options(`/m/${secret}/users`)
				.set("origin", "https://app.example")
				.set("access-control-request-method", "POST");
			expect(preflight.status).toBe(204);
			expectSandboxed(preflight, `${via} preflight`);
		},
	);

	it("sandboxes answers that address no project", async () => {
		const app = kit.client("unused").app;
		expectSandboxed(await request(app).get("/healthz"), "healthz");
		const missing = await request(app).get("/m/nosuchsecret0000/users");
		expect(missing.status).toBe(404);
		expectSandboxed(missing, "unknown secret");
		expectSandboxed(await request(app).get("/nothing"), "no address");
	});
});
