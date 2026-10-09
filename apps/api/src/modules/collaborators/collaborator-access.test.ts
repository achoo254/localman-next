import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ResourceModel } from "../resources/resource-model.js";
import { UserModel } from "../users/user-model.js";
import { CollaboratorModel } from "./collaborator-model.js";
import { MagicLinkModel } from "./magic-link-model.js";
import {
	BOB,
	DAVE,
	OWNER,
	addMember,
	collaboratorsPath,
	createProject,
	invite,
	magicLinkPath,
	magicToken,
	useCollaboratorTestDb,
} from "./testing/collaborator-fixture.js";

useCollaboratorTestDb();

async function sharedProject(): Promise<string> {
	const projectId = await createProject(OWNER);
	await addMember(OWNER, projectId, BOB, "bob");
	return projectId;
}

describe("collaborator role", () => {
	it("lists the shared project with role collaborator and the member count", async () => {
		const projectId = await sharedProject();
		const list = await as(BOB).get("/projects");
		expect(list.body.items).toHaveLength(1);
		expect(list.body.items[0]).toMatchObject({
			id: projectId,
			role: "collaborator",
			memberCount: 2,
		});
		const own = await as(OWNER).get("/projects");
		expect(own.body.items[0]).toMatchObject({ role: "owner", memberCount: 2 });
	});

	it("works on resources and data but never edits, deletes or manages the project", async () => {
		const projectId = await sharedProject();
		const bob = as(BOB);
		const users = await bob.send("post", `/projects/${projectId}/resources`, {
			name: "users",
		});
		expect(users.status).toBe(201);
		const one = `/projects/${projectId}/resources/${users.body.id}`;
		expect(
			(await bob.send("post", `${one}/generate`, { count: 2 })).status,
		).toBe(200);
		expect(
			(await bob.send("put", `${one}/data`, { data: [{ a: 1 }] })).status,
		).toBe(200);
		expect(
			(await bob.send("post", `/projects/${projectId}/clone`)).status,
		).toBe(201);
		const refused = await Promise.all([
			bob.send("put", `/projects/${projectId}`, { name: "Mine", prefix: "" }),
			bob.send("delete", `/projects/${projectId}`),
			invite(BOB, projectId, "dave"),
			bob.get(magicLinkPath(projectId)),
			bob.send("post", magicLinkPath(projectId)),
			bob.send("delete", magicLinkPath(projectId)),
		]);
		expect(refused.map((res) => res.status)).toEqual([
			403, 403, 403, 403, 403, 403,
		]);
	});

	it("bills resources created by a collaborator to the owner's plan", async () => {
		const projectId = await sharedProject();
		// The collaborator's own Pro plan does not lift the owner's Free limit.
		await UserModel.updateOne({ sub: BOB }, { $set: { plan: "pro" } });
		const create = (name: string) =>
			as(BOB).send("post", `/projects/${projectId}/resources`, { name });
		const first = await create("r0");
		expect(first.status).toBe(201);
		const stored = await ResourceModel.findById(first.body.id).lean();
		expect(stored?.ownerSub).toBe(OWNER);
		for (let i = 1; i < 10; i += 1) {
			expect((await create(`r${i}`)).status).toBe(201);
		}
		const over = await create("r10");
		expect(over.status).toBe(403);
		expect(over.body.error.details).toMatchObject({
			limit: "resources",
			max: 10,
		});
	});

	it("shows a collaborator only the owner and accepted members, without emails", async () => {
		const projectId = await sharedProject();
		await invite(OWNER, projectId, "pending@example.com");
		const seen = await as(BOB).get(collaboratorsPath(projectId));
		expect(seen.status).toBe(200);
		expect(seen.body).toMatchObject({
			owner: { sub: OWNER, username: "owner" },
			seats: { used: 3, max: 3 },
			canManage: false,
		});
		expect(seen.body.items).toHaveLength(1);
		expect(seen.body.items[0]).toMatchObject({
			status: "accepted",
			inviteeEmail: null,
			user: { sub: BOB },
		});
		const owner = await as(OWNER).get(collaboratorsPath(projectId));
		expect(owner.body.canManage).toBe(true);
		expect(owner.body.items[1].inviteeEmail).toBe("pending@example.com");
	});

	it("loses access at once after leaving", async () => {
		const projectId = await sharedProject();
		const [row] = (await as(BOB).get(collaboratorsPath(projectId))).body.items;
		const path = collaboratorsPath(projectId, `/${row.id}`);
		const dry = await as(BOB).send("delete", `${path}?dryRun=true`);
		expect(dry.body).toMatchObject({ dryRun: true, removed: false });
		expect((await as(BOB).get(`/projects/${projectId}`)).status).toBe(200);
		const left = await as(BOB).send("delete", path);
		expect(left.body).toMatchObject({ dryRun: false, removed: true });
		expect((await as(BOB).get(`/projects/${projectId}`)).status).toBe(404);
		expect((await as(BOB).get("/projects")).body.items).toEqual([]);
	});

	it("lets the owner remove members, but no collaborator remove another", async () => {
		const projectId = await sharedProject();
		await addMember(OWNER, projectId, DAVE, "dave");
		const items = (await as(OWNER).get(collaboratorsPath(projectId))).body
			.items;
		const [bobRow, daveRow] = items;
		const byBob = await as(BOB).send(
			"delete",
			collaboratorsPath(projectId, `/${daveRow.id}`),
		);
		expect(byBob.status).toBe(403);
		const byOwner = await as(OWNER).send(
			"delete",
			collaboratorsPath(projectId, `/${bobRow.id}`),
		);
		expect(byOwner.status).toBe(200);
		expect((await as(BOB).get(`/projects/${projectId}`)).status).toBe(404);
		expect((await as(DAVE).get(`/projects/${projectId}`)).status).toBe(200);
	});

	it("removes members, invitations and the magic link with the project", async () => {
		const projectId = await sharedProject();
		await invite(OWNER, projectId, "x@example.com");
		await magicToken(OWNER, projectId);
		const preview = await as(OWNER).send(
			"delete",
			`/projects/${projectId}?dryRun=true`,
		);
		expect(preview.body.dependents).toEqual(
			expect.arrayContaining([
				{ kind: "collaborators", count: 2 },
				{ kind: "magicLinks", count: 1 },
			]),
		);
		expect(
			(await as(OWNER).send("delete", `/projects/${projectId}`)).status,
		).toBe(200);
		expect(await CollaboratorModel.countDocuments()).toBe(0);
		expect(await MagicLinkModel.countDocuments()).toBe(0);
	});
});
