import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import { UserModel } from "../users/user-model.js";
import { LOG_BODY_LIMIT } from "./request-log-entry.js";
import { RequestLogModel, type StoredRequestLog } from "./request-log-model.js";
import { requestLog } from "./request-log-service.js";
import { clearMockProjectCache } from "./resolve-project.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();
const DAY_MS = 24 * 60 * 60 * 1000;

async function usersProject() {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	await generate(OWNER, project.id, users.id, 2);
	return { ...project, mock: kit.client(project.secret) };
}

async function lines(): Promise<StoredRequestLog[]> {
	await requestLog.flush();
	return RequestLogModel.find().sort({ _id: 1 }).lean<StoredRequestLog[]>();
}

const logsPath = (id: string, query = "") =>
	`/projects/${id}/request-logs${query}`;

describe("request log", () => {
	it("logs every admitted request with masked headers", async () => {
		const { id, mock } = await usersProject();
		await as(OWNER).send("put", `/projects/${id}/redact-headers`, {
			headers: ["X-Secret"],
		});
		const res = await mock
			.get("/users?limit=1")
			.set("authorization", "Bearer abc")
			.set("cookie", "sid=1")
			.set("x-api-key", "k")
			.set("x-secret", "s")
			.set("x-plain", "visible");
		expect(res.status).toBe(200);
		const [line] = await lines();
		expect(line).toMatchObject({
			method: "GET",
			path: "/users",
			query: "limit=1",
			status: 200,
			source: "mock",
		});
		const sent = Object.fromEntries(
			(line?.request.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]),
		);
		expect(sent).toMatchObject({
			authorization: "[redacted]",
			cookie: "[redacted]",
			"x-api-key": "[redacted]",
			"x-secret": "[redacted]",
			"x-plain": "visible",
		});
		// Infrastructure headers are not the client's.
		expect(sent["x-forwarded-for"]).toBeUndefined();
		expect(JSON.parse(line?.response.body ?? "")).toHaveLength(1);
	});

	it("cuts bodies at 64 KB and keeps the whole size", async () => {
		const { mock } = await usersProject();
		const big = { name: "x".repeat(LOG_BODY_LIMIT + 1000) };
		await mock.call("post", "/users", big);
		const [line] = await lines();
		expect(line?.request.truncated).toBe(true);
		expect(line?.request.size).toBe(JSON.stringify(big).length);
		expect(line?.request.body.length).toBe(LOG_BODY_LIMIT);
	});

	it("sets the expiry from the owner's plan when written", async () => {
		const { mock } = await usersProject();
		await mock.get("/users");
		await UserModel.updateOne({ sub: OWNER }, { plan: "pro" });
		clearMockProjectCache();
		await mock.get("/users");
		const [free, pro] = await lines();
		const days = (line?: StoredRequestLog) =>
			line ? (line.expiresAt.getTime() - line.at.getTime()) / DAY_MS : 0;
		expect(days(free)).toBe(7);
		expect(days(pro)).toBe(30);
		const indexes = await RequestLogModel.collection.indexes();
		expect(indexes).toContainEqual(
			expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
		);
	});

	it("lists newest first with filters and a cursor", async () => {
		const { id, mock } = await usersProject();
		await mock.get("/users");
		await mock.get("/users/1");
		await mock.get("/users/99");
		await mock.call("post", "/users", { name: "Ada" });
		const all = await as(OWNER).get(logsPath(id, "?limit=2"));
		expect(all.status).toBe(200);
		expect(all.body.items.map((i: { status: number }) => i.status)).toEqual([
			201, 404,
		]);
		const next = await as(OWNER).get(
			logsPath(id, `?limit=2&cursor=${all.body.nextCursor}`),
		);
		expect(next.body.items.map((i: { path: string }) => i.path)).toEqual([
			"/users/1",
			"/users",
		]);
		expect(next.body.nextCursor).toBeNull();
		const filtered = await as(OWNER).get(
			logsPath(id, "?method=GET&status=2xx&source=mock&path=USERS/"),
		);
		expect(filtered.body.items).toHaveLength(1);
		expect(filtered.body.items[0].path).toBe("/users/1");
		const bad = await as(OWNER).get(logsPath(id, "?status=7xx"));
		expect(bad.status).toBe(400);
		const detail = await as(OWNER).get(
			logsPath(id, `/${all.body.items[0].id}`),
		);
		expect(detail.body.request.body).toBe('{"name":"Ada"}');
	});

	it("lets the owner clear the log after a dry run", async () => {
		const { id, mock } = await usersProject();
		await mock.get("/users");
		await mock.get("/users");
		const dry = await as(OWNER).send("delete", `${logsPath(id)}?dryRun=true`);
		expect(dry.body).toEqual({ dryRun: true, deleted: 2 });
		const done = await as(OWNER).send("delete", logsPath(id));
		expect(done.body).toEqual({ dryRun: false, deleted: 2 });
		expect(await lines()).toHaveLength(0);
	});

	it("goes with the project when it is deleted", async () => {
		const { id, mock } = await usersProject();
		await mock.get("/users");
		await as(OWNER).send("delete", `/projects/${id}`);
		expect(await lines()).toHaveLength(0);
	});
});
