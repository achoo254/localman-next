import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { startClearOfRateWindowEdge } from "../../test-support/rate-window-edge.js";
import { UserModel } from "../users/user-model.js";
import {
	BOB,
	OWNER,
	addMember,
	collaboratorsPath,
	createProject,
	invite,
	useCollaboratorTestDb,
} from "./testing/collaborator-fixture.js";

useCollaboratorTestDb(() => ({
	inviteRateLimit: { max: 5, windowMs: 60 * 60_000 },
}));

const lookup = (sub: string, projectId: string, usernameOrEmail: string) =>
	as(sub).send("post", collaboratorsPath(projectId, "/lookup"), {
		usernameOrEmail,
	});

describe("POST /projects/:projectId/collaborators/lookup", () => {
	it("matches whole usernames and emails only, masking the account's email", async () => {
		const projectId = await createProject(OWNER);
		const byName = await lookup(OWNER, projectId, "BOB");
		expect(byName.status).toBe(200);
		expect(byName.body.match).toEqual({
			username: "bob",
			name: "Bob",
			picture: null,
			maskedEmail: "Bo***@Ex***.com",
			emailVerified: true,
		});
		expect(JSON.stringify(byName.body)).not.toContain("Bob@Example.com");
		expect((await lookup(OWNER, projectId, "bo")).body.match).toBeNull();
		expect((await lookup(OWNER, projectId, "carol@example")).status).toBe(400);
		const unverified = await lookup(OWNER, projectId, "CAROL@example.com");
		expect(unverified.body.match).toMatchObject({
			username: "carol",
			emailVerified: false,
		});
	});

	it("is owner-only and refuses the owner and members without details", async () => {
		const projectId = await createProject(OWNER);
		await addMember(OWNER, projectId, BOB, "bob");
		expect((await lookup(BOB, projectId, "dave")).status).toBe(403);
		expect((await lookup("acc_stranger", projectId, "dave")).status).toBe(404);
		const member = await lookup(OWNER, projectId, "bob");
		expect(member.status).toBe(409);
		expect(member.body).not.toHaveProperty("match");
		expect((await lookup(OWNER, projectId, "owner")).body.error.code).toBe(
			"CANNOT_INVITE_SELF",
		);
	});

	it("shares one budget with invitations per owner (429 RATE_LIMITED)", async () => {
		await startClearOfRateWindowEdge(60 * 60_000);
		const projectId = await createProject(OWNER);
		const other = await createProject(OWNER, "Other");
		expect((await lookup(OWNER, projectId, "dave")).status).toBe(200);
		expect((await lookup(OWNER, other, "nobody")).status).toBe(200);
		expect((await invite(OWNER, projectId, "dave")).status).toBe(201);
		expect((await invite(OWNER, other, "nobody")).status).toBe(404);
		expect((await lookup(OWNER, projectId, "erin")).status).toBe(200);
		const limited = await invite(OWNER, projectId, "erin");
		expect(limited.status).toBe(429);
		expect(limited.body.error.code).toBe("RATE_LIMITED");
		const lookupLimited = await lookup(OWNER, projectId, "erin");
		expect(lookupLimited.status).toBe(429);
		expect(lookupLimited.body).not.toHaveProperty("match");
		// Another owner keeps their own budget.
		const bobProject = await createProject(BOB);
		expect((await lookup(BOB, bobProject, "dave")).status).toBe(200);
	});

	it("refuses a username two accounts share instead of picking one", async () => {
		const projectId = await createProject(OWNER);
		// A stale copy of an IdP account that later took the name, in other case.
		await UserModel.create({ sub: "acc_old_dave", username: "Dave" });
		for (const send of [lookup, invite]) {
			const res = await send(OWNER, projectId, "@dave");
			expect(res.status).toBe(409);
			expect(res.body.error.code).toBe("AMBIGUOUS_USERNAME");
		}
		expect((await invite(OWNER, projectId, "dave@example.com")).status).toBe(
			201,
		);
	});
});
