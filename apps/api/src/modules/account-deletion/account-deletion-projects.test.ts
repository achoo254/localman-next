import { describe, expect, it } from "vitest";
import "../../db/register-models.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import { MemberRemovalModel } from "../collaborators/member-removal-model.js";
import {
	BOB,
	CAROL,
	OWNER,
	accept,
	addMember,
	collaboratorsPath,
	createProject,
	magicToken,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { ProjectModel } from "../projects/project-model.js";
import { RecordModel } from "../resources/record-model.js";
import { ResourceModel } from "../resources/resource-model.js";
import { UserModel } from "../users/user-model.js";
import { deleteAccount } from "./account-deletion-service.js";

useCollaboratorTestDb();

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
	it("deletes owned projects nobody else uses, with their data, and ends memberships", async () => {
		const owned = await projectWithData(OWNER, "Mine");
		const bobs = await projectWithData(BOB, "Bob's");
		await addMember(BOB, bobs, OWNER, "owner");

		await deleteAccount(OWNER);
		expect(await ProjectModel.exists({ _id: owned })).toBeNull();
		expect(await ResourceModel.countDocuments({ projectId: owned })).toBe(0);
		expect(await RecordModel.countDocuments({ projectId: owned })).toBe(0);
		// Bob's project keeps its data and loses only the deleted member.
		expect((await as(BOB).get(`/projects/${bobs}`)).status).toBe(200);
		expect(await RecordModel.countDocuments({ projectId: bobs })).toBe(3);
		expect(
			await CollaboratorModel.countDocuments({ inviteeUserId: OWNER }),
		).toBe(0);
	});

	it("hands a shared project to its earliest member, with its data and quota", async () => {
		const shared = await projectWithData(OWNER, "Shared");
		await addMember(OWNER, shared, BOB, "bob");
		await addMember(OWNER, shared, CAROL, "carol");
		// Bob already owns a project: the moved one takes his next free slot.
		const bobs = await createProject(BOB, "Bob's own");

		await deleteAccount(OWNER);
		const moved = await ProjectModel.findById(shared).lean();
		expect(moved?.owner).toBe(BOB);
		const bobSlots = await ProjectModel.find({ owner: BOB }).lean();
		expect(new Set(bobSlots.map((p) => p.quotaSlot)).size).toBe(2);
		expect(bobSlots.map((p) => p._id.toHexString())).toContain(bobs);
		const resources = await ResourceModel.find({ projectId: shared }).lean();
		expect(resources.map((r) => r.ownerSub)).toEqual([BOB]);
		expect(await RecordModel.countDocuments({ projectId: shared })).toBe(3);
		// Bob is the owner now, no longer a member; Carol stays a member.
		const members = await CollaboratorModel.find({ projectId: shared }).lean();
		expect(members.map((m) => m.inviteeUserId)).toEqual([CAROL]);
		expect((await as(BOB).get(`/projects/${shared}`)).body.role).toBe("owner");
		expect((await as(CAROL).get(`/projects/${shared}`)).status).toBe(200);
	});

	it("can run again after a deletion that stopped half way", async () => {
		const owned = await projectWithData(OWNER, "Half");
		// A tombstone left by an interrupted project deletion.
		await ProjectModel.updateOne(
			{ _id: owned },
			{ $set: { deletingAt: new Date() } },
		);
		await deleteAccount(OWNER);
		expect(await ProjectModel.exists({ _id: owned })).toBeNull();
		expect(await ResourceModel.countDocuments({ projectId: owned })).toBe(0);
		expect(await UserModel.exists({ sub: OWNER })).toBeNull();
	});

	it("keeps the owner's removal of a member who deletes their account", async () => {
		const projectId = await createProject(OWNER, "Kept out");
		const link = await magicToken(OWNER, projectId);
		expect((await accept(BOB, link)).status).toBe(200);
		const row = await CollaboratorModel.findOne({
			projectId,
			inviteeUserId: BOB,
		}).lean();
		const removed = await as(OWNER).send(
			"delete",
			collaboratorsPath(projectId, `/${row?._id.toHexString()}`),
		);
		expect(removed.status).toBe(200);

		await deleteAccount(BOB);
		expect(await MemberRemovalModel.countDocuments({ userSub: BOB })).toBe(1);

		// The same IdP account signs in again: the magic link still refuses it.
		await UserModel.create({ sub: BOB, username: "bob" });
		const again = await accept(BOB, link);
		expect(again.status).toBe(403);
		expect(again.body.error.code).toBe("REMOVED_BY_OWNER");
	});
});
