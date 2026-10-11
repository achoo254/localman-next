import { COLLECTION_NODES_MAX } from "@localman/shared/api-client";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, VIC } from "../access/testing/access-fixture.js";
import { COLLECTION_BYTES_MAX } from "./collection-bytes.js";
import { CollectionModel } from "./collection-model.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	addNode,
	emptyCollection,
	folder,
	requestNode,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const duplicate = (sub: string, id: string, nodeId: string) =>
	as(sub).send("post", `/collections/${id}/nodes/${nodeId}/duplicate`);

async function folderWithTwo(id: string) {
	const dir = await addNode(EVE, id, folder("Dir"));
	const inner = await addNode(EVE, id, folder("Inner", dir.id));
	await addNode(EVE, id, requestNode("Get", inner.id));
	const next = await addNode(EVE, id, requestNode("After"));
	return { dir, inner, next };
}

describe("client.duplicateCollectionNode", () => {
	it("copies the subtree as the next sibling with new ids", async () => {
		const id = await emptyCollection();
		const { dir, next } = await folderWithTwo(id);
		const before = await CollectionModel.findById(id).lean();
		const res = await duplicate(EVE, id, dir.id);
		expect(res.status, JSON.stringify(res.body)).toBe(201);
		const [copy, innerCopy, getCopy] = res.body.nodes;
		expect(res.body.nodes).toHaveLength(3);
		expect(copy).toMatchObject({
			kind: "folder",
			name: "Dir Copy",
			parentId: null,
		});
		expect(copy.order > dir.order && copy.order < next.order).toBe(true);
		expect(innerCopy).toMatchObject({ name: "Inner", parentId: copy.id });
		expect(getCopy).toMatchObject({
			kind: "request",
			name: "Get",
			parentId: innerCopy.id,
		});
		expect(await CollectionNodeModel.countDocuments({ collectionId: id })).toBe(
			7,
		);
		const after = await CollectionModel.findById(id).lean();
		expect(after?.requestCount).toBe((before?.requestCount ?? 0) + 1);
		expect(after?.bytes ?? 0).toBeGreaterThan(before?.bytes ?? 0);
		const detail = await as(VIC).get(`/collections/${id}`);
		const top = detail.body.nodes
			.filter((node: { parentId: string | null }) => node.parentId === null)
			.sort((a: { order: string }, b: { order: string }) =>
				a.order < b.order ? -1 : 1,
			)
			.map((node: { name: string }) => node.name);
		expect(top).toEqual(["Dir", "Dir Copy", "After"]);
	});

	it("writes nothing past the node limit or the byte budget", async () => {
		const id = await emptyCollection();
		const { dir } = await folderWithTwo(id);
		const collectionId = new Types.ObjectId(id);
		await CollectionNodeModel.insertMany(
			Array.from({ length: COLLECTION_NODES_MAX - 6 }, (_, index) => ({
				collectionId,
				parentId: null,
				kind: "folder",
				order: `b${index}`,
				name: `F${index}`,
				updatedBy: EVE,
			})),
		);
		const full = await duplicate(EVE, id, dir.id);
		expect(full.status).toBe(409);
		expect(full.body.error.code).toBe("COLLECTION_NODES_LIMIT");
		await CollectionNodeModel.deleteMany({ collectionId, order: /^b/ });
		await CollectionModel.updateOne(
			{ _id: id },
			{ $set: { bytes: COLLECTION_BYTES_MAX - 10 } },
		);
		const large = await duplicate(EVE, id, dir.id);
		expect(large.status).toBe(413);
		expect(large.body.error.code).toBe("COLLECTION_TOO_LARGE");
		expect(await CollectionNodeModel.countDocuments({ collectionId })).toBe(4);
	});

	it("needs the Editor role and a node of this collection", async () => {
		const id = await emptyCollection();
		const { dir } = await folderWithTwo(id);
		expect((await duplicate(VIC, id, dir.id)).status).toBe(403);
		const missing = await duplicate(
			EVE,
			id,
			new Types.ObjectId().toHexString(),
		);
		expect(missing.body.error.code).toBe("NODE_NOT_FOUND");
	});
});
