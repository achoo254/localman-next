import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { CollaboratorModel } from "./collaborator-model.js";
import { hashInviteToken } from "./invite-token.js";
import { MagicLinkModel } from "./magic-link-model.js";
import {
	BOB,
	CAROL,
	DAVE,
	ERIN,
	OWNER,
	accept,
	addMember,
	createProject,
	inviteToken,
	magicLinkPath,
	magicToken,
	preview,
	useCollaboratorTestDb,
} from "./testing/collaborator-fixture.js";

useCollaboratorTestDb();

describe("magic link", () => {
	it("is shown once, stored as a hash, and reports only its state afterwards", async () => {
		const projectId = await createProject(OWNER);
		const none = await as(OWNER).get(magicLinkPath(projectId));
		expect(none.body).toEqual({
			status: "none",
			expiresAt: null,
			createdAt: null,
		});
		const token = await magicToken(OWNER, projectId);
		const stored = await MagicLinkModel.findOne({ projectId }).lean();
		expect(stored?.tokenHash).toBe(hashInviteToken(token));
		const state = await as(OWNER).get(magicLinkPath(projectId));
		expect(state.body.status).toBe("active");
		expect(JSON.stringify(state.body)).not.toContain(token);
	});

	it("admits anyone signed in, repeatedly, as collaborators", async () => {
		const projectId = await createProject(OWNER);
		const token = await magicToken(OWNER, projectId);
		const shown = await preview(CAROL, token);
		expect(shown.body).toMatchObject({
			kind: "magic",
			project: { id: projectId },
			inviteeEmail: null,
			eligible: true,
		});
		for (const sub of [CAROL, ERIN]) {
			const res = await accept(sub, token);
			expect(res.body).toEqual({ projectId, alreadyMember: false });
			const project = await as(sub).get(`/projects/${projectId}`);
			expect(project.body.role).toBe("collaborator");
		}
		expect((await accept(CAROL, token)).body.alreadyMember).toBe(true);
	});

	it("turns the caller's pending invitation into the membership", async () => {
		const projectId = await createProject(OWNER);
		await inviteToken(OWNER, projectId, "bob");
		const token = await magicToken(OWNER, projectId);
		expect((await accept(BOB, token)).status).toBe(200);
		const rows = await CollaboratorModel.find({ projectId }).lean();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.status).toBe("accepted");
	});

	it("rejects expired, revoked and replaced links", async () => {
		const projectId = await createProject(OWNER);
		const old = await magicToken(OWNER, projectId);
		const current = await magicToken(OWNER, projectId);
		expect((await accept(BOB, old)).body.error.code).toBe("INVITE_NOT_FOUND");
		await MagicLinkModel.updateOne(
			{},
			{ $set: { expiresAt: new Date(Date.now() - 1) } },
		);
		const expired = await accept(BOB, current);
		expect(expired.status).toBe(410);
		expect(expired.body.error.code).toBe("INVITE_EXPIRED");
		expect((await as(OWNER).get(magicLinkPath(projectId))).body.status).toBe(
			"expired",
		);
		const fresh = await magicToken(OWNER, projectId);
		const revoked = await as(OWNER).send("delete", magicLinkPath(projectId));
		expect(revoked.body.status).toBe("revoked");
		const res = await accept(BOB, fresh);
		expect(res.status).toBe(410);
		expect(res.body.error.code).toBe("INVITE_REVOKED");
		expect((await preview(BOB, fresh)).body.error.code).toBe("INVITE_REVOKED");
		expect(await CollaboratorModel.countDocuments()).toBe(0);
	});

	it("only ever admits to its own project", async () => {
		const first = await createProject(OWNER, "First");
		const second = await createProject(OWNER, "Second");
		const token = await magicToken(OWNER, first);
		await magicToken(OWNER, second);
		expect((await accept(BOB, token)).body.projectId).toBe(first);
		expect((await as(BOB).get(`/projects/${second}`)).status).toBe(404);
		// Revoking the other project's link leaves this one working.
		await as(OWNER).send("delete", magicLinkPath(second));
		expect((await accept(DAVE, token)).body.projectId).toBe(first);
	});

	it("holds no seat but stops at the owner's member limit", async () => {
		const projectId = await createProject(OWNER);
		const token = await magicToken(OWNER, projectId);
		const list = await as(OWNER).get(`/projects/${projectId}/collaborators`);
		expect(list.body.seats.used).toBe(1);
		await addMember(OWNER, projectId, BOB, "bob");
		expect((await accept(DAVE, token)).status).toBe(200);
		expect((await preview(ERIN, token)).body.reason).toBe("MEMBER_LIMIT");
		const full = await accept(ERIN, token);
		expect(full.status).toBe(403);
		expect(full.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "members", max: 3, used: 3 },
		});
	});

	it("never passes the limit when two people join for the last seat", async () => {
		const projectId = await createProject(OWNER);
		await addMember(OWNER, projectId, BOB, "bob");
		const token = await magicToken(OWNER, projectId);
		const results = await Promise.all([
			accept(DAVE, token),
			accept(ERIN, token),
		]);
		expect(results.map((res) => res.status).sort()).toEqual([200, 403]);
		expect(
			await CollaboratorModel.countDocuments({ projectId, status: "accepted" }),
		).toBe(2);
	});
});
