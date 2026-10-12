import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	patchAs,
} from "../access/testing/access-fixture.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import {
	addNode,
	createAs,
	draftOf,
	folder,
	moveAsEve,
	requestNode,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

type Change = {
	id: string;
	action: string;
	entityKind: string;
	entityName: string;
	fields: string[];
};

async function changesOf(sub: string, id: string): Promise<Change[]> {
	const res = await as(sub).get(`/collections/${id}/changelog`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body.sessions.flatMap(
		(session: { changes: Change[] }) => session.changes,
	);
}

async function edited() {
	const ws = (await teamOfThree()).toHexString();
	const { id } = await createAs(ADA, ws, { name: "Log" });
	const dir = await addNode(EVE, id, folder("Dir"));
	const req = await addNode(EVE, id, requestNode("Get", dir.id));
	// A no-op edit leaves no entry.
	await patchAs(EVE, `/collections/${id}/nodes/${req.id}`, { name: "Get" });
	await patchAs(EVE, `/collections/${id}/nodes/${req.id}`, {
		draft: draftOf("Get", { method: "POST" }),
	});
	await moveAsEve(id, req.id, {
		parentId: null,
		beforeOrder: null,
		afterOrder: null,
	});
	await patchAs(EVE, `/collections/${id}`, { name: "Log v2", tags: ["api"] });
	await as(EVE).send("delete", `/collections/${id}/nodes/${dir.id}`);
	return { ws, id, req };
}

describe("collection changelog", () => {
	it("records every write, newest first, in sessions per author", async () => {
		const { id } = await edited();
		const changes = await changesOf(VIC, id);
		expect(changes.map((c) => [c.action, c.entityKind, c.entityName])).toEqual([
			["delete", "folder", "Dir"],
			["update", "collection", "Log v2"],
			["move", "request", "Get"],
			["update", "request", "Get"],
			["create", "request", "Get"],
			["create", "folder", "Dir"],
			["create", "collection", "Log"],
		]);
		expect(changes[1]?.fields).toEqual(
			expect.arrayContaining(["name", "tags"]),
		);
		expect(changes[2]?.fields).toEqual(
			expect.arrayContaining(["parentId", "order"]),
		);
		const res = await as(VIC).get(`/collections/${id}/changelog`);
		expect(
			res.body.sessions.map((s: { authorName: string }) => s.authorName),
		).toEqual(["Eve", "Ada"]);
		expect(res.body.nextBefore).toBeNull();
		expect((await as(OLLIE).get(`/collections/${id}/changelog`)).status).toBe(
			404,
		);
	});

	it("shows before and after of a change, and hides it from Viewers only", async () => {
		const { id } = await edited();
		const changes = await changesOf(EVE, id);
		const update = changes.find(
			(c) => c.action === "update" && c.entityKind === "request",
		);
		if (!update) throw new Error("no update");
		const diffPath = `/collections/${id}/changelog/${update.id}/diff`;
		const diff = await as(VIC).get(diffPath);
		expect(diff.body).toMatchObject({ available: true, hidden: false });
		expect(diff.body.before.draft.method).toBe("GET");
		expect(diff.body.after.draft.method).toBe("POST");
		expect(diff.body.after.parentId).not.toBeNull();
		const rename = changes.find(
			(c) => c.entityKind === "collection" && c.action === "update",
		);
		const rootDiff = await as(VIC).get(
			`/collections/${id}/changelog/${rename?.id}/diff`,
		);
		expect([rootDiff.body.before.name, rootDiff.body.after.name]).toEqual([
			"Log",
			"Log v2",
		]);

		expect(
			(
				await as(VIC).send(
					"post",
					`/collections/${id}/changelog/${update.id}/hide`,
				)
			).status,
		).toBe(403);
		const hidden = await as(EVE).send(
			"post",
			`/collections/${id}/changelog/${update.id}/hide`,
		);
		expect(hidden.body).toMatchObject({ id: update.id, hidden: true });
		expect((await as(VIC).get(diffPath)).body).toMatchObject({
			hidden: true,
			available: false,
			before: null,
		});
		// Editors and Admins still read a hidden diff, flagged as hidden.
		for (const editor of [EVE, ADA]) {
			const own = await as(editor).get(diffPath);
			expect(own.body).toMatchObject({ hidden: true, available: true });
			expect(own.body.after.draft.method).toBe("POST");
		}
		await as(EVE).send(
			"post",
			`/collections/${id}/changelog/${update.id}/show`,
		);
		expect((await as(VIC).get(diffPath)).body.available).toBe(true);
		const missing = await as(VIC).get(
			`/collections/${id}/changelog/${"0".repeat(24)}/diff`,
		);
		expect(missing.body.error.code).toBe("REVISION_NOT_FOUND");
	});

	it("pages the changelog and feeds the activity", async () => {
		const { id } = await edited();
		const activity = await as(VIC).get(`/collections/${id}/activity?limit=3`);
		expect(activity.body.items).toHaveLength(3);
		expect(activity.body.items[0]).toMatchObject({
			action: "delete",
			authorId: EVE,
			authorName: "Eve",
		});
		const count = await CollectionRevisionModel.countDocuments({
			collectionId: id,
		});
		expect(count).toBe(7);
	});
});
