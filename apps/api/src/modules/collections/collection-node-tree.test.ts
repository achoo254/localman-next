import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, VIC } from "../access/testing/access-fixture.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	addNode,
	createAs,
	emptyCollection,
	folder,
	moveAsEve as move,
	requestNode,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

describe("collection subtrees", () => {
	it("rejects a folder moved into itself or its subtree", async () => {
		const id = await emptyCollection();
		const top = await addNode(EVE, id, folder("Top"));
		const mid = await addNode(EVE, id, folder("Mid", top.id));
		const low = await addNode(EVE, id, folder("Low", mid.id));
		for (const parentId of [top.id, mid.id, low.id]) {
			const res = await move(id, top.id, {
				parentId,
				beforeOrder: null,
				afterOrder: null,
			});
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("MOVE_CYCLE");
		}
		const other = await createAs(
			EVE,
			(await teamOfThree("Other")).toHexString(),
		);
		const foreignParent = await addNode(EVE, other.id, folder("Elsewhere"));
		const cross = await move(id, low.id, {
			parentId: foreignParent.id,
			beforeOrder: null,
			afterOrder: null,
		});
		expect(cross.body.error.code).toBe("INVALID_PARENT");
		const up = await move(id, low.id, {
			parentId: null,
			beforeOrder: null,
			afterOrder: null,
		});
		expect(up.body.parentId).toBeNull();
	});

	it("deletes a subtree, with a dry run that counts it first", async () => {
		const id = await emptyCollection();
		const top = await addNode(EVE, id, folder("Top"));
		const mid = await addNode(EVE, id, folder("Mid", top.id));
		await addNode(EVE, id, requestNode("R1", top.id));
		await addNode(EVE, id, requestNode("R2", mid.id));
		const keep = await addNode(EVE, id, requestNode("Keep"));
		const path = `/collections/${id}/nodes/${top.id}`;
		expect((await as(VIC).send("delete", path)).status).toBe(403);
		const dry = await as(EVE).send("delete", `${path}?dryRun=true`);
		expect(dry.body).toEqual({
			dryRun: true,
			deleted: false,
			nodeId: top.id,
			folders: 2,
			requests: 2,
		});
		expect(await CollectionNodeModel.countDocuments({ collectionId: id })).toBe(
			5,
		);
		const res = await as(EVE).send("delete", path);
		expect(res.body).toMatchObject({ deleted: true, folders: 2, requests: 2 });
		const left = await CollectionNodeModel.find({ collectionId: id }).lean();
		expect(left.map((node) => node._id.toHexString())).toEqual([keep.id]);
		expect((await as(EVE).send("delete", path)).body.error.code).toBe(
			"NODE_NOT_FOUND",
		);
	});

	it("lets only one of two crossing folder moves through", async () => {
		const id = await emptyCollection();
		const a = await addNode(EVE, id, folder("A"));
		const b = await addNode(EVE, id, folder("B"));
		const into = (nodeId: string, parentId: string) =>
			move(id, nodeId, { parentId, beforeOrder: null, afterOrder: null });
		const results = await Promise.all([into(a.id, b.id), into(b.id, a.id)]);
		const statuses = results.map((res) => res.status).sort();
		expect(statuses).toEqual([200, 400]);
		const failed = results.find((res) => res.status === 400);
		expect(failed?.body.error.code).toBe("MOVE_CYCLE");
		const tops = await CollectionNodeModel.countDocuments({ parentId: null });
		expect(tops).toBe(1);
	});
});
