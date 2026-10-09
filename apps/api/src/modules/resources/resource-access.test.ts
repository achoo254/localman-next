import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { ResourceModel } from "./resource-model.js";
import {
	createProject,
	createResource,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_access_alice";
const BOB = "acc_access_bob";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create([
		{ sub: ALICE, username: "alice" },
		{ sub: BOB, username: "bob" },
	]);
});

describe("resource access", () => {
	it("hides another user's resources behind 404 and lets nobody else write", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const bob = as(BOB);
		const one = resourcesPath(project, `/${users.id}`);
		const attempts = [
			bob.get(resourcesPath(project)),
			bob.get(one),
			bob.get(`${one}/data`),
			bob.send("post", resourcesPath(project), { name: "x" }),
			bob.send("put", one, { name: "x" }),
			bob.send("delete", one),
			bob.send("put", `${one}/parent`, { parentId: null }),
			bob.send("post", `${one}/generate`, { count: 1 }),
			bob.send("put", `${one}/data`, { data: [] }),
			bob.send("post", resourcesPath(project, "/generate_all"), {}),
			bob.send("post", resourcesPath(project, "/reset_all"), {}),
		];
		for (const res of await Promise.all(attempts)) {
			expect(res.status).toBe(404);
		}
		const otherProject = await createProject(BOB);
		const crossed = await as(BOB).get(
			resourcesPath(otherProject, `/${users.id}`),
		);
		expect(crossed.status).toBe(404);
		expect(await ResourceModel.countDocuments()).toBe(1);
	});

	it("lists the Faker whitelist for agents", async () => {
		const res = await as(ALICE).get("/faker-methods");
		expect(res.status).toBe(200);
		expect(res.body.categories).toHaveLength(21);
		expect(res.body.categories[0].methods).toContain("address.city");
	});
});
