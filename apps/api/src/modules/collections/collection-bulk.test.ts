import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, OLLIE, VIC } from "../access/testing/access-fixture.js";
import { CollectionModel, LIVE_COLLECTION } from "./collection-model.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import {
	addNode,
	createAs,
	emptyCollection,
	exampleNode,
	folder,
	requestNode,
	teamOfThree,
	trashOf,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

describe("bulk node delete", () => {
	it("deletes listed subtrees together, or nothing when one is missing", async () => {
		const id = await emptyCollection();
		const a = await addNode(EVE, id, folder("A"));
		const inner = await addNode(EVE, id, requestNode("Inner", a.id));
		await addNode(EVE, id, exampleNode("Ex", inner.id));
		const b = await addNode(EVE, id, requestNode("B"));
		const keep = await addNode(EVE, id, requestNode("Keep"));
		const path = `/collections/${id}/nodes/bulk-delete`;
		const missing = await as(EVE).send("post", path, {
			nodeIds: [a.id, new Types.ObjectId().toHexString()],
		});
		expect(missing.body.error.code).toBe("NODE_NOT_FOUND");
		expect(await CollectionNodeModel.countDocuments({ collectionId: id })).toBe(
			5,
		);
		expect((await as(VIC).send("post", path, { nodeIds: [b.id] })).status).toBe(
			403,
		);
		const body = { nodeIds: [a.id, inner.id, b.id] };
		const dry = await as(EVE).send("post", `${path}?dryRun=true`, body);
		expect(dry.body).toEqual({
			dryRun: true,
			deleted: false,
			folders: 1,
			requests: 2,
			examples: 1,
			irreversible: false,
		});
		const res = await as(EVE).send("post", path, body);
		expect(res.body).toMatchObject({
			deleted: true,
			folders: 1,
			requests: 2,
			examples: 1,
		});
		const left = await CollectionNodeModel.find({ collectionId: id }).lean();
		expect(left.map((node) => node._id.toHexString())).toEqual([keep.id]);
		expect((await CollectionModel.findById(id).lean())?.requestCount).toBe(1);
		const deletes = await CollectionRevisionModel.countDocuments({
			collectionId: id,
			action: "delete",
		});
		expect(deletes).toBe(2);
	});
});

describe("bulk collection trash", () => {
	it("trashes all of them with the single-delete rules, or none", async () => {
		const ws = (await teamOfThree()).toHexString();
		const other = (await teamOfThree("Other")).toHexString();
		const crud = await createAs(ADA, ws, { template: "rest-crud" });
		const empty = await createAs(ADA, ws, { name: "Empty" });
		const elsewhere = await createAs(ADA, other, { name: "Elsewhere" });
		const path = `/workspaces/${ws}/collections/bulk-trash`;
		const both = { collectionIds: [crud.id, empty.id] };
		expect((await as(VIC).send("post", path, both)).status).toBe(403);
		expect((await as(OLLIE).send("post", path, both)).status).toBe(404);
		const mixed = await as(EVE).send("post", path, {
			collectionIds: [empty.id, elsewhere.id],
			confirm: "delete",
		});
		expect(mixed.status).toBe(404);
		const unconfirmed = await as(EVE).send("post", path, both);
		expect(unconfirmed.body.error.code).toBe("CONFIRMATION_REQUIRED");
		const dry = await as(EVE).send("post", `${path}?dryRun=true`, both);
		expect(
			dry.body.collections.map((c: { requests: number }) => c.requests),
		).toEqual([5, 0]);
		expect(await CollectionModel.countDocuments(LIVE_COLLECTION)).toBe(3);
		const res = await as(EVE).send("post", path, {
			...both,
			confirm: "delete",
		});
		expect(res.body).toMatchObject({ deleted: true });
		expect(await CollectionModel.countDocuments(LIVE_COLLECTION)).toBe(1);
		expect(
			await CollectionRevisionModel.countDocuments({ action: "trash" }),
		).toBe(2);
	});
});

describe("trash filters", () => {
	it("filters by deleter and by name, and lists the deleters", async () => {
		const ws = (await teamOfThree()).toHexString();
		const cafe = await createAs(ADA, ws, { name: "Café orders" });
		const tea = await createAs(ADA, ws, { name: "Tea" });
		await as(EVE).send("delete", `/collections/${cafe.id}`);
		await as(ADA).send("delete", `/collections/${tea.id}`);
		const all = await trashOf(ADA);
		expect(all.body.items).toHaveLength(2);
		expect(all.body.deleters).toEqual([
			{ id: ADA, name: "Ada" },
			{ id: EVE, name: "Eve" },
		]);
		const byEve = await trashOf(ADA, `?deletedBy=${EVE}`);
		expect(byEve.body.items.map((i: { id: string }) => i.id)).toEqual([
			cafe.id,
		]);
		const byName = await trashOf(ADA, "?q=CAFE");
		expect(byName.body.items.map((i: { id: string }) => i.id)).toEqual([
			cafe.id,
		]);
		expect((await trashOf(ADA, "?q=coffee")).body.items).toEqual([]);
		const restored = await as(ADA).send(
			"post",
			`/trash/collections/${tea.id}/restore`,
			{ workspaceId: ws },
		);
		expect(restored.status).toBe(200);
		const actions = await CollectionRevisionModel.find({ collectionId: tea.id })
			.sort({ seq: 1 })
			.lean();
		expect(actions.map((rev) => rev.action)).toEqual([
			"create",
			"trash",
			"untrash",
		]);
	});
});
