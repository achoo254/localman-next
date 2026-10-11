import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import {
	addNode,
	contentOf,
	emptyCollection,
	folder,
	moveAsEve,
	requestNode,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

async function firstChange(id: string): Promise<string> {
	const first = await CollectionRevisionModel.findOne({
		collectionId: id,
		seq: 1,
	}).lean();
	if (!first) throw new Error("no first revision");
	return first._id.toHexString();
}

const restore = (id: string, revisionId: string) =>
	as(EVE).send("post", `/collections/${id}/changelog/${revisionId}/restore`);

describe("node moves racing other writes", () => {
	it("records no move for a node deleted meanwhile, and history stays restorable", async () => {
		for (let round = 0; round < 4; round += 1) {
			const id = await emptyCollection();
			const target = await addNode(EVE, id, folder("Target"));
			const node = await addNode(EVE, id, requestNode("R"));
			const [moved, deleted] = await Promise.all([
				moveAsEve(id, node.id, {
					parentId: target.id,
					beforeOrder: null,
					afterOrder: null,
				}),
				as(EVE).send("delete", `/collections/${id}/nodes/${node.id}`),
			]);
			expect(deleted.status).toBe(200);
			expect([200, 404]).toContain(moved.status);
			const moves = await CollectionRevisionModel.countDocuments({
				collectionId: id,
				action: "move",
			});
			expect(moves).toBe(moved.status === 200 ? 1 : 0);
			const res = await restore(id, await firstChange(id));
			expect(res.status, JSON.stringify(res.body)).toBe(200);
			expect(res.body.collection.nodes).toEqual([]);
		}
	});

	it("chains two concurrent moves of one node so every state can be restored", async () => {
		const id = await emptyCollection();
		const a = await addNode(EVE, id, folder("A"));
		const b = await addNode(EVE, id, folder("B"));
		const node = await addNode(EVE, id, requestNode("R"));
		const before = contentOf((await as(EVE).get(`/collections/${id}`)).body);
		const results = await Promise.all([
			moveAsEve(id, node.id, {
				parentId: a.id,
				beforeOrder: null,
				afterOrder: null,
			}),
			moveAsEve(id, node.id, {
				parentId: b.id,
				beforeOrder: null,
				afterOrder: null,
			}),
		]);
		expect(results.map((res) => res.status)).toEqual([200, 200]);
		const moves = await CollectionRevisionModel.find({
			collectionId: id,
			action: "move",
		})
			.sort({ seq: 1 })
			.lean();
		expect(moves).toHaveLength(2);
		const [first] = moves;
		if (!first) throw new Error("no move");
		const middle = await restore(id, first._id.toHexString());
		expect(middle.status).toBe(200);
		const lastParent = middle.body.collection.nodes.find(
			(n: { id: string }) => n.id === node.id,
		)?.parentId;
		expect([a.id, b.id]).toContain(lastParent);
		const createdR = await CollectionRevisionModel.findOne({
			collectionId: id,
			action: "create",
			entityId: node.id,
		}).lean();
		const back = await restore(id, createdR?._id.toHexString() ?? "");
		expect(contentOf(back.body.collection)).toEqual(before);
	});
});
