import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, VIC, patchAs } from "../access/testing/access-fixture.js";
import { CollectionModel } from "./collection-model.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import {
	addNode,
	contentOf,
	createAs,
	draftOf,
	exampleNode,
	folder,
	moveAsEve,
	requestNode,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const restore = (sub: string, id: string, revisionId: string) =>
	as(sub).send("post", `/collections/${id}/changelog/${revisionId}/restore`);

async function latestChange(id: string): Promise<string> {
	const res = await as(EVE).get(`/collections/${id}/changelog`);
	return res.body.sessions[0].changes[0].id;
}

async function snapshot(id: string) {
	const detail = await as(EVE).get(`/collections/${id}`);
	return {
		revisionId: await latestChange(id),
		content: contentOf(detail.body),
	};
}

describe("restore to a change", () => {
	it("rebuilds the state after any change of a create, edit, move and delete sequence", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { template: "rest-crud" });
		const states = [await snapshot(id)];
		const dir = await addNode(EVE, id, folder("A"));
		states.push(await snapshot(id));
		const req = await addNode(EVE, id, requestNode("R", dir.id));
		await addNode(EVE, id, exampleNode("E", req.id));
		states.push(await snapshot(id));
		await patchAs(EVE, `/collections/${id}/nodes/${req.id}`, {
			draft: draftOf("R", { method: "PUT" }),
		});
		states.push(await snapshot(id));
		await moveAsEve(id, req.id, {
			parentId: null,
			beforeOrder: null,
			afterOrder: null,
		});
		states.push(await snapshot(id));
		await patchAs(EVE, `/collections/${id}`, {
			name: "Renamed",
			tags: ["x"],
			status: { kind: "preset", preset: "stable" },
		});
		states.push(await snapshot(id));
		await as(EVE).send("delete", `/collections/${id}/nodes/${dir.id}`);
		states.push(await snapshot(id));
		await as(EVE).send("post", `/collections/${id}/nodes/${req.id}/duplicate`);
		states.push(await snapshot(id));

		const order = [0, 5, 2, 7, 1, 6, 3, 4];
		for (const index of order) {
			const target = states[index];
			if (!target) throw new Error("no state");
			const res = await restore(EVE, id, target.revisionId);
			expect(res.status, JSON.stringify(res.body)).toBe(200);
			expect(res.body).toMatchObject({ restored: true, irreversible: false });
			expect(contentOf(res.body.collection)).toEqual(target.content);
		}
		const root = await CollectionModel.findById(id).lean();
		const nodes = (await as(EVE).get(`/collections/${id}`)).body.nodes;
		expect(root?.requestCount).toBe(
			nodes.filter((n: { kind: string }) => n.kind === "request").length,
		);
		const changes = await as(EVE).get(`/collections/${id}/changelog`);
		const restores = changes.body.sessions
			.flatMap((s: { changes: { action: string }[] }) => s.changes)
			.filter((c: { action: string }) => c.action === "restore");
		expect(restores).toHaveLength(order.length);
	});

	it("needs the Editor role and a change that can still be reached", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Gaps" });
		const first = await latestChange(id);
		await addNode(EVE, id, folder("A"));
		expect((await restore(VIC, id, first)).status).toBe(403);
		const middle = await latestChange(id);
		await addNode(EVE, id, folder("B"));
		await CollectionRevisionModel.updateOne(
			{ _id: await latestChange(id) },
			{ $set: { partial: true, forward: [], inverse: [] } },
		);
		const blocked = await restore(EVE, id, middle);
		expect(blocked.status).toBe(409);
		expect(blocked.body.error.code).toBe("REVISION_UNAVAILABLE");
		const list = await as(EVE).get(`/collections/${id}/changelog`);
		const flags = list.body.sessions.flatMap(
			(s: { changes: { restorable: boolean }[] }) =>
				s.changes.map((c) => c.restorable),
		);
		expect(flags).toEqual([true, false, false]);
		expect(
			(await restore(EVE, id, new Types.ObjectId().toHexString())).body.error
				.code,
		).toBe("REVISION_NOT_FOUND");
	});

	it("keeps at most 2000 revisions and the byte cap, oldest trimmed first", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Long" });
		const created = await latestChange(id);
		const collectionId = new Types.ObjectId(id);
		const fake = (seq: number, bytes = 10) => ({
			collectionId,
			seq,
			authorId: EVE,
			at: new Date(),
			entity: "node",
			entityId: "x",
			entityKind: "folder",
			entityName: "x",
			action: "update",
			fields: [],
			forward: [],
			inverse: [],
			touched: [],
			bytes,
		});
		await CollectionRevisionModel.insertMany(
			Array.from({ length: 1_999 }, (_, i) => fake(i + 2)),
		);
		await CollectionModel.updateOne(
			{ _id: id },
			{
				$set: { revisionSeq: 2_000, revisionCount: 2_000 },
				$inc: { revisionBytes: 1_999 * 10 },
			},
		);
		await addNode(EVE, id, folder("Newest"));
		const kept = { collectionId, trimmed: { $ne: true } };
		expect(await CollectionRevisionModel.countDocuments(kept)).toBe(2_000);
		const stub = await CollectionRevisionModel.findOne({
			collectionId,
			seq: 1,
		}).lean();
		expect(stub).toMatchObject({ trimmed: true, forward: [], bytes: 0 });
		const trimmed = await restore(EVE, id, created);
		expect(trimmed.status).toBe(409);
		expect(trimmed.body.error.code).toBe("REVISION_UNAVAILABLE");

		const MIB = 1024 * 1024;
		await CollectionRevisionModel.updateMany(
			{ collectionId, seq: { $gte: 2, $lte: 3 } },
			{ $set: { bytes: 8 * MIB } },
		);
		await CollectionModel.updateOne(
			{ _id: id },
			{ $inc: { revisionBytes: 2 * 8 * MIB } },
		);
		await addNode(EVE, id, folder("Bytes"));
		const root = await CollectionModel.findById(id).lean();
		expect(root?.revisionBytes ?? 0).toBeLessThanOrEqual(20 * MIB);
		const second = await CollectionRevisionModel.findOne({
			collectionId,
			seq: 2,
		}).lean();
		expect(second?.trimmed).toBe(true);
		expect(root?.revisionCount).toBe(
			await CollectionRevisionModel.countDocuments(kept),
		);
		const listed = await as(EVE).get(`/collections/${id}/changelog`);
		const shown = listed.body.sessions.flatMap(
			(s: { changes: unknown[] }) => s.changes,
		);
		expect(shown).toHaveLength(100);
		const stubDiff = await as(EVE).get(
			`/collections/${id}/changelog/${created}/diff`,
		);
		expect(stubDiff.body).toMatchObject({ available: false });
	});
});
