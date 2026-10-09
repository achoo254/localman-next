import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { CollaboratorModel } from "./collaborator-model.js";
import { hashInviteToken } from "./invite-token.js";
import {
	BOB,
	CAROL,
	OWNER,
	addMember,
	collaboratorsPath,
	createProject,
	invite,
	inviteToken,
	preview,
	tokenOf,
	useCollaboratorTestDb,
} from "./testing/collaborator-fixture.js";

useCollaboratorTestDb();

describe("POST /projects/:projectId/collaborators", () => {
	it("binds a username to its account and returns the link once, storing only its hash", async () => {
		const projectId = await createProject(OWNER);
		const res = await invite(OWNER, projectId, "@Bob");
		expect(res.status).toBe(201);
		expect(res.body.notified).toBe(true);
		expect(res.body.invitee).toEqual({
			username: "bob",
			name: "Bob",
			picture: null,
			maskedEmail: "Bo***@Ex***.com",
			emailVerified: true,
		});
		expect(res.body.collaborator).toMatchObject({
			status: "pending",
			inviteeEmail: null,
			user: { sub: BOB, username: "bob", emailVerified: true },
		});
		const token = tokenOf(res.body.inviteLink);
		expect(token.length).toBeGreaterThanOrEqual(43);
		const row = await CollaboratorModel.findOne({ projectId }).lean();
		expect(row?.inviteTokenHash).toBe(hashInviteToken(token));
		expect(JSON.stringify(row)).not.toContain(token);
		const days = (row?.expiresAt?.getTime() ?? 0) - Date.now();
		expect(Math.round(days / 86_400_000)).toBe(7);
	});

	it("binds an email to the account using it and flags an unverified one", async () => {
		const projectId = await createProject(OWNER);
		const verified = await invite(OWNER, projectId, "BOB@example.com");
		expect(verified.status).toBe(201);
		expect(verified.body.collaborator.user.sub).toBe(BOB);
		expect(verified.body.collaborator.inviteeEmail).toBe("bob@example.com");
		const unverified = await invite(OWNER, projectId, "carol@example.com");
		expect(unverified.status).toBe(201);
		expect(unverified.body.invitee.emailVerified).toBe(false);
		expect(unverified.body.collaborator.user.sub).toBe(CAROL);
	});

	it("addresses an email nobody uses to that email, without notification", async () => {
		const projectId = await createProject(OWNER);
		const res = await invite(OWNER, projectId, "New.Person@Example.com");
		expect(res.status).toBe(201);
		expect(res.body).toMatchObject({ invitee: null, notified: false });
		expect(res.body.collaborator).toMatchObject({
			inviteeEmail: "new.person@example.com",
			user: null,
		});
	});

	it("refuses unknown usernames, malformed emails, the owner and members with clear codes", async () => {
		const projectId = await createProject(OWNER);
		const unknown = await invite(OWNER, projectId, "nobody");
		expect(unknown.status).toBe(404);
		expect(unknown.body.error.code).toBe("INVITEE_NOT_FOUND");
		const malformed = await invite(OWNER, projectId, "a@b");
		expect(malformed.body.error.code).toBe("VALIDATION_ERROR");
		const self = await invite(OWNER, projectId, "owner@example.com");
		expect(self.status).toBe(400);
		expect(self.body.error.code).toBe("CANNOT_INVITE_SELF");
		expect(self.body).not.toHaveProperty("invitee");
		await addMember(OWNER, projectId, BOB, "bob");
		const member = await invite(OWNER, projectId, "bob@example.com");
		expect(member.status).toBe(409);
		expect(member.body.error.code).toBe("ALREADY_MEMBER");
		expect(member.body).not.toHaveProperty("invitee");
	});

	it("re-issues a pending invitation: same seat, new link, old link dead", async () => {
		const projectId = await createProject(OWNER);
		const first = await inviteToken(OWNER, projectId, "bob");
		const second = await inviteToken(OWNER, projectId, "bob@example.com");
		expect(second).not.toBe(first);
		expect(await CollaboratorModel.countDocuments({ projectId })).toBe(1);
		expect((await preview(BOB, first)).body.error.code).toBe(
			"INVITE_NOT_FOUND",
		);
		expect((await preview(BOB, second)).body.eligible).toBe(true);
	});

	it("lets a Free owner fill 3 seats with pending invitations, then answers 403 PLAN_LIMIT_REACHED", async () => {
		const projectId = await createProject(OWNER);
		expect((await invite(OWNER, projectId, "bob")).status).toBe(201);
		expect((await invite(OWNER, projectId, "x@example.com")).status).toBe(201);
		const fourth = await invite(OWNER, projectId, "dave");
		expect(fourth.status).toBe(403);
		expect(fourth.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "members", max: 3, used: 3 },
		});
	});

	it("frees the seat of an expired invitation and lists it as expired", async () => {
		const projectId = await createProject(OWNER);
		await inviteToken(OWNER, projectId, "bob");
		await inviteToken(OWNER, projectId, "x@example.com");
		await CollaboratorModel.updateOne(
			{ inviteeUserId: BOB },
			{ $set: { expiresAt: new Date(Date.now() - 1000) } },
		);
		expect((await invite(OWNER, projectId, "dave")).status).toBe(201);
		const list = await as(OWNER).get(collaboratorsPath(projectId));
		expect(list.body.seats).toEqual({ used: 3, max: 3 });
		const statuses = list.body.items.map(
			(item: { status: string }) => item.status,
		);
		expect(statuses).toEqual(["expired", "pending", "pending"]);
	});

	it("applies the owner's Pro plan of 10 seats", async () => {
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "pro" } });
		const projectId = await createProject(OWNER);
		for (let i = 1; i <= 9; i += 1) {
			expect((await invite(OWNER, projectId, `p${i}@example.com`)).status).toBe(
				201,
			);
		}
		const eleventh = await invite(OWNER, projectId, "p10@example.com");
		expect(eleventh.body.error.details).toEqual({
			limit: "members",
			max: 10,
			used: 10,
		});
	});

	it("never passes the limit when two invitations race for the last seat", async () => {
		const projectId = await createProject(OWNER);
		await inviteToken(OWNER, projectId, "bob");
		const results = await Promise.all([
			invite(OWNER, projectId, "dave"),
			invite(OWNER, projectId, "y@example.com"),
		]);
		const statuses = results.map((res) => res.status).sort();
		expect(statuses).toEqual([201, 403]);
		expect(await CollaboratorModel.countDocuments({ projectId })).toBe(2);
	});
});
