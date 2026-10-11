import mongoose, { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { as, testApp } from "../../test-support/dashboard-test-app.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { collectionAdapter } from "./collection-adapter.js";
import { chargeRoot } from "./collection-bytes.js";
import { CollectionModel } from "./collection-model.js";
import { COLLECTIONS_PER_WORKSPACE_MAX } from "./collection-store.js";
import {
	addNode,
	createAs,
	emptyCollection,
	moveAsEve,
	requestNode,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

describe("collection write races", () => {
	it("keeps drops from a stale view between distinct keys", async () => {
		const id = await emptyCollection();
		const a = await addNode(EVE, id, requestNode("A"));
		const b = await addNode(EVE, id, requestNode("B"));
		const stale = { parentId: null, beforeOrder: a.order, afterOrder: b.order };
		const orders: string[] = [];
		for (const name of ["C", "D", "E"]) {
			const node = await addNode(EVE, id, requestNode(name));
			const res = await moveAsEve(id, node.id, stale);
			expect(res.status, JSON.stringify(res.body)).toBe(200);
			orders.push(res.body.order);
		}
		const all = [a.order, ...orders, b.order];
		expect(new Set(all).size).toBe(all.length);
		for (const order of orders) {
			expect(order > a.order && order < b.order).toBe(true);
		}
	});

	it("checks the target's room and a lost race when moving a collection", async () => {
		const source = await teamOfThree();
		const target = await teamWorkspace({ [EVE]: "admin" }, "Full");
		const { id } = await createAs(ADA, source.toHexString());
		await CollectionModel.insertMany(
			Array.from({ length: COLLECTIONS_PER_WORKSPACE_MAX }, (_, index) => ({
				workspaceId: target,
				name: `C${index}`,
				auth: { type: "none" },
				scripts: { pre: "", post: "" },
				variables: [],
				createdBy: EVE,
				updatedBy: EVE,
			})),
		);
		const res = await as(EVE).send("post", `/elements/collection/${id}/move`, {
			workspaceId: target.toHexString(),
		});
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("COLLECTION_LIMIT_REACHED");
		await CollectionModel.updateOne(
			{ _id: id },
			{ $set: { deletedAt: new Date(), deletedBy: ADA } },
		);
		await expect(collectionAdapter.moveTo(id, source)).rejects.toMatchObject({
			status: 404,
		});
	});

	it("refuses node writes once the root is trashed", async () => {
		const id = await emptyCollection();
		await CollectionModel.updateOne(
			{ _id: id },
			{ $set: { deletedAt: new Date(), deletedBy: EVE } },
		);
		const charge = mongoose.connection.transaction((session) =>
			chargeRoot(new Types.ObjectId(id), EVE, session),
		);
		await expect(charge).rejects.toMatchObject({
			status: 404,
			code: "NOT_FOUND",
		});
	});

	it("lists a share-only collection behind many shares elsewhere", async () => {
		const ws = (await teamOfThree()).toHexString();
		await ElementRoleModel.insertMany(
			Array.from({ length: 1_200 }, () => ({
				elementType: "collection",
				elementId: new Types.ObjectId().toHexString(),
				userId: OLLIE,
				role: "viewer",
				grantedBy: ADA,
			})),
		);
		const { id } = await createAs(ADA, ws, { name: "Shared last" });
		await as(ADA).send("post", `/elements/collection/${id}/shares`, {
			usernameOrEmail: "ollie",
			role: "viewer",
		});
		const res = await as(OLLIE).get(`/workspaces/${ws}/collections`);
		expect(res.status).toBe(200);
		expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([id]);
	});

	it("rejects a 20,000-level tree without exhausting the stack", async () => {
		const ws = (await teamOfThree()).toHexString();
		const level =
			'{"kind":"folder","id":"f","name":"f","description":"","auth":{"type":"inherit"},"scripts":{"pre":"","post":""},"items":[';
		const depth = 20_000;
		const items = `${level.repeat(depth)}${"]}".repeat(depth)}`;
		const tree = `{"name":"Deep","description":"","auth":{"type":"none"},"variables":[],"scripts":{"pre":"","post":""},"items":[${items}]}`;
		const res = await request(testApp)
			.post(`/api/v1/workspaces/${ws}/collections`)
			.set("x-test-sub", EVE)
			.set("origin", "https://localman.test")
			.set("content-type", "application/json")
			.send(`{"tree":${tree}}`);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
		expect(JSON.stringify(res.body.error.details)).toContain("levels deep");
		expect(await CollectionModel.countDocuments()).toBe(0);
	});
});
