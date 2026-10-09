import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	guest,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { ProjectModel } from "./project-model.js";

const ALICE = "acc_alice";
const BOB = "acc_bob";

useDashboardTestDb(() => ({ mockBaseDomain: "mock.test" }));

beforeEach(async () => {
	await UserModel.create([
		{ sub: ALICE, username: "alice", name: "Alice" },
		{ sub: BOB, username: "bob" },
	]);
});

async function createAs(sub: string) {
	const res = await as(sub).send("post", "/projects", {
		name: "Demo",
		prefix: "/api",
	});
	expect(res.status).toBe(201);
	return res.body as { id: string };
}

describe("GET /projects/:projectId", () => {
	it("returns the same view as the list item", async () => {
		const { id } = await createAs(ALICE);
		const one = await as(ALICE).get(`/projects/${id}`);
		const list = await as(ALICE).get("/projects");
		expect(one.status).toBe(200);
		expect(one.body).toEqual(list.body.items[0]);
		expect(one.body).toMatchObject({
			id,
			name: "Demo",
			prefix: "/api",
			role: "owner",
			owner: { sub: ALICE, username: "alice" },
		});
	});

	it("answers 404 to a user who cannot read the project", async () => {
		const { id } = await createAs(ALICE);
		const res = await as(BOB).get(`/projects/${id}`);
		expect(res.status).toBe(404);
		expect(res.body.error.code).toBe("NOT_FOUND");
	});

	it("answers 404 for unknown, malformed and being-deleted projects", async () => {
		const { id } = await createAs(ALICE);
		await ProjectModel.updateOne(
			{ _id: id },
			{ $set: { deletingAt: new Date() } },
		);
		for (const path of [
			`/projects/${id}`,
			"/projects/0123456789abcdef01234567",
			"/projects/not-an-id",
		]) {
			const res = await as(ALICE).get(path);
			expect(res.status).toBe(404);
			expect(res.body.error.code).toBe("NOT_FOUND");
		}
	});

	// Accepted collaborations are not stored yet (`acceptedCollaborations`
	// in project-access.ts answers none), so a test cannot create one.
	it.todo(
		"lets an accepted collaborator read the project with role collaborator",
	);

	it("requires sign-in", async () => {
		const { id } = await createAs(ALICE);
		const res = await guest().get(`/projects/${id}`);
		expect(res.status).toBe(401);
	});
});
