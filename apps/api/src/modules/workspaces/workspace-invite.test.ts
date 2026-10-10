import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { hashInviteToken } from "../collaborators/invite-token.js";
import {
	BOB,
	DAVE,
	OWNER,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { NotificationModel } from "../notifications/notification-model.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import { UserModel } from "../users/user-model.js";
import { ensurePersonalWorkspace } from "./personal-workspace.js";
import {
	addWorkspaceMember,
	createLink,
	createWorkspace,
	inviteTo,
	inviteTokenTo,
	previewWorkspace,
	workspacePath,
	workspaceTokenOf,
} from "./testing/workspace-fixture.js";
import { WorkspaceMemberModel } from "./workspace-member-model.js";

useCollaboratorTestDb();

describe("POST /workspaces/:workspaceId/invitations", () => {
	it("binds a username, notifies the account and returns the link once, storing only its hash", async () => {
		const id = await createWorkspace(OWNER, "Backend");
		const res = await inviteTo(OWNER, id, "@bob", "viewer");
		expect(res.status).toBe(201);
		expect(res.body.notified).toBe(true);
		expect(res.body.invitation).toMatchObject({
			kind: "account",
			username: "bob",
			email: null,
			role: "viewer",
			expired: false,
			emailVerified: true,
		});
		const token = workspaceTokenOf(res.body.inviteLink);
		const row = await WorkspaceMemberModel.findOne({
			status: "pending",
		}).lean();
		expect(row?.inviteTokenHash).toBe(hashInviteToken(token));
		expect(JSON.stringify(row)).not.toContain(token);
		await getNotificationService().drain();
		const [stored] = await NotificationModel.find({ userSub: BOB }).lean();
		expect(stored).toMatchObject({
			type: "workspace.invitation",
			link: res.body.inviteLink,
			params: {
				inviter: "Owner",
				workspace: "Backend",
				role: "viewer",
				days: 7,
			},
		});
	});

	it("addresses an email nobody uses to that email, without notification", async () => {
		const id = await createWorkspace(OWNER);
		const res = await inviteTo(OWNER, id, "New@Example.com");
		expect(res.status).toBe(201);
		expect(res.body.notified).toBe(false);
		expect(res.body.invitation).toMatchObject({
			kind: "email",
			email: "new@example.com",
			username: null,
			emailVerified: null,
		});
	});

	it("refuses unknown usernames, the caller and members with clear codes", async () => {
		const id = await createWorkspace(OWNER);
		expect((await inviteTo(OWNER, id, "nobody")).body.error.code).toBe(
			"INVITEE_NOT_FOUND",
		);
		const self = await inviteTo(OWNER, id, "owner");
		expect(self.status).toBe(400);
		expect(self.body.error.code).toBe("CANNOT_INVITE_SELF");
		await addWorkspaceMember(OWNER, id, BOB, "bob");
		const member = await inviteTo(OWNER, id, "bob@example.com");
		expect(member.status).toBe(409);
		expect(member.body.error.code).toBe("ALREADY_MEMBER");
		expect((await inviteTo(OWNER, id, "x", "owner")).status).toBe(400);
	});

	it("re-issues a pending invitation with the new role: same seat, old link dead", async () => {
		const id = await createWorkspace(OWNER);
		const first = await inviteTokenTo(OWNER, id, "bob", "viewer");
		const second = await inviteTokenTo(OWNER, id, "bob@example.com", "editor");
		expect(
			await WorkspaceMemberModel.countDocuments({ status: "pending" }),
		).toBe(1);
		expect((await previewWorkspace(BOB, first)).body.error.code).toBe(
			"INVITE_NOT_FOUND",
		);
		expect((await previewWorkspace(BOB, second)).body).toMatchObject({
			role: "editor",
			eligible: true,
		});
	});

	it("gives a Free owner 3 seats (creator included), then answers 403 PLAN_LIMIT_REACHED", async () => {
		const id = await createWorkspace(OWNER);
		expect((await inviteTo(OWNER, id, "bob")).status).toBe(201);
		expect((await createLink(OWNER, id)).status).toBe(201);
		const fourth = await inviteTo(OWNER, id, "dave");
		expect(fourth.status).toBe(403);
		expect(fourth.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "members", max: 3, used: 3 },
		});
		expect((await createLink(OWNER, id)).status).toBe(403);
	});

	it("frees the seat of an expired invitation", async () => {
		const id = await createWorkspace(OWNER);
		await inviteTokenTo(OWNER, id, "bob");
		await inviteTokenTo(OWNER, id, "x@example.com");
		await WorkspaceMemberModel.updateOne(
			{ userId: BOB },
			{ $set: { expiresAt: new Date(Date.now() - 1000) } },
		);
		expect((await inviteTo(OWNER, id, "dave")).status).toBe(201);
	});

	it("applies the owner's Pro plan of 10 seats, whoever invites", async () => {
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "pro" } });
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "admin");
		for (let i = 1; i <= 8; i += 1) {
			expect((await inviteTo(BOB, id, `p${i}@example.com`)).status).toBe(201);
		}
		const eleventh = await inviteTo(BOB, id, "p9@example.com");
		expect(eleventh.body.error.details).toEqual({
			limit: "members",
			max: 10,
			used: 10,
		});
	});

	it("never passes the limit when two invitations race for the last seat", async () => {
		const id = await createWorkspace(OWNER);
		await inviteTokenTo(OWNER, id, "bob");
		const results = await Promise.all([
			inviteTo(OWNER, id, "dave"),
			createLink(OWNER, id),
		]);
		expect(results.map((res) => res.status).sort()).toEqual([201, 403]);
		expect(await WorkspaceMemberModel.countDocuments({ workspaceId: id })).toBe(
			3,
		);
	});

	it("is for Admins only: 403 for editors and viewers, 404 for non-members, 409 on a personal workspace", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "editor");
		expect((await inviteTo(BOB, id, "dave")).status).toBe(403);
		expect((await createLink(BOB, id)).status).toBe(403);
		expect((await inviteTo(DAVE, id, "bob")).status).toBe(404);
		const personal = (await ensurePersonalWorkspace(OWNER))._id.toHexString();
		const res = await inviteTo(OWNER, personal, "bob");
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("PERSONAL_WORKSPACE");
		expect((await createLink(OWNER, personal)).status).toBe(409);
	});
});

describe("invite links and revocation", () => {
	it("creates a one-use link without an addressee", async () => {
		const id = await createWorkspace(OWNER);
		const res = await createLink(OWNER, id, "editor");
		expect(res.status).toBe(201);
		expect(res.body).toMatchObject({
			notified: false,
			invitation: { kind: "link", username: null, email: null, role: "editor" },
		});
		expect(res.body.inviteLink).toMatch(/^\/workspace-invite\/[\w-]{43}$/);
	});

	it("revokes an invitation (dryRun first): its link dies and its seat is freed", async () => {
		const id = await createWorkspace(OWNER);
		const res = await createLink(OWNER, id);
		const token = workspaceTokenOf(res.body.inviteLink);
		const path = workspacePath(id, `/invitations/${res.body.invitation.id}`);
		const dry = await as(OWNER).send("delete", `${path}?dryRun=true`);
		expect(dry.body).toMatchObject({ dryRun: true, revoked: false });
		expect((await previewWorkspace(BOB, token)).body.eligible).toBe(true);
		expect((await as(DAVE).send("delete", path)).status).toBe(404);
		const done = await as(OWNER).send("delete", path);
		expect(done.body).toMatchObject({ dryRun: false, revoked: true });
		expect((await previewWorkspace(BOB, token)).status).toBe(404);
		expect((await as(OWNER).send("delete", path)).status).toBe(404);
		const list = await as(OWNER).get(workspacePath(id, "/members"));
		expect(list.body.seats).toEqual({ used: 1, max: 3 });
	});
});
