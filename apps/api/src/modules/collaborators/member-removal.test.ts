import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { CollaboratorModel } from "./collaborator-model.js";
import { MemberRemovalModel } from "./member-removal-model.js";
import {
	BOB,
	OWNER,
	accept,
	collaboratorsPath,
	createProject,
	inviteToken,
	magicToken,
	preview,
	useCollaboratorTestDb,
} from "./testing/collaborator-fixture.js";

useCollaboratorTestDb();

/** The project, its magic link token, and Bob joined through it. */
async function bobJoinedByLink() {
	const projectId = await createProject(OWNER);
	const link = await magicToken(OWNER, projectId);
	expect((await accept(BOB, link)).status).toBe(200);
	return { projectId, link };
}

async function rowIdOf(projectId: string, sub: string): Promise<string> {
	const row = await CollaboratorModel.findOne({
		projectId,
		inviteeUserId: sub,
	}).lean();
	return row?._id.toHexString() ?? "";
}

async function remove(sub: string, projectId: string, rowId: string) {
	const res = await as(sub).send(
		"delete",
		collaboratorsPath(projectId, `/${rowId}`),
	);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
}

describe("members removed by the owner", () => {
	it("cannot come back through the magic link", async () => {
		const { projectId, link } = await bobJoinedByLink();
		await remove(OWNER, projectId, await rowIdOf(projectId, BOB));
		const shown = await preview(BOB, link);
		expect(shown.body).toMatchObject({
			eligible: false,
			reason: "REMOVED_BY_OWNER",
		});
		const refused = await accept(BOB, link);
		expect(refused.status).toBe(403);
		expect(refused.body.error.code).toBe("REMOVED_BY_OWNER");
		expect((await as(BOB).get(`/projects/${projectId}`)).status).toBe(404);
		// The mark takes no seat and is not listed.
		const list = await as(OWNER).get(collaboratorsPath(projectId));
		expect(list.body.items).toEqual([]);
		expect(list.body.seats.used).toBe(1);
	});

	it("are not marked when they leave on their own", async () => {
		const { projectId, link } = await bobJoinedByLink();
		await remove(BOB, projectId, await rowIdOf(projectId, BOB));
		expect(await MemberRemovalModel.countDocuments()).toBe(0);
		expect((await accept(BOB, link)).body.alreadyMember).toBe(false);
	});

	it("come back only by accepting a new invitation from the owner", async () => {
		const { projectId, link } = await bobJoinedByLink();
		await remove(OWNER, projectId, await rowIdOf(projectId, BOB));
		// A cancelled invitation keeps the mark.
		await inviteToken(OWNER, projectId, "bob");
		await remove(OWNER, projectId, await rowIdOf(projectId, BOB));
		expect((await accept(BOB, link)).body.error.code).toBe("REMOVED_BY_OWNER");
		const invited = await inviteToken(OWNER, projectId, "bob");
		expect((await accept(BOB, invited)).status).toBe(200);
		expect(await MemberRemovalModel.countDocuments()).toBe(0);
		// Leaving afterwards leaves the magic link open again.
		await remove(BOB, projectId, await rowIdOf(projectId, BOB));
		expect((await accept(BOB, link)).status).toBe(200);
	});

	it("lose their mark with the project", async () => {
		const { projectId } = await bobJoinedByLink();
		await remove(OWNER, projectId, await rowIdOf(projectId, BOB));
		expect(await MemberRemovalModel.countDocuments()).toBe(1);
		const deleted = await as(OWNER).send("delete", `/projects/${projectId}`);
		expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
		expect(await MemberRemovalModel.countDocuments()).toBe(0);
	});
});
