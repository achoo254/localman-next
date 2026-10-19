import type { CollectionDetail, ForkStatus } from "@localman/shared/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import { ADA, EVE, VIC, patchAs } from "../access/testing/access-fixture.js";
import {
	createAs,
	teamOfThree,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { UserModel } from "../users/user-model.js";

useCollectionTestDb();

beforeEach(async () => {
	await UserModel.updateMany(
		{},
		{ $set: { plan: "pro", planExpiresAt: null } },
	);
});

/** Ada's team collection forked by Eve into the team, where Vic is a Viewer. */
async function forked() {
	const ws = (await teamOfThree()).toHexString();
	const source = await createAs(ADA, ws, { name: "Orders API" });
	const res = await as(EVE).send("post", `/collections/${source.id}/forks`, {
		label: "eve-fork",
		workspaceId: ws,
	});
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return { source: source.id, fork: (res.body as CollectionDetail).id };
}

const canMerge = async (sub: string, fork: string) =>
	((await as(sub).get(`/collections/${fork}/fork-status`)).body as ForkStatus)
		.fork?.source.canMerge;

/** Gives Vic the Editor role on one collection, above his team Viewer role. */
const editorOn = (elementId: string) =>
	ElementRoleModel.create({
		elementType: "collection",
		elementId,
		userId: VIC,
		role: "editor",
		grantedBy: ADA,
	});

describe("permissions on a fork", () => {
	it("lets an Editor of the fork rename its label, not a Viewer", async () => {
		const { source, fork } = await forked();
		const renamed = await patchAs(EVE, `/collections/${fork}/fork`, {
			label: "eve-v2",
		});
		expect(renamed.status, JSON.stringify(renamed.body)).toBe(200);
		const status = (await as(ADA).get(`/collections/${fork}/fork-status`))
			.body as ForkStatus;
		expect(status.fork?.label).toBe("eve-v2");
		const listed = await as(ADA).get(`/collections/${source}/forks`);
		expect(listed.body.items[0]).toMatchObject({ label: "eve-v2" });
		expect(
			(await patchAs(VIC, `/collections/${fork}/fork`, { label: "x" })).status,
		).toBe(403);
		expect(
			(await patchAs(ADA, `/collections/${source}/fork`, { label: "x" }))
				.status,
		).toBe(404);
	});

	it("tells whether the caller may merge into the source", async () => {
		const { source, fork } = await forked();
		expect(await canMerge(EVE, fork)).toBe(true);
		expect(await canMerge(VIC, fork)).toBe(false);
		await editorOn(source);
		expect(await canMerge(VIC, fork)).toBe(true);
	});

	it("lets a Viewer of the fork merge plainly but not update or delete it", async () => {
		const { source, fork } = await forked();
		await editorOn(source);
		await patchAs(EVE, `/collections/${fork}`, { description: "from fork" });
		for (const option of ["mergeAndUpdate", "mergeAndDelete"]) {
			const res = await as(VIC).send("post", `/collections/${fork}/merge`, {
				option,
			});
			expect(res.status, option).toBe(403);
		}
		expect((await as(EVE).get(`/collections/${fork}`)).status).toBe(200);
		const plain = await as(VIC).send("post", `/collections/${fork}/merge`, {});
		expect(plain.status, JSON.stringify(plain.body)).toBe(200);
		const after = (await as(ADA).get(`/collections/${source}`))
			.body as CollectionDetail;
		expect(after.description).toBe("from fork");
	});
});
