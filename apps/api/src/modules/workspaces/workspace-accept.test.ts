import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	BOB,
	DAVE,
	ERIN,
	OWNER,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { UserModel } from "../users/user-model.js";
import {
	acceptWorkspace,
	createLink,
	createWorkspace,
	inviteTokenTo,
	previewWorkspace,
	workspacePath,
	workspaceTokenOf,
} from "./testing/workspace-fixture.js";
import { WorkspaceMemberModel } from "./workspace-member-model.js";

useCollaboratorTestDb();

async function linkToken(
	workspaceId: string,
	role = "viewer",
): Promise<string> {
	const res = await createLink(OWNER, workspaceId, role);
	expect(res.status).toBe(201);
	return workspaceTokenOf(res.body.inviteLink as string);
}

describe("POST /workspace-invites/preview", () => {
	it("shows the workspace, role and inviter, and whether the caller can accept", async () => {
		const id = await createWorkspace(OWNER, "Backend");
		const token = await inviteTokenTo(OWNER, id, "bob", "viewer");
		const res = await previewWorkspace(BOB, token);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			workspace: { id, name: "Backend" },
			kind: "account",
			role: "viewer",
			inviter: { username: "owner", name: "Owner" },
			inviteeEmail: null,
			eligible: true,
			reason: null,
		});
		expect((await previewWorkspace(DAVE, token)).body).toMatchObject({
			eligible: false,
			reason: "NOT_INVITEE",
		});
		expect((await previewWorkspace(OWNER, token)).body.reason).toBe(
			"ALREADY_MEMBER",
		);
	});

	it("answers 404 INVITE_NOT_FOUND for unknown tokens and 400 for malformed ones", async () => {
		expect((await previewWorkspace(BOB, "a".repeat(43))).status).toBe(404);
		expect((await previewWorkspace(BOB, "short")).status).toBe(400);
	});

	it("answers 410 INVITE_EXPIRED past the expiry", async () => {
		const id = await createWorkspace(OWNER);
		const token = await inviteTokenTo(OWNER, id, "bob");
		await WorkspaceMemberModel.updateOne(
			{ userId: BOB },
			{ $set: { expiresAt: new Date(Date.now() - 1000) } },
		);
		const res = await acceptWorkspace(BOB, token);
		expect(res.status).toBe(410);
		expect(res.body.error.code).toBe("INVITE_EXPIRED");
	});
});

describe("POST /workspace-invites/accept", () => {
	it("makes the invited account a member with the invited role, idempotently", async () => {
		const id = await createWorkspace(OWNER);
		const token = await inviteTokenTo(OWNER, id, "bob", "viewer");
		expect((await acceptWorkspace(DAVE, token)).body.error.code).toBe(
			"NOT_INVITEE",
		);
		const res = await acceptWorkspace(BOB, token);
		expect(res.body).toEqual({ workspaceId: id, alreadyMember: false });
		expect((await as(BOB).get(workspacePath(id))).body.role).toBe("viewer");
		expect((await acceptWorkspace(BOB, token)).body).toEqual({
			workspaceId: id,
			alreadyMember: true,
		});
	});

	it("admits an email invitation only to an account whose IdP verified that email", async () => {
		const id = await createWorkspace(OWNER);
		const token = await inviteTokenTo(OWNER, id, "late@example.com");
		await UserModel.create([
			{
				sub: "acc_fake",
				username: "fake",
				email: "late@example.com",
				emailVerified: false,
			},
			{
				sub: "acc_late",
				username: "late",
				email: "Late@Example.com",
				emailVerified: true,
			},
		]);
		expect((await previewWorkspace("acc_fake", token)).body).toMatchObject({
			kind: "email",
			inviteeEmail: "la***@ex***.com",
			reason: "EMAIL_NOT_VERIFIED",
		});
		const fake = await acceptWorkspace("acc_fake", token);
		expect(fake.status).toBe(403);
		expect(fake.body.error.code).toBe("EMAIL_NOT_VERIFIED");
		expect((await acceptWorkspace(BOB, token)).body.error.code).toBe(
			"NOT_INVITEE",
		);
		expect((await acceptWorkspace("acc_late", token)).status).toBe(200);
		const row = await WorkspaceMemberModel.findOne({
			userId: "acc_late",
		}).lean();
		expect(row).toMatchObject({ status: "accepted", role: "editor" });
		expect(row?.email).toBeUndefined();
	});

	it("uses a link once: the first signed-in person joins, the next gets 410 INVITE_USED", async () => {
		const id = await createWorkspace(OWNER);
		const token = await linkToken(id, "editor");
		expect((await acceptWorkspace(ERIN, token)).body).toEqual({
			workspaceId: id,
			alreadyMember: false,
		});
		expect((await as(ERIN).get(workspacePath(id))).body.role).toBe("editor");
		const late = await acceptWorkspace(DAVE, token);
		expect(late.status).toBe(410);
		expect(late.body.error.code).toBe("INVITE_USED");
		expect((await acceptWorkspace(ERIN, token)).body.alreadyMember).toBe(true);
	});

	it("drops the caller's other pending invitations when one is accepted", async () => {
		const id = await createWorkspace(OWNER);
		await inviteTokenTo(OWNER, id, "bob");
		const token = await linkToken(id);
		await acceptWorkspace(BOB, token);
		const rows = await WorkspaceMemberModel.find({ workspaceId: id }).lean();
		expect(rows.map((row) => row.status).sort()).toEqual([
			"accepted",
			"accepted",
		]);
	});

	it("rechecks seats against the owner's plan in force", async () => {
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "pro" } });
		const id = await createWorkspace(OWNER);
		const token = await inviteTokenTo(OWNER, id, "bob");
		await inviteTokenTo(OWNER, id, "dave");
		await inviteTokenTo(OWNER, id, "x@example.com");
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "free" } });
		expect((await previewWorkspace(BOB, token)).body.reason).toBe(
			"MEMBER_LIMIT",
		);
		const res = await acceptWorkspace(BOB, token);
		expect(res.status).toBe(403);
		expect(res.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "members", max: 3, used: 4 },
		});
	});

	it("answers 404 INVITE_NOT_FOUND once the workspace is deleted", async () => {
		const id = await createWorkspace(OWNER);
		const token = await inviteTokenTo(OWNER, id, "bob");
		await as(OWNER).send("delete", workspacePath(id));
		const res = await acceptWorkspace(BOB, token);
		expect(res.status).toBe(404);
		expect(res.body.error.code).toBe("INVITE_NOT_FOUND");
	});
});
