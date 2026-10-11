import type { CollectionNode } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, OLLIE, VIC, patchAs } from "../access/testing/access-fixture.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	addNode,
	createAs,
	draftOf,
	emptyCollection,
	folder,
	moveAsEve as move,
	requestNode,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

async function namesUnder(
	id: string,
	parentId: string | null,
): Promise<string[]> {
	const res = await as(VIC).get(`/collections/${id}`);
	return (res.body.nodes as CollectionNode[])
		.filter((node) => node.parentId === parentId)
		.sort((a, b) => (a.order < b.order ? -1 : 1))
		.map((node) => node.name);
}

describe("collection nodes", () => {
	it("adds folders and requests last or after a sibling", async () => {
		const id = await emptyCollection();
		const users = await addNode(EVE, id, folder("Users"));
		await addNode(EVE, id, requestNode("List", users.id));
		const last = await addNode(EVE, id, requestNode("Delete", users.id));
		const first = (await namesUnder(id, users.id))[0];
		expect(first).toBe("List");
		const list = (await as(EVE).get(`/collections/${id}`)).body.nodes.find(
			(n: CollectionNode) => n.name === "List",
		);
		await addNode(EVE, id, {
			...requestNode("Get", users.id),
			afterId: list.id,
		});
		expect(await namesUnder(id, users.id)).toEqual(["List", "Get", "Delete"]);
		expect(last.order > list.order).toBe(true);

		const path = `/collections/${id}/nodes`;
		const bad = await as(EVE).send("post", path, requestNode("x", list.id));
		expect(bad.body.error.code).toBe("INVALID_PARENT");
		const elsewhere = await as(EVE).send("post", path, {
			...requestNode("x"),
			afterId: list.id,
		});
		expect(elsewhere.body.error.code).toBe("INVALID_POSITION");
		const noDraft = await as(EVE).send("post", path, {
			kind: "request",
			parentId: null,
			name: "x",
		});
		expect(noDraft.status).toBe(400);
		const folderDraft = await as(EVE).send("post", path, {
			...folder("x"),
			draft: draftOf("x"),
		});
		expect(folderDraft.body.error.code).toBe("INVALID_NODE_FIELDS");
		expect((await as(VIC).send("post", path, folder("x"))).status).toBe(403);
		expect((await as(OLLIE).send("post", path, folder("x"))).status).toBe(404);
	});

	it("edits only the fields of the node's kind", async () => {
		const id = await emptyCollection();
		const dir = await addNode(EVE, id, folder("Dir"));
		const req = await addNode(EVE, id, requestNode("Req", dir.id));
		const base = `/collections/${id}/nodes`;
		const auth = { type: "bearer", token: "{{t}}" };
		const editedFolder = await patchAs(EVE, `${base}/${dir.id}`, {
			name: "Folder",
			auth,
		});
		expect(editedFolder.body).toMatchObject({
			kind: "folder",
			name: "Folder",
			auth,
		});
		const draft = draftOf("Req", { method: "POST" });
		const editedRequest = await patchAs(EVE, `${base}/${req.id}`, {
			draft,
			description: "Makes one",
		});
		expect(editedRequest.body).toMatchObject({
			kind: "request",
			draft,
			description: "Makes one",
		});
		const wrong = await patchAs(EVE, `${base}/${req.id}`, { auth });
		expect(wrong.status).toBe(400);
		expect(wrong.body.error.code).toBe("INVALID_NODE_FIELDS");
		expect(
			(await patchAs(EVE, `${base}/${dir.id}`, { draft })).body.error.code,
		).toBe("INVALID_NODE_FIELDS");
		expect(
			(await patchAs(EVE, `${base}/${"0".repeat(24)}`, { name: "x" })).body
				.error.code,
		).toBe("NODE_NOT_FOUND");
		expect(
			(await patchAs(VIC, `${base}/${dir.id}`, { name: "x" })).status,
		).toBe(403);
	});

	it("moves between neighbours and into folders, writing one node", async () => {
		const id = await emptyCollection();
		const a = await addNode(EVE, id, requestNode("A"));
		const b = await addNode(EVE, id, requestNode("B"));
		const c = await addNode(EVE, id, requestNode("C"));
		const before = await CollectionNodeModel.find({
			_id: { $in: [a.id, b.id] },
		}).lean();
		const moved = await move(id, c.id, {
			parentId: null,
			beforeOrder: a.order,
			afterOrder: b.order,
		});
		expect(moved.status).toBe(200);
		expect(moved.body.order > a.order && moved.body.order < b.order).toBe(true);
		expect(await namesUnder(id, null)).toEqual(["A", "C", "B"]);
		const after = await CollectionNodeModel.find({
			_id: { $in: [a.id, b.id] },
		}).lean();
		expect(after.map((node) => node.updatedAt)).toEqual(
			before.map((node) => node.updatedAt),
		);

		const dir = await addNode(EVE, id, folder("Dir"));
		const into = await move(id, a.id, {
			parentId: dir.id,
			beforeOrder: null,
			afterOrder: null,
		});
		expect(into.body.parentId).toBe(dir.id);
		expect(await namesUnder(id, dir.id)).toEqual(["A"]);
		const invalid = await move(id, b.id, {
			parentId: null,
			beforeOrder: b.order,
			afterOrder: a.order,
		});
		expect(invalid.body.error.code).toBe("INVALID_ORDER");
		const junk = await move(id, b.id, {
			parentId: null,
			beforeOrder: "not a key",
			afterOrder: null,
		});
		expect(junk.body.error.code).toBe("INVALID_ORDER");
		const underRequest = await move(id, b.id, {
			parentId: c.id,
			beforeOrder: null,
			afterOrder: null,
		});
		expect(underRequest.body.error.code).toBe("INVALID_PARENT");
		expect(
			(
				await as(VIC).send("post", `/collections/${id}/nodes/${b.id}/move`, {
					parentId: null,
					beforeOrder: null,
					afterOrder: null,
				})
			).status,
		).toBe(403);
	});
});
