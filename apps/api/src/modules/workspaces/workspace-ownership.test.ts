import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	BOB,
	CAROL,
	DAVE,
	ERIN,
	OWNER,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { UserModel } from "../users/user-model.js";
import {
	addWorkspaceMember,
	createWorkspace,
	inviteTo,
	workspacePath,
} from "./testing/workspace-fixture.js";
import { WorkspaceModel } from "./workspace-model.js";

useCollaboratorTestDb();

describe("ownership hand-over past the heir's plan", () => {
	it("gives the workspace to an heir at their team workspace limit, who then cannot create more", async () => {
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "pro" } });
		await createWorkspace(BOB, "Bob's own");
		const id = await createWorkspace(OWNER, "Shared");
		await addWorkspaceMember(OWNER, id, BOB, "bob", "admin");
		await addWorkspaceMember(OWNER, id, DAVE, "dave", "editor");
		await addWorkspaceMember(OWNER, id, ERIN, "erin", "viewer");
		await addWorkspaceMember(OWNER, id, CAROL, "carol", "viewer");

		const left = await as(OWNER).send("post", workspacePath(id, "/leave"));
		expect(left.status).toBe(200);
		expect((await WorkspaceModel.findById(id).lean())?.ownerId).toBe(BOB);

		// Bob (Free) now owns two team workspaces: he keeps both, creates none.
		const create = await as(BOB).send("post", "/workspaces", { name: "Third" });
		expect(create.status).toBe(403);
		expect(create.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "teamWorkspaces", max: 1, used: 2 },
		});

		// Bob's Free plan bounds the seats now: the 4 members stay, none join.
		const members = await as(BOB).get(workspacePath(id, "/members"));
		expect(members.body.members).toHaveLength(4);
		expect(members.body.seats).toEqual({ used: 4, max: 3 });
		const invite = await inviteTo(BOB, id, "someone@example.com");
		expect(invite.status).toBe(403);
		expect(invite.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "members", max: 3, used: 4 },
		});
	});
});
