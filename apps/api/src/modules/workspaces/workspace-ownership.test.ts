import { LIMITS } from "@localman/shared";
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
import {
	addWorkspaceMember,
	createWorkspace,
	workspacePath,
} from "./testing/workspace-fixture.js";
import { WorkspaceModel } from "./workspace-model.js";

useCollaboratorTestDb();

describe("ownership hand-over", () => {
	it("gives the workspace to the oldest Admin, who keeps every member and can create more", async () => {
		await createWorkspace(BOB, "Bob's own");
		const id = await createWorkspace(OWNER, "Shared");
		await addWorkspaceMember(OWNER, id, BOB, "bob", "admin");
		await addWorkspaceMember(OWNER, id, DAVE, "dave", "editor");
		await addWorkspaceMember(OWNER, id, ERIN, "erin", "viewer");
		await addWorkspaceMember(OWNER, id, CAROL, "carol", "viewer");

		const left = await as(OWNER).send("post", workspacePath(id, "/leave"));
		expect(left.status).toBe(200);
		expect((await WorkspaceModel.findById(id).lean())?.ownerId).toBe(BOB);

		const members = await as(BOB).get(workspacePath(id, "/members"));
		expect(members.body.members).toHaveLength(4);
		expect(members.body.seats).toEqual({
			used: 4,
			max: LIMITS.membersPerWorkspace,
		});
		const create = await as(BOB).send("post", "/workspaces", { name: "Third" });
		expect(create.status).toBe(201);
	});
});
