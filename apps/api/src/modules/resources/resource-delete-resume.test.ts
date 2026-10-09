import { limitsFor } from "@localman/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
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

const ALICE = "acc_resume_alice";
const FREE_RESOURCES = limitsFor("free").resources;
const FREE_PROJECTS = limitsFor("free").projects;

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});
afterEach(() => vi.restoreAllMocks());

describe("a project deletion that fails midway", () => {
	it("hides the project, keeps its slots, and resumes on the next DELETE", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		await generate(ALICE, project, users.id, 5);
		vi.spyOn(ResourceModel, "deleteMany").mockRejectedValueOnce(
			new Error("disk full"),
		);

		const failed = await as(ALICE).send("delete", `/projects/${project}`);
		expect(failed.status).toBe(500);
		const tombstone = await ProjectModel.findById(project).lean();
		expect(tombstone?.deletingAt).toBeInstanceOf(Date);
		// The cleanup transaction rolled back: data and quota slots remain.
		expect(await ResourceModel.countDocuments()).toBe(1);
		expect(await RecordModel.countDocuments()).toBe(5);

		// Gone for every read and write but DELETE.
		expect((await as(ALICE).get("/projects")).body.items).toEqual([]);
		expect((await as(ALICE).get(resourcesPath(project))).status).toBe(404);
		const write = await as(ALICE).send("post", resourcesPath(project), {
			name: "late",
		});
		expect(write.status).toBe(404);
		expect(
			(await as(ALICE).send("put", `/projects/${project}`, { name: "X" }))
				.status,
		).toBe(404);
		expect(
			(await as(ALICE).send("post", `/projects/${project}/clone`)).status,
		).toBe(404);

		// Slots stay taken while the deletion is unfinished.
		const other = await createProject(ALICE, "Other");
		for (let i = 0; i < FREE_RESOURCES - 1; i += 1) {
			await createResource(ALICE, other, { name: `r${i}` });
		}
		const blocked = await as(ALICE).send("post", resourcesPath(other), {
			name: "one-more",
		});
		expect(blocked.status).toBe(403);

		const resumed = await as(ALICE).send("delete", `/projects/${project}`);
		expect(resumed.status).toBe(200);
		expect(resumed.body.dependents).toContainEqual({
			kind: "resources",
			count: 1,
		});
		expect(await ProjectModel.exists({ _id: project })).toBeNull();
		expect(await ResourceModel.countDocuments({ projectId: project })).toBe(0);
		expect(await RecordModel.countDocuments()).toBe(0);

		const freed = await as(ALICE).send("post", resourcesPath(other), {
			name: "one-more",
		});
		expect(freed.status).toBe(201);
		for (let i = 1; i < FREE_PROJECTS; i += 1) {
			expect(
				(await as(ALICE).send("post", "/projects", { name: `P${i}` })).status,
			).toBe(201);
		}
		expect(
			(await as(ALICE).send("delete", `/projects/${project}`)).status,
		).toBe(404);
	});
});
