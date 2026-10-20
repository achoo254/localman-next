import { describe, expect, it } from "vitest";
import "../../db/register-models.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import {
	BOB,
	OWNER,
	addMember,
	createProject,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { ProjectModel } from "../projects/project-model.js";
import { RecordModel } from "../resources/record-model.js";
import { ResourceModel } from "../resources/resource-model.js";
import { UserModel } from "../users/user-model.js";

useCollaboratorTestDb();

const deleteOwner = (dryRun = false) =>
	as(OWNER).send(
		"delete",
		`/users/me${dryRun ? "?dryRun=true" : ""}`,
		dryRun ? {} : { confirm: "owner" },
	);

async function projectWithData(sub: string, name: string): Promise<string> {
	const id = await createProject(sub, name);
	const resource = await as(sub).send("post", `/projects/${id}/resources`, {
		name: "users",
	});
	expect(resource.status, JSON.stringify(resource.body)).toBe(201);
	const generated = await as(sub).send(
		"post",
		`/projects/${id}/resources/${resource.body.id}/generate`,
		{ count: 3 },
	);
	expect(generated.status, JSON.stringify(generated.body)).toBe(200);
	return id;
}

describe("account deletion and mock projects", () => {
	it("deletes owned projects with their data, even shared ones, and ends memberships", async () => {
		const owned = await projectWithData(OWNER, "Mine");
		await addMember(OWNER, owned, BOB, "bob");
		const bobs = await projectWithData(BOB, "Bob's");
		await addMember(BOB, bobs, OWNER, "owner");

		const preview = await deleteOwner(true);
		expect(preview.status, JSON.stringify(preview.body)).toBe(200);
		expect(preview.body).toMatchObject({ ownedProjects: 1, sharedProjects: 1 });

		const res = await deleteOwner();
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(await ProjectModel.exists({ _id: owned })).toBeNull();
		expect(await ResourceModel.countDocuments({ projectId: owned })).toBe(0);
		expect(await RecordModel.countDocuments({ projectId: owned })).toBe(0);
		expect(await CollaboratorModel.countDocuments({ projectId: owned })).toBe(
			0,
		);
		// Bob's project keeps its data and loses only the deleted member.
		expect((await as(BOB).get(`/projects/${bobs}`)).status).toBe(200);
		expect(await RecordModel.countDocuments({ projectId: bobs })).toBe(3);
		expect(
			await CollaboratorModel.countDocuments({ inviteeUserId: OWNER }),
		).toBe(0);
		expect((await as(BOB).get(`/projects/${owned}`)).status).toBe(404);
	});

	it("can run again after a deletion that stopped half way", async () => {
		const owned = await projectWithData(OWNER, "Half");
		// A tombstone left by an interrupted project deletion.
		await ProjectModel.updateOne(
			{ _id: owned },
			{ $set: { deletingAt: new Date() } },
		);
		expect((await deleteOwner(true)).body.ownedProjects).toBe(0);
		expect((await deleteOwner()).status).toBe(200);
		expect(await ProjectModel.exists({ _id: owned })).toBeNull();
		expect(await ResourceModel.countDocuments({ projectId: owned })).toBe(0);
		expect(await UserModel.exists({ sub: OWNER })).toBeNull();
	});
});
