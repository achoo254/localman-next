import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	BOB,
	DAVE,
	OWNER,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { ensurePersonalWorkspace } from "./personal-workspace.js";
import {
	addWorkspaceMember,
	createLink,
	createWorkspace,
	inviteTo,
	memberIdOf,
	patchAs,
	workspacePath,
} from "./testing/workspace-fixture.js";
import { WorkspaceModel } from "./workspace-model.js";

useCollaboratorTestDb();

const membersPath = (id: string, suffix = ""): string =>
	workspacePath(id, `/members${suffix}`);

describe("GET /workspaces/:workspaceId/members", () => {
	it("lists members and seats to everyone, pending invitations to Admins only", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "viewer");
		await inviteTo(OWNER, id, "dave");
		const admin = await as(OWNER).get(membersPath(id));
		expect(admin.status).toBe(200);
		expect(admin.body.members).toEqual([
			expect.objectContaining({ userId: OWNER, role: "admin", isYou: true }),
			expect.objectContaining({
				userId: BOB,
				username: "bob",
				name: "Bob",
				role: "viewer",
				isYou: false,
			}),
		]);
		expect(admin.body.invitations).toEqual([
			expect.objectContaining({ kind: "account", username: "dave" }),
		]);
		expect(admin.body.seats).toEqual({ used: 3, max: 3 });
		const viewer = await as(BOB).get(membersPath(id));
		expect(viewer.body.members).toHaveLength(2);
		expect(viewer.body.invitations).toEqual([]);
		expect((await as(DAVE).get(membersPath(id))).status).toBe(404);
	});

	it("answers an empty list without seats for a personal workspace", async () => {
		const personal = (await ensurePersonalWorkspace(OWNER))._id.toHexString();
		const res = await as(OWNER).get(membersPath(personal));
		expect(res.body).toEqual({ members: [], invitations: [], seats: null });
	});
});

describe("PATCH /workspaces/:workspaceId/members/:memberId", () => {
	it("lets Admins change roles and refuses to demote the last Admin", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "viewer");
		const bobId = await memberIdOf(OWNER, id, BOB);
		const ownerId = await memberIdOf(OWNER, id, OWNER);
		const lone = await patchAs(OWNER, membersPath(id, `/${ownerId}`), {
			role: "editor",
		});
		expect(lone.status).toBe(409);
		expect(lone.body.error.code).toBe("LAST_ADMIN");
		const promoted = await patchAs(OWNER, membersPath(id, `/${bobId}`), {
			role: "admin",
		});
		expect(promoted.status).toBe(200);
		expect(promoted.body.member).toMatchObject({ userId: BOB, role: "admin" });
		const demoted = await patchAs(BOB, membersPath(id, `/${ownerId}`), {
			role: "viewer",
		});
		expect(demoted.body.member).toMatchObject({
			userId: OWNER,
			role: "viewer",
		});
		expect((await as(OWNER).get(workspacePath(id))).body.role).toBe("viewer");
	});

	it("refuses editors and viewers (403), non-members (404) and unknown members (404)", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "editor");
		const ownerId = await memberIdOf(OWNER, id, OWNER);
		const path = membersPath(id, `/${ownerId}`);
		expect((await patchAs(BOB, path, { role: "viewer" })).status).toBe(403);
		expect((await patchAs(DAVE, path, { role: "viewer" })).status).toBe(404);
		const unknown = await patchAs(
			OWNER,
			membersPath(id, `/${"0".repeat(24)}`),
			{
				role: "viewer",
			},
		);
		expect(unknown.status).toBe(404);
		expect((await patchAs(OWNER, path, { role: "owner" })).status).toBe(400);
	});
});

describe("DELETE /workspaces/:workspaceId/members/:memberId", () => {
	it("previews with dryRun, then removes the member, who loses access at once", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob");
		const path = membersPath(id, `/${await memberIdOf(OWNER, id, BOB)}`);
		const dry = await as(OWNER).send("delete", `${path}?dryRun=true`);
		expect(dry.body).toMatchObject({
			dryRun: true,
			removed: false,
			member: { userId: BOB },
		});
		expect((await as(BOB).get(workspacePath(id))).status).toBe(200);
		const res = await as(OWNER).send("delete", path);
		expect(res.body).toMatchObject({ dryRun: false, removed: true });
		expect((await as(BOB).get(workspacePath(id))).status).toBe(404);
		// The freed seat can be given again.
		expect((await createLink(OWNER, id)).status).toBe(201);
	});

	it("refuses to remove the last Admin and refuses non-Admins with 403", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "viewer");
		const ownerPath = membersPath(id, `/${await memberIdOf(OWNER, id, OWNER)}`);
		const last = await as(OWNER).send("delete", ownerPath);
		expect(last.status).toBe(409);
		expect(last.body.error.code).toBe("LAST_ADMIN");
		const dry = await as(OWNER).send("delete", `${ownerPath}?dryRun=true`);
		expect(dry.body.error.code).toBe("LAST_ADMIN");
		expect((await as(BOB).send("delete", ownerPath)).status).toBe(403);
	});
});

describe("POST /workspaces/:workspaceId/leave", () => {
	it("lets a member leave, the last Admin only after handing over", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "viewer");
		const lone = await as(OWNER).send("post", workspacePath(id, "/leave"));
		expect(lone.status).toBe(409);
		expect(lone.body.error.code).toBe("LAST_ADMIN");
		const left = await as(BOB).send("post", workspacePath(id, "/leave"));
		expect(left.body).toMatchObject({ dryRun: false, left: true });
		expect((await as(BOB).get(workspacePath(id))).status).toBe(404);
		expect(
			(await as(BOB).send("post", workspacePath(id, "/leave"))).status,
		).toBe(404);
	});

	it("refuses to leave a personal workspace", async () => {
		const personal = (await ensurePersonalWorkspace(OWNER))._id.toHexString();
		const res = await as(OWNER).send("post", workspacePath(personal, "/leave"));
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("PERSONAL_WORKSPACE");
	});

	it("never leaves the workspace without an Admin when two Admins leave at once", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "admin");
		const results = await Promise.all([
			as(OWNER).send("post", workspacePath(id, "/leave")),
			as(BOB).send("post", workspacePath(id, "/leave")),
		]);
		expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
	});

	it("hands the workspace over to the oldest remaining Admin when its owner leaves", async () => {
		const id = await createWorkspace(OWNER);
		await addWorkspaceMember(OWNER, id, BOB, "bob", "admin");
		await addWorkspaceMember(OWNER, id, DAVE, "dave", "admin");
		const left = await as(OWNER).send("post", workspacePath(id, "/leave"));
		expect(left.status).toBe(200);
		const stored = await WorkspaceModel.findById(id).lean();
		expect(stored?.ownerId).toBe(BOB);
		// The departed owner's team workspace quota is free again.
		const created = await as(OWNER).send("post", "/workspaces", {
			name: "Next",
		});
		expect(created.status).toBe(201);
	});
});
