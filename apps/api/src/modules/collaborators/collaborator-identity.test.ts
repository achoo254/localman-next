import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { CollaboratorModel } from "./collaborator-model.js";
import {
	BOB,
	CAROL,
	DAVE,
	ERIN,
	OWNER,
	accept,
	addMember,
	createProject,
	invite,
	inviteToken,
	magicToken,
	useCollaboratorTestDb,
} from "./testing/collaborator-fixture.js";

useCollaboratorTestDb();

describe("who an invitation belongs to", () => {
	it("rebuilds the identity when the same email is invited again", async () => {
		const projectId = await createProject(OWNER);
		const bound = await invite(OWNER, projectId, "bob@example.com");
		expect(bound.body.collaborator.user.sub).toBe(BOB);
		// BOB moved to another address: nobody uses this email any more.
		await UserModel.updateOne(
			{ sub: BOB },
			{ $set: { email: "bob@new.example" } },
		);
		const again = await invite(OWNER, projectId, "bob@example.com");
		expect(again.status).toBe(201);
		expect(again.body.collaborator).toMatchObject({
			id: bound.body.collaborator.id,
			user: null,
			inviteeEmail: "bob@example.com",
		});
		const row = await CollaboratorModel.findById(
			bound.body.collaborator.id,
		).lean();
		expect(row).not.toHaveProperty("inviteeUserId");
	});

	it("binds an email only to a verified account or a single unverified one", async () => {
		const projectId = await createProject(OWNER);
		await UserModel.updateOne(
			{ sub: ERIN },
			{ $set: { email: "carol@example.com" } },
		);
		// Two unverified accounts read the same address: bind neither.
		const ambiguous = await invite(OWNER, projectId, "carol@example.com");
		expect(ambiguous.body).toMatchObject({ invitee: null, notified: false });
		expect(ambiguous.body.collaborator.user).toBeNull();
		await UserModel.updateOne({ sub: ERIN }, { $set: { emailVerified: true } });
		const verified = await invite(OWNER, projectId, "CAROL@example.com");
		expect(verified.body.collaborator.user.sub).toBe(ERIN);
	});

	it("does not call a new holder of a member's old address a member", async () => {
		const projectId = await createProject(OWNER);
		await addMember(OWNER, projectId, BOB, "bob@example.com");
		await UserModel.updateOne(
			{ sub: BOB },
			{ $set: { email: "bob@new.example" } },
		);
		await UserModel.updateOne(
			{ sub: DAVE },
			{ $set: { email: "bob@example.com", emailVerified: true } },
		);
		const res = await invite(OWNER, projectId, "bob@example.com");
		expect(res.status).toBe(201);
		expect(res.body.collaborator.user.sub).toBe(DAVE);
		const bobRow = await CollaboratorModel.findOne({
			inviteeUserId: BOB,
		}).lean();
		expect(bobRow?.status).toBe("accepted");
		expect(bobRow).not.toHaveProperty("inviteeEmail");
	});

	it("turns an unbound invitation to the caller's verified email into the membership", async () => {
		const projectId = await createProject(OWNER);
		await UserModel.updateOne({ sub: DAVE }, { $unset: { email: 1 } });
		await inviteToken(OWNER, projectId, "dave@example.com");
		await UserModel.updateOne(
			{ sub: DAVE },
			{ $set: { email: "dave@example.com" } },
		);
		const token = await magicToken(OWNER, projectId);
		expect((await accept(DAVE, token)).status).toBe(200);
		const rows = await CollaboratorModel.find({ projectId }).lean();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ status: "accepted", inviteeUserId: DAVE });
	});

	it("drops the caller's unbound email invitation when accepting another", async () => {
		const projectId = await createProject(OWNER);
		await UserModel.updateOne({ sub: DAVE }, { $unset: { email: 1 } });
		await inviteToken(OWNER, projectId, "dave@example.com");
		await UserModel.updateOne(
			{ sub: DAVE },
			{ $set: { email: "dave@example.com" } },
		);
		const byName = await inviteToken(OWNER, projectId, "dave");
		expect((await accept(DAVE, byName)).status).toBe(200);
		const rows = await CollaboratorModel.find({ projectId }).lean();
		expect(rows.map((row) => row.status)).toEqual(["accepted"]);
	});

	it("keeps every member after a downgrade, refusing only new ones until under the cap", async () => {
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "pro" } });
		const projectId = await createProject(OWNER);
		await addMember(OWNER, projectId, BOB, "bob");
		await addMember(OWNER, projectId, DAVE, "dave");
		await addMember(OWNER, projectId, ERIN, "erin");
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "free" } });
		for (const sub of [BOB, DAVE, ERIN]) {
			expect((await as(sub).get(`/projects/${projectId}`)).status).toBe(200);
		}
		const refused = await invite(OWNER, projectId, "carol");
		expect(refused.status).toBe(403);
		expect(refused.body.error.details).toEqual({
			limit: "members",
			max: 3,
			used: 4,
		});
		const token = await magicToken(OWNER, projectId);
		expect((await accept(CAROL, token)).status).toBe(403);
	});
});
