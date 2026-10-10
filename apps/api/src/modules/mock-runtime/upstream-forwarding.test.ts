import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	echoOf,
	headerValues,
	testGuard,
	useTestServer,
} from "../api-client/proxy-test-server.js";
import { readUsage } from "../billing/usage-counter-model.js";
import { ProjectModel } from "../projects/project-model.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";
import { createUpstreamDeps } from "./upstream-proxy.js";
import { ownerTunnelUrl } from "./upstream-target.js";

const server = useTestServer();
/** Port 3000 of the owner is a fake tunnel to the test server; 5000 is down. */
const kit = useMockTestKit({
	upstream: () =>
		createUpstreamDeps({
			guard: testGuard(),
			timeoutMs: 5_000,
			findTunnel: async (owner, port) => {
				if (port === 3000) return server.origin;
				if (port === 5000) return "http://127.0.0.1:1";
				return ownerTunnelUrl(owner, port);
			},
		}),
});

async function hybridProject(upstream: object) {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	await generate(OWNER, project.id, users.id, 2);
	const set = await as(OWNER).send("put", `/projects/${project.id}/upstream`, {
		upstream,
	});
	expect(set.status, JSON.stringify(set.body)).toBe(200);
	return { ...project, mock: kit.client(project.secret) };
}

describe("hybrid mock upstream", () => {
	it("answers resources from the mock and forwards the rest", async () => {
		const { mock } = await hybridProject({ kind: "tunnel", port: 3000 });
		const users = await mock.get("/users");
		expect(users.status).toBe(200);
		expect(users.headers["x-localman-source"]).toBe("mock");
		expect(users.body).toHaveLength(2);

		const orders = await mock
			.get("/orders/7?expand=items")
			.set("authorization", "Bearer abc")
			.set("cf-connecting-ip", "198.51.100.9");
		expect(orders.status).toBe(200);
		expect(orders.headers["x-localman-source"]).toBe("upstream");
		const echo = echoOf(orders.text);
		expect(echo).toMatchObject({
			method: "GET",
			path: "/orders/7?expand=items",
		});
		expect(headerValues(echo, "authorization")).toEqual(["Bearer abc"]);
		expect(headerValues(echo, "x-localman-proxy")).toEqual(["1"]);
		expect(headerValues(echo, "x-localman-hop")).toEqual(["1"]);
		expect(headerValues(echo, "host")).toEqual([`127.0.0.1:${server.port}`]);
		// The client's address as resolved; edge headers stay home.
		expect(headerValues(echo, "x-forwarded-for")).toEqual(["203.0.113.7"]);
		expect(headerValues(echo, "cf-connecting-ip")).toEqual([]);
	});

	it("forwards the exact body and methods no endpoint serves", async () => {
		const { mock } = await hybridProject({ kind: "tunnel", port: 3000 });
		const raw = '{ "total" : 12 }';
		const created = await mock
			.call("post", "/orders")
			.set("content-type", "application/json")
			.send(raw);
		const echo = echoOf(created.text);
		expect(echo.method).toBe("POST");
		expect(Buffer.from(echo.bodyBase64, "base64").toString()).toBe(raw);
		const text = await mock
			.call("post", "/users/1")
			.set("content-type", "text/plain")
			.send("plain");
		expect(text.headers["x-localman-source"]).toBe("upstream");
		expect(Buffer.from(echoOf(text.text).bodyBase64, "base64").toString()).toBe(
			"plain",
		);
	});

	it("answers 502 with a hint when the tunnel is not mapped or down", async () => {
		const missing = await hybridProject({ kind: "tunnel", port: 4000 });
		const res = await missing.mock.get("/orders");
		expect(res.status).toBe(502);
		expect(res.headers["x-localman-source"]).toBe("upstream");
		expect(res.body.error).toMatchObject({
			code: "UPSTREAM_UNAVAILABLE",
			hint: "tunelo http 4000",
			details: { cause: "no_tunnel", port: 4000 },
		});
		expect(res.body.error.message).toContain("localhost:4000");

		const down = await hybridProject({ kind: "tunnel", port: 5000 });
		const failed = await down.mock.get("/orders");
		expect(failed.status).toBe(502);
		expect(failed.body.error).toMatchObject({
			code: "UPSTREAM_UNAVAILABLE",
			hint: "tunelo http 5000",
			details: { cause: "connect" },
		});
	});

	it("refuses a private upstream address when forwarding", async () => {
		const project = await createMockProject();
		await ProjectModel.updateOne(
			{ _id: project.id },
			{ $set: { upstream: { kind: "url", baseUrl: "https://10.0.0.1" } } },
		);
		const res = await kit.client(project.secret).get("/orders");
		expect(res.status).toBe(502);
		expect(res.body.error).toMatchObject({
			code: "UPSTREAM_UNAVAILABLE",
			details: { cause: "blocked" },
		});
		expect(res.body.error.hint).toBeUndefined();
	});

	it("does not forward a request that came back from the upstream", async () => {
		const { mock } = await hybridProject({ kind: "tunnel", port: 3000 });
		const res = await mock.get("/orders").set("x-localman-hop", "1");
		expect(res.status).toBe(508);
		expect(res.body.error.code).toBe("UPSTREAM_LOOP");
	});

	it("counts forwarded requests toward the monthly quota", async () => {
		const { mock } = await hybridProject({ kind: "tunnel", port: 3000 });
		await mock.get("/users");
		await mock.get("/orders");
		await mock.get("/nope/1/deeper");
		await kit.meter().flush();
		expect((await readUsage(OWNER)).mockRequests).toBe(3);
	});

	it("keeps 404 without an upstream", async () => {
		const project = await createMockProject();
		const res = await kit.client(project.secret).get("/orders");
		expect(res.status).toBe(404);
		expect(res.headers["x-localman-source"]).toBe("mock");
	});
});
