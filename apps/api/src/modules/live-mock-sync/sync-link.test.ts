import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import {
	EVE,
	VIC,
	collectionOf,
	environmentOf,
	renameResource,
	requestNamed,
	syncNow,
	syncedUsers,
	useSyncTestDb,
} from "./testing/sync-fixture.js";

useSyncTestDb();

const status = (sub: string, id: string) =>
	as(sub).get(`/collections/${id}/mock-sync`);

describe("creating a synced collection", () => {
	it("makes the collection, its environment and the link", async () => {
		const s = await syncedUsers();
		const detail = await collectionOf(EVE, s.collection);
		expect(detail.name).toBe("Shop");
		expect(detail.mockProject?.id).toBe(s.project);
		expect(detail.relatedEnvironment?.id).toBe(s.environment);
		expect(requestNamed(detail, "List users").draft.url).toBe(
			"{{baseUrl}}/users",
		);
		expect(requestNamed(detail, "Delete from users").draft.url).toBe(
			"{{baseUrl}}/users/{{userId}}",
		);
		const environment = await environmentOf(EVE, s.environment);
		expect(environment.name).toBe("Shop (mock)");
		const values = Object.fromEntries(
			environment.variables.map((v) => [v.key, v.sharedValue]),
		);
		expect(values.baseUrl).toMatch(/^https?:\/\/[^/]+\.\S+$/);
		expect(values.userId).toBe("1");
		const res = await status(VIC, s.collection);
		expect(res.status).toBe(200);
		// Vic views the collection but cannot read Eve's project.
		expect(res.body).toMatchObject({
			project: null,
			conflicts: 0,
			canManage: false,
		});
		expect((await status(EVE, s.collection)).body).toMatchObject({
			project: { id: s.project, name: "Shop" },
			canManage: true,
		});
	});

	it("names requests in the language sent", async () => {
		const s = await syncedUsers();
		const names = {
			list: "Danh sách {name}",
			get: "Xem {name}",
			create: "Tạo {name}",
			update: "Thay {name}",
			patch: "Sửa {name}",
			delete: "Xoá {name}",
			removedFolder: "Đã gỡ",
			removedItem: "Đã gỡ khỏi mock.",
			environment: "{name} (mock)",
		};
		const res = await as(EVE).send(
			"post",
			`/projects/${s.project}/synced-collections`,
			{ workspaceId: s.ws, names },
		);
		expect(res.status).toBe(201);
		const detail = await collectionOf(EVE, res.body.collectionId);
		expect(requestNamed(detail, "Danh sách users")).toBeDefined();
	});

	it("needs an Editor of the project who adds elements to the workspace", async () => {
		const s = await syncedUsers();
		// Vic is a Viewer of the workspace and not in the project.
		const res = await as(VIC).send(
			"post",
			`/projects/${s.project}/synced-collections`,
			{ workspaceId: s.ws },
		);
		expect(res.status).toBe(404);
	});

	it("lists the project's synced collections the caller can open", async () => {
		const s = await syncedUsers();
		const res = await as(EVE).get(`/projects/${s.project}/synced-collections`);
		expect(res.body.items).toEqual([
			{ collectionId: s.collection, name: "Shop" },
		]);
	});
});

describe("turning the sync off", () => {
	it("keeps the content and stops following the mock", async () => {
		const s = await syncedUsers();
		expect(
			(await as(VIC).send("delete", `/collections/${s.collection}/mock-sync`))
				.status,
		).toBe(403);
		const off = await as(EVE).send(
			"delete",
			`/collections/${s.collection}/mock-sync`,
		);
		expect(off.status, JSON.stringify(off.body)).toBe(200);
		expect((await status(EVE, s.collection)).status).toBe(404);
		await renameResource(s, "members");
		await syncNow(s.project);
		const detail = await collectionOf(EVE, s.collection);
		expect(requestNamed(detail, "List users").draft.url).toBe(
			"{{baseUrl}}/users",
		);
	});
});

describe("forks of a synced collection", () => {
	beforeEach(async () => {
		await UserModel.updateMany(
			{},
			{ $set: { plan: "pro", planExpiresAt: null } },
		);
	});

	it("leaves the fork alone: only the original follows the mock", async () => {
		const s = await syncedUsers();
		const res = await as(EVE).send(
			"post",
			`/collections/${s.collection}/forks`,
			{
				label: "eve-fork",
				workspaceId: s.ws,
			},
		);
		expect(res.status, JSON.stringify(res.body)).toBe(201);
		const fork = res.body.id as string;
		expect((await status(EVE, fork)).status).toBe(404);
		await renameResource(s, "members");
		await syncNow(s.project);
		const forked = await collectionOf(EVE, fork);
		expect(requestNamed(forked, "List users").draft.url).toBe(
			"{{baseUrl}}/users",
		);
		const original = await collectionOf(EVE, s.collection);
		expect(requestNamed(original, "List members").draft.url).toBe(
			"{{baseUrl}}/members",
		);
	});
});
