import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	BOB,
	DAVE,
	OWNER,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { UserModel } from "../users/user-model.js";
import { ensurePersonalWorkspace } from "./personal-workspace.js";
import {
	addWorkspaceMember,
	createWorkspace,
	patchAs,
	workspacePath,
} from "./testing/workspace-fixture.js";
import { WorkspaceMemberModel } from "./workspace-member-model.js";
import { WorkspaceModel } from "./workspace-model.js";

useCollaboratorTestDb();

describe("personal workspace", () => {
	it("is created on first list, once, even when requests race", async () => {
		const results = await Promise.all(
			Array.from({ length: 5 }, () => ensurePersonalWorkspace(OWNER)),
		);
		const ids = new Set(results.map((ws) => ws._id.toHexString()));
		expect(ids.size).toBe(1);
		const res = await as(OWNER).get("/workspaces");
		expect(res.status).toBe(200);
		expect(res.body.items).toEqual([
			{
				id: [...ids][0],
				name: "My Workspace",
				description: null,
				type: "personal",
				visibility: "personal",
				role: "admin",
				memberCount: 1,
			},
		]);
		expect(await WorkspaceModel.countDocuments({ ownerId: OWNER })).toBe(1);
	});
});

describe("team workspaces", () => {
	it("creates a team workspace with its creator as Admin and lists it after the personal one", async () => {
		const res = await as(OWNER).send("post", "/workspaces", {
			name: " Backend ",
			description: "APIs",
		});
		expect(res.status).toBe(201);
		expect(res.body).toMatchObject({
			name: "Backend",
			description: "APIs",
			type: "team",
			visibility: "team",
			role: "admin",
			memberCount: 1,
		});
		await addWorkspaceMember(OWNER, res.body.id, BOB, "bob", "viewer");
		const bobList = await as(BOB).get("/workspaces");
		expect(
			bobList.body.items.map((w: { type: string; role: string }) => [
				w.type,
				w.role,
			]),
		).toEqual([
			["personal", "admin"],
			["team", "viewer"],
		]);
		expect(bobList.body.items[1].memberCount).toBe(2);
	});

	it("allows a Free user one team workspace, then answers 403 PLAN_LIMIT_REACHED", async () => {
		await createWorkspace(OWNER);
		const second = await as(OWNER).send("post", "/workspaces", { name: "B" });
		expect(second.status).toBe(403);
		expect(second.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "teamWorkspaces", max: 1, used: 1 },
		});
		// Being a member of someone else's workspace does not count.
		await createWorkspace(BOB);
		expect((await as(BOB).get("/workspaces")).body.items).toHaveLength(2);
	});

	it("lets a Pro user create many team workspaces", async () => {
		await UserModel.updateOne({ sub: OWNER }, { $set: { plan: "pro" } });
		for (let i = 0; i < 4; i += 1) await createWorkspace(OWNER, `T${i}`);
		expect((await as(OWNER).get("/workspaces")).body.items).toHaveLength(5);
	});

	it("never passes the Free limit when two creations race", async () => {
		const results = await Promise.all([
			as(OWNER).send("post", "/workspaces", { name: "A" }),
			as(OWNER).send("post", "/workspaces", { name: "B" }),
		]);
		expect(results.map((res) => res.status).sort()).toEqual([201, 403]);
		expect(
			await WorkspaceModel.countDocuments({ ownerId: OWNER, type: "team" }),
		).toBe(1);
	});

	it("answers 400 for an empty name", async () => {
		const res = await as(OWNER).send("post", "/workspaces", { name: "  " });
		expect(res.status).toBe(400);
	});
});

describe("GET and PATCH /workspaces/:workspaceId", () => {
	it("shows the workspace to members only, 404 to anyone else", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "viewer");
		const bob = await as(BOB).get(workspacePath(id));
		expect(bob.status).toBe(200);
		expect(bob.body).toMatchObject({ id, role: "viewer", memberCount: 2 });
		const dave = await as(DAVE).get(workspacePath(id));
		expect(dave.status).toBe(404);
		expect(dave.body.error.code).toBe("NOT_FOUND");
		expect((await as(OWNER).get(workspacePath("nope"))).status).toBe(404);
	});

	it("lets Admins edit the details, clears the description, and refuses editors with 403", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "editor");
		const edited = await patchAs(OWNER, workspacePath(id), {
			name: "Renamed",
			description: "Docs",
		});
		expect(edited.status).toBe(200);
		expect(edited.body).toMatchObject({ name: "Renamed", description: "Docs" });
		const cleared = await patchAs(OWNER, workspacePath(id), {
			description: null,
		});
		expect(cleared.body).toMatchObject({ name: "Renamed", description: null });
		const editor = await patchAs(BOB, workspacePath(id), { name: "Mine" });
		expect(editor.status).toBe(403);
		expect((await patchAs(DAVE, workspacePath(id), { name: "x" })).status).toBe(
			404,
		);
	});
});

describe("DELETE /workspaces/:workspaceId", () => {
	it("previews with dryRun, then deletes the workspace with its member rows", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob");
		const preview = await as(OWNER).send(
			"delete",
			`${workspacePath(id)}?dryRun=true`,
		);
		expect(preview.status).toBe(200);
		expect(preview.body).toMatchObject({
			dryRun: true,
			deleted: false,
			members: 2,
			workspace: { id },
		});
		expect(await WorkspaceModel.exists({ _id: id })).not.toBeNull();
		const res = await as(OWNER).send("delete", workspacePath(id));
		expect(res.body).toMatchObject({ dryRun: false, deleted: true });
		expect(await WorkspaceModel.exists({ _id: id })).toBeNull();
		expect(await WorkspaceMemberModel.countDocuments({ workspaceId: id })).toBe(
			0,
		);
		expect((await as(BOB).get(workspacePath(id))).status).toBe(404);
		// The deleted workspace frees the Free plan's team workspace.
		await createWorkspace(OWNER, "Again");
	});

	it("refuses editors (403), non-members (404) and the personal workspace (409)", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "editor");
		expect((await as(BOB).send("delete", workspacePath(id))).status).toBe(403);
		expect((await as(DAVE).send("delete", workspacePath(id))).status).toBe(404);
		const personal = await ensurePersonalWorkspace(OWNER);
		const res = await as(OWNER).send(
			"delete",
			workspacePath(personal._id.toHexString()),
		);
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("PERSONAL_WORKSPACE");
	});
});
