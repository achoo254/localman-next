import request from "supertest";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ProjectModel } from "../projects/project-model.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import {
	MOCK_DOMAIN,
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

async function projectWith(prefix: string, ...names: string[]) {
	const project = await createMockProject(prefix);
	for (const name of names) {
		const resource = await createResource(OWNER, project.id, { name });
		await generate(OWNER, project.id, resource.id, 2);
	}
	return project;
}

describe("mock routing", () => {
	it("finds the project by host or by /m/:secret, below its prefix", async () => {
		const project = await projectWith("/api/v1", "users");
		const mock = kit.client(project.secret);
		expect((await mock.get("/api/v1/users")).status).toBe(200);
		expect((await mock.get("/users")).body).toBe("Not found");
		expect((await mock.get("/API/v1/users")).status).toBe(404);
		const upperHost = await request(mock.app)
			.get("/api/v1/users/1")
			.set("host", `${project.secret.toUpperCase()}.${MOCK_DOMAIN}:4100`);
		expect(upperHost.status).toBe(200);
		const viaPath = await request(mock.app)
			.get(`/m/${project.secret}/api/v1/users/2`)
			.set("host", "localhost:4100");
		expect(viaPath.status).toBe(200);
		expect(viaPath.body.id).toBe("2");
	});

	it("answers 404 for unknown secrets and projects being deleted", async () => {
		const project = await projectWith("", "users");
		expect((await kit.client("nosuchsecret").get("/users")).body).toBe(
			"Not found",
		);
		const mock = kit.client(project.secret);
		expect((await mock.get("/users")).status).toBe(200);
		await as(OWNER).send("delete", `/projects/${project.id}`);
		expect((await mock.get("/users")).status).toBe(404);
	});

	it("serves a changed prefix without waiting for the cache", async () => {
		const project = await projectWith("/old", "users");
		const mock = kit.client(project.secret);
		expect((await mock.get("/old/users")).status).toBe(200);
		const renamed = await as(OWNER).send("put", `/projects/${project.id}`, {
			name: "Mock",
			prefix: "/new",
		});
		expect(renamed.status).toBe(200);
		expect((await mock.get("/new/users")).status).toBe(200);
		expect((await mock.get("/old/users")).status).toBe(404);
	});

	it("matches resource names case-sensitively", async () => {
		const project = await projectWith("", "Side", "side");
		const mock = kit.client(project.secret);
		await mock.call("put", "/Side/1", { marker: "upper" });
		expect((await mock.get("/Side/1")).body.marker).toBe("upper");
		expect((await mock.get("/side/1")).body.marker).toBeUndefined();
		expect((await mock.get("/SIDE")).status).toBe(404);
	});

	it("claims /healthz on a project host and keeps it on the bare host", async () => {
		const project = await projectWith("", "healthz");
		const onProject = await kit.client(project.secret).get("/healthz");
		expect(Array.isArray(onProject.body)).toBe(true);
		const bare = await request(kit.client(project.secret).app)
			.get("/healthz")
			.set("host", "localhost:4100");
		expect(bare.body.status).toBe("ok");
	});

	it("answers 404 for disabled endpoints and methods the source lacks", async () => {
		const project = await createMockProject();
		const users = await createResource(OWNER, project.id, {
			name: "users",
			endpoints: [{ method: "DELETE", path: "/:res/:id", enabled: false }],
		});
		await generate(OWNER, project.id, users.id, 2);
		const mock = kit.client(project.secret);
		expect((await mock.call("delete", "/users/1")).status).toBe(404);
		expect((await mock.get("/users/1")).status).toBe(200);
		expect((await mock.call("post", "/users/1", {})).status).toBe(404);
		expect((await mock.call("put", "/users", {})).status).toBe(404);
		const head = await mock.call("head", "/users");
		expect(head.status).toBe(200);
		const search = await request(mock.app)
			.search("/users")
			.set("host", `${project.secret}.${MOCK_DOMAIN}`);
		expect(search.status).toBe(404);
		expect(await ProjectModel.countDocuments()).toBe(1);
	});

	it("sends JSON, a request id and open CORS without credentials", async () => {
		const project = await projectWith("", "users");
		const mock = kit.client(project.secret);
		const res = await mock.get("/users").set("origin", "https://app.example");
		expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
		expect(res.headers["x-localman-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
		expect(res.headers["access-control-allow-origin"]).toBe("*");
		expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
		expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
		const preflight = await request(mock.app)
			.options("/users")
			.set("host", `${project.secret}.${MOCK_DOMAIN}`)
			.set("origin", "https://app.example")
			.set("access-control-request-method", "PATCH")
			.set("access-control-request-headers", "authorization, content-type");
		expect(preflight.status).toBe(204);
		expect(preflight.headers["access-control-allow-methods"]).toContain(
			"PATCH",
		);
		expect(preflight.headers["access-control-allow-headers"]).toBe(
			"authorization, content-type",
		);
		const crafted = await request(mock.app)
			.options("/users")
			.set("host", `${project.secret}.${MOCK_DOMAIN}`)
			.set("access-control-request-headers", "x-a; evil=1");
		expect(crafted.headers["access-control-allow-headers"]).toBeUndefined();
	});
});
