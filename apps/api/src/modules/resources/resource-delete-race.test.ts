import { limitsFor } from "@localman/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { ResourceTreeLockModel } from "../projects/project-lock.js";
import { ProjectModel } from "../projects/project-model.js";
import { UserModel } from "../users/user-model.js";
import { RecordModel } from "./record-model.js";
import { ResourceModel } from "./resource-model.js";
import {
	createProject,
	createResource,
	generate,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_race_alice";
const ROUNDS = 12;

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

async function orphanCounts() {
	const live = (await ProjectModel.find().select("_id").lean()).map(
		(p) => p._id,
	);
	const [resources, records, locks] = await Promise.all([
		ResourceModel.countDocuments({ projectId: { $nin: live } }),
		RecordModel.countDocuments({ projectId: { $nin: live } }),
		ResourceTreeLockModel.countDocuments({ _id: { $nin: live } }),
	]);
	return { resources, records, locks };
}

describe("deleting a project while its resources are written", () => {
	it("leaves no orphaned resource, record or quota slot", async () => {
		for (let round = 0; round < ROUNDS; round += 1) {
			const project = await createProject(ALICE, `Race ${round}`);
			const users = await createResource(ALICE, project, { name: "users" });
			await generate(ALICE, project, users.id, 5);
			const results = await Promise.all([
				as(ALICE).send("post", resourcesPath(project), { name: "a" }),
				as(ALICE).send("post", resourcesPath(project), { name: "b" }),
				generate(ALICE, project, users.id, 20),
				as(ALICE).send("delete", `/projects/${project}`),
			]);
			for (const res of results) expect([200, 201, 404]).toContain(res.status);
			expect(results[3]?.status).toBe(200);
			expect(await orphanCounts()).toEqual({
				resources: 0,
				records: 0,
				locks: 0,
			});
		}
		expect(await ResourceModel.countDocuments({ ownerSub: ALICE })).toBe(0);
		const project = await createProject(ALICE, "After");
		for (let i = 0; i < limitsFor("free").resources; i += 1) {
			const res = await as(ALICE).send("post", resourcesPath(project), {
				name: `r${i}`,
			});
			expect(res.status).toBe(201);
		}
	});
});
