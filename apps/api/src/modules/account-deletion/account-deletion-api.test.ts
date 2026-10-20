import request from "supertest";
import { describe, expect, it } from "vitest";
import { as, testApp } from "../../test-support/dashboard-test-app.js";
import {
	BOB,
	OWNER,
	useCollaboratorTestDb,
} from "../collaborators/testing/collaborator-fixture.js";
import { UserModel } from "../users/user-model.js";
import {
	addWorkspaceMember,
	createWorkspace,
} from "../workspaces/testing/workspace-fixture.js";
import {
	OWN_ROW_COLLECTIONS,
	countOwnRows,
	seedOwnRows,
} from "./testing/own-rows-fixture.js";

// The deleting account is the fixture's `owner` (username "owner").
useCollaboratorTestDb();

const deleteAs = (sub: string, body: object = {}, dryRun = false) =>
	as(sub).send("delete", `/users/me${dryRun ? "?dryRun=true" : ""}`, body);

const zeros = () =>
	Object.fromEntries(OWN_ROW_COLLECTIONS.map((name) => [name, 0]));
const ones = () =>
	Object.fromEntries(OWN_ROW_COLLECTIONS.map((name) => [name, 1]));

describe("DELETE /users/me (dry run)", () => {
	it("counts what goes and writes nothing", async () => {
		await as(OWNER).send("post", "/projects", { name: "Shop", prefix: "" });
		await createWorkspace(OWNER, "Solo team");
		await seedOwnRows(OWNER);
		const res = await deleteAs(OWNER, {}, true);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body).toMatchObject({
			dryRun: true,
			deleted: false,
			ownedProjects: 1,
			sharedProjects: 0,
			workspacesLeft: 0,
			blockedWorkspaces: [],
		});
		// The personal workspace exists once listed; the team one is alone.
		expect(res.body.workspacesDeleted).toBeGreaterThanOrEqual(1);
		expect(await countOwnRows(OWNER)).toEqual(ones());
		expect(await UserModel.exists({ sub: OWNER })).toBeTruthy();
	});
});

describe("DELETE /users/me", () => {
	it("needs the username typed back", async () => {
		for (const body of [{}, { confirm: "Owner" }, { confirm: "bob" }]) {
			const res = await deleteAs(OWNER, body);
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("CONFIRMATION_MISMATCH");
		}
		expect(await UserModel.exists({ sub: OWNER })).toBeTruthy();
	});

	it("is refused without the allowed Origin (CSRF)", async () => {
		const res = await request(testApp)
			.delete("/api/v1/users/me")
			.set("x-test-sub", OWNER)
			.send({ confirm: "owner" });
		expect(res.status).toBe(403);
		expect(res.body.error.code).toBe("CSRF_REJECTED");
		expect(await UserModel.exists({ sub: OWNER })).toBeTruthy();
	});

	it("is refused to a guest", async () => {
		const res = await request(testApp)
			.delete("/api/v1/users/me")
			.set("origin", "https://localman.test")
			.send({ confirm: "owner" });
		expect(res.status).toBe(401);
	});

	it("deletes every own row and the user, and leaves other accounts alone", async () => {
		await seedOwnRows(OWNER);
		await seedOwnRows(BOB);
		const res = await deleteAs(OWNER, { confirm: " owner " });
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body).toMatchObject({ dryRun: false, deleted: true });
		expect(await countOwnRows(OWNER)).toEqual(zeros());
		expect(await countOwnRows(BOB)).toEqual(ones());
		expect(await UserModel.exists({ sub: OWNER })).toBeNull();
		expect(await UserModel.exists({ sub: BOB })).toBeTruthy();
		// The account is gone: what its cookie still names is signed out.
		expect((await as(OWNER).get("/users/me")).status).toBe(401);
	});

	it("allows 5 attempts an hour", async () => {
		// Blocked attempts count too: a loop cannot hammer the deletion.
		const team = await createWorkspace(OWNER, "Team");
		await addWorkspaceMember(OWNER, team, BOB, "bob");
		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect((await deleteAs(OWNER, { confirm: "owner" })).status).toBe(409);
		}
		const res = await deleteAs(OWNER, { confirm: "owner" });
		expect(res.status).toBe(429);
		expect(res.body.error.code).toBe("RATE_LIMITED");
	});
});
