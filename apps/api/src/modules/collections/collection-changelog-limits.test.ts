import { emptyRequestBody } from "@localman/shared/api-client";
import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import {
	addNode,
	contentOf,
	draftOf,
	emptyCollection,
	folder,
	requestNode,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const restore = (id: string, revisionId: string, dry = false) =>
	as(EVE).send(
		"post",
		`/collections/${id}/changelog/${revisionId}/restore${dry ? "?dryRun=true" : ""}`,
	);
const latest = async (id: string) =>
	(
		await CollectionRevisionModel.findOne({ collectionId: id })
			.sort({ seq: -1 })
			.lean()
	)?._id.toHexString() ?? "";

describe("changes too large to keep a diff", () => {
	it("are flagged irreversible before and when they happen", async () => {
		const id = await emptyCollection();
		const big = await addNode(EVE, id, folder("Big"));
		const raw = "x".repeat(900_000);
		for (let index = 0; index < 5; index += 1) {
			const body = { ...emptyRequestBody(), type: "raw" as const, raw };
			await addNode(EVE, id, {
				...requestNode(`R${index}`, big.id),
				draft: draftOf(`R${index}`, { body }),
			});
		}
		const small = await addNode(EVE, id, requestNode("Small"));
		const beforeBig = await latest(id);
		const path = (nodeId: string) => `/collections/${id}/nodes/${nodeId}`;
		expect(
			(await as(EVE).send("delete", `${path(small.id)}?dryRun=true`)).body
				.irreversible,
		).toBe(false);
		const dry = await as(EVE).send("delete", `${path(big.id)}?dryRun=true`);
		expect(dry.body).toMatchObject({
			dryRun: true,
			irreversible: true,
			requests: 5,
		});
		const done = await as(EVE).send("delete", path(big.id));
		expect(done.body).toMatchObject({ deleted: true, irreversible: true });
		const kept = await CollectionRevisionModel.findOne({
			collectionId: id,
			action: "delete",
		}).lean();
		expect(kept).toMatchObject({ partial: true, forward: [] });
		expect((await restore(id, beforeBig)).body.error.code).toBe(
			"REVISION_UNAVAILABLE",
		);
		const plan = await CollectionRevisionModel.find({
			collectionId: id,
			partial: true,
		})
			.sort({ seq: -1 })
			.limit(1)
			.explain();
		expect(JSON.stringify(plan)).toContain("partial_by_seq");
	});
});

describe("restore and diff edge cases", () => {
	it("tells trimmed changes from ids never issued, dry-runs, and lists what a restore rewrote", async () => {
		const id = await emptyCollection();
		const first = await latest(id);
		const a = await addNode(EVE, id, folder("A"));
		const before = contentOf((await as(EVE).get(`/collections/${id}`)).body);
		await addNode(EVE, id, requestNode("R", a.id));
		const dry = await restore(id, first, true);
		expect(dry.body).toEqual({
			dryRun: true,
			restored: false,
			irreversible: false,
			collection: null,
		});
		expect(await CollectionNodeModel.countDocuments({ collectionId: id })).toBe(
			2,
		);
		const aCreated = (
			await CollectionRevisionModel.findOne({
				collectionId: id,
				entityId: a.id,
			}).lean()
		)?._id;
		const res = await restore(id, aCreated?.toHexString() ?? "");
		expect(contentOf(res.body.collection)).toEqual(before);
		const diff = await as(EVE).get(
			`/collections/${id}/changelog/${await latest(id)}/diff`,
		);
		expect(diff.body.affected).toEqual([
			expect.objectContaining({ name: "R", change: "removed" }),
		]);

		await CollectionRevisionModel.updateOne(
			{ _id: first },
			{ $set: { trimmed: true, forward: [], inverse: [] } },
		);
		expect((await restore(id, first)).body.error.code).toBe(
			"REVISION_UNAVAILABLE",
		);
		const ancient = Types.ObjectId.createFromTime(1).toHexString();
		expect((await restore(id, ancient)).body.error.code).toBe(
			"REVISION_NOT_FOUND",
		);
		const other = await emptyCollection();
		const foreign = await latest(other);
		expect((await restore(id, foreign)).body.error.code).toBe(
			"REVISION_NOT_FOUND",
		);
	});

	it("reports database errors of a diff as server errors", async () => {
		const id = await emptyCollection();
		await addNode(EVE, id, folder("A"));
		const spy = vi
			.spyOn(CollectionNodeModel, "findOne")
			.mockImplementationOnce(() => {
				throw new Error("database down");
			});
		const res = await as(EVE).get(
			`/collections/${id}/changelog/${await latest(id)}/diff`,
		);
		spy.mockRestore();
		expect(res.status).toBe(500);
	});

	it("records one deletion per topmost listed node in a bulk delete", async () => {
		const id = await emptyCollection();
		const a = await addNode(EVE, id, folder("A"));
		const child = await addNode(EVE, id, requestNode("Child", a.id));
		const before = await latest(id);
		const res = await as(EVE).send(
			"post",
			`/collections/${id}/nodes/bulk-delete`,
			{ nodeIds: [child.id, a.id] },
		);
		expect(res.body).toMatchObject({
			folders: 1,
			requests: 1,
			irreversible: false,
		});
		expect(
			await CollectionRevisionModel.countDocuments({
				collectionId: id,
				action: "delete",
			}),
		).toBe(1);
		const back = await restore(id, before);
		expect(back.body.collection.nodes).toHaveLength(2);
	});
});
