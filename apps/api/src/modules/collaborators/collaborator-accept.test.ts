import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { startClearOfRateWindowEdge } from "../../test-support/rate-window-edge.js";
import { ProjectModel } from "../projects/project-model.js";
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
	inviteToken,
	preview,
	useCollaboratorTestDb,
} from "./testing/collaborator-fixture.js";

useCollaboratorTestDb();

describe("invite links", () => {
	it("invite, accept, then work on the project as a collaborator", async () => {
		const projectId = await createProject(OWNER);
		const token = await inviteToken(OWNER, projectId, "bob");
		const shown = await preview(BOB, token);
		expect(shown.status).toBe(200);
		expect(shown.body).toMatchObject({
			kind: "invite",
			project: { id: projectId, name: "Demo" },
			inviter: { username: "owner", name: "Owner" },
			inviteeEmail: null,
			eligible: true,
			reason: null,
		});
		expect(shown.body.project).not.toHaveProperty("secret");
		expect(
			await as(BOB)
				.get(`/projects/${projectId}`)
				.then((r) => r.status),
		).toBe(404);
		const res = await accept(BOB, token);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ projectId, alreadyMember: false });
		const project = await as(BOB).get(`/projects/${projectId}`);
		expect(project.body).toMatchObject({
			role: "collaborator",
			memberCount: 2,
		});
		const created = await as(BOB).send(
			"post",
			`/projects/${projectId}/resources`,
			{
				name: "users",
			},
		);
		expect(created.status).toBe(201);
	});

	it("refuses an unverified email that only reads like the invited one (403)", async () => {
		const projectId = await createProject(OWNER);
		// Sent before CAROL's account had this email: addressed to the email.
		await UserModel.updateOne({ sub: CAROL }, { $unset: { email: 1 } });
		const token = await inviteToken(OWNER, projectId, "carol@example.com");
		await UserModel.updateOne(
			{ sub: CAROL },
			{ $set: { email: "Carol@Example.com", emailVerified: false } },
		);
		const shown = await preview(CAROL, token);
		expect(shown.body).toMatchObject({
			eligible: false,
			reason: "EMAIL_NOT_VERIFIED",
			inviteeEmail: "ca***@ex***.com",
		});
		const res = await accept(CAROL, token);
		expect(res.status).toBe(403);
		expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
		expect(
			await as(CAROL)
				.get(`/projects/${projectId}`)
				.then((r) => r.status),
		).toBe(404);
	});

	it("admits an account whose IdP-verified email matches an email invitation", async () => {
		const projectId = await createProject(OWNER);
		await UserModel.updateOne({ sub: DAVE }, { $unset: { email: 1 } });
		const token = await inviteToken(OWNER, projectId, "dave@example.com");
		await UserModel.updateOne(
			{ sub: DAVE },
			{ $set: { email: "DAVE@example.com", emailVerified: true } },
		);
		expect((await accept(DAVE, token)).status).toBe(200);
	});

	it("refuses other accounts (403 NOT_INVITEE)", async () => {
		const projectId = await createProject(OWNER);
		const bound = await inviteToken(OWNER, projectId, "bob");
		const byEmail = await inviteToken(OWNER, projectId, "z@example.com");
		for (const token of [bound, byEmail]) {
			expect((await preview(ERIN, token)).body.reason).toBe("NOT_INVITEE");
			const res = await accept(ERIN, token);
			expect(res.status).toBe(403);
			expect(res.body.error.code).toBe("NOT_INVITEE");
		}
	});

	it("rejects a used link for others and leads the member back to the project", async () => {
		const projectId = await createProject(OWNER);
		const token = await inviteToken(OWNER, projectId, "bob");
		expect((await accept(BOB, token)).status).toBe(200);
		const again = await accept(BOB, token);
		expect(again.body).toEqual({ projectId, alreadyMember: true });
		expect((await preview(BOB, token)).body.reason).toBe("ALREADY_MEMBER");
		const other = await accept(ERIN, token);
		expect(other.status).toBe(410);
		expect(other.body.error.code).toBe("INVITE_USED");
		expect((await accept(OWNER, token)).body.alreadyMember).toBe(true);
	});

	it("rejects expired, unknown and deleted-project links with distinct codes", async () => {
		const projectId = await createProject(OWNER);
		const token = await inviteToken(OWNER, projectId, "bob");
		const expiresAt = new Date(Date.now() - 1000);
		await CollaboratorModel.updateOne({}, { $set: { expiresAt } });
		const expired = await accept(BOB, token);
		expect(expired.status).toBe(410);
		expect(expired.body.error).toMatchObject({
			code: "INVITE_EXPIRED",
			details: { expiresAt: expiresAt.toISOString() },
		});
		expect((await preview(BOB, token)).body.error.code).toBe("INVITE_EXPIRED");
		const unknown = await accept(BOB, "A".repeat(43));
		expect(unknown.status).toBe(404);
		expect(unknown.body.error.code).toBe("INVITE_NOT_FOUND");
		const fresh = await inviteToken(OWNER, projectId, "dave");
		await ProjectModel.updateOne(
			{ _id: projectId },
			{ $set: { deletingAt: new Date() } },
		);
		expect((await accept(DAVE, fresh)).body.error.code).toBe(
			"INVITE_NOT_FOUND",
		);
		expect(
			(await as(BOB).send("post", "/invites/accept", { token: "../x" })).status,
		).toBe(400);
	});

	it("re-checks the owner's plan at accept time (owner downgraded meanwhile)", async () => {
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "pro" } });
		const projectId = await createProject(OWNER);
		await addMember(OWNER, projectId, BOB, "bob");
		await addMember(OWNER, projectId, DAVE, "dave");
		const token = await inviteToken(OWNER, projectId, "erin");
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "free" } });
		expect((await preview(ERIN, token)).body.reason).toBe("MEMBER_LIMIT");
		const res = await accept(ERIN, token);
		expect(res.status).toBe(403);
		expect(res.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "members", max: 3, used: 4 },
		});
	});

	it("requires sign-in and rate-limits token checks per account", async () => {
		await startClearOfRateWindowEdge(10 * 60_000, 10_000);
		const res = await as(BOB)
			.send("post", "/invites/preview", { token: "B".repeat(43) })
			.unset("x-test-sub");
		expect(res.status).toBe(401);
		const codes: string[] = [];
		for (let i = 0; i < 31; i += 1) {
			codes.push((await preview(BOB, "C".repeat(43))).body.error.code);
		}
		expect(
			codes.slice(0, 30).every((code) => code === "INVITE_NOT_FOUND"),
		).toBe(true);
		expect(codes[30]).toBe("RATE_LIMITED");
	});
});
