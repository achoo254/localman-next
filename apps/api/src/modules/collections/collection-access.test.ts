import {
	COLLECTION_DEPTH_MAX,
	COLLECTION_NODES_MAX,
} from "@localman/shared/api-client";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { AccessRequestModel } from "../access/access-request-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	personalWorkspace,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { CollectionModel } from "./collection-model.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	addNode,
	createAs,
	folder,
	requestNode,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const elementPath = (id: string, suffix = "") =>
	`/elements/collection/${id}${suffix}`;

describe("collections in the access layer", () => {
	it("shares a real collection: the share opens it with that role", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Orders" });
		expect((await as(OLLIE).get(`/collections/${id}`)).status).toBe(404);
		const shared = await as(ADA).send("post", elementPath(id, "/shares"), {
			usernameOrEmail: "ollie",
			role: "viewer",
		});
		expect(shared.status, JSON.stringify(shared.body)).toBe(200);
		expect((await as(OLLIE).get(elementPath(id))).body).toMatchObject({
			name: "Orders",
			role: "viewer",
		});
		expect((await as(OLLIE).get(`/collections/${id}`)).status).toBe(200);
		expect((await as(OLLIE).get(`/collections/${id}/export`)).status).toBe(200);
		expect(
			(await as(OLLIE).send("post", `/collections/${id}/nodes`, folder("x")))
				.status,
		).toBe(403);
	});

	it("moves a real collection; its nodes follow and roles follow the workspace", async () => {
		const source = await teamOfThree();
		const target = await teamWorkspace({ [EVE]: "admin" }, "Target");
		const { id } = await createAs(ADA, source.toHexString(), {
			template: "rest-crud",
		});
		const res = await as(EVE).send("post", elementPath(id, "/move"), {
			workspaceId: target.toHexString(),
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const moved = await as(EVE).get(`/collections/${id}`);
		expect(moved.body.workspaceId).toBe(target.toHexString());
		expect(moved.body.nodes).toHaveLength(6);
		expect((await as(VIC).get(`/collections/${id}`)).status).toBe(404);
		const personal = await personalWorkspace(EVE);
		const back = await as(EVE).send("post", elementPath(id, "/move"), {
			workspaceId: personal.toHexString(),
		});
		expect(back.body.error.code).toBe("TEAM_TO_PERSONAL");
	});

	it("hides trashed collections from shares, moves and access requests", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Gone" });
		await as(ADA).send("delete", `/collections/${id}`);
		expect((await as(ADA).get(elementPath(id))).status).toBe(404);
		const share = await as(ADA).send("post", elementPath(id, "/shares"), {
			usernameOrEmail: "ollie",
			role: "viewer",
		});
		expect(share.status).toBe(404);
		// Asking answers alike for any id, but nothing is stored for a trashed one.
		const ask = await as(OLLIE).send(
			"post",
			elementPath(id, "/access-requests"),
			{ role: "viewer" },
		);
		expect(ask.status).toBe(200);
		expect(await AccessRequestModel.countDocuments()).toBe(0);
	});
});

describe("collection size limits", () => {
	it("caps folder nesting on create and on move", async () => {
		const { id } = await createAs(EVE, (await teamOfThree()).toHexString());
		const collectionId = new Types.ObjectId(id);
		let parentId: Types.ObjectId | null = null;
		for (let level = 0; level < COLLECTION_DEPTH_MAX; level += 1) {
			const _id: Types.ObjectId = new Types.ObjectId();
			await CollectionNodeModel.create({
				_id,
				collectionId,
				parentId,
				kind: "folder",
				order: "a0",
				name: `L${level}`,
				updatedBy: EVE,
			});
			parentId = _id;
		}
		const deepest = parentId?.toHexString() ?? null;
		const tooDeep = await as(EVE).send(
			"post",
			`/collections/${id}/nodes`,
			folder("x", deepest),
		);
		expect(tooDeep.body.error.code).toBe("COLLECTION_TOO_DEEP");
		expect(
			(
				await as(EVE).send(
					"post",
					`/collections/${id}/nodes`,
					requestNode("ok", deepest),
				)
			).status,
		).toBe(201);
		const loose = await addNode(EVE, id, folder("Loose"));
		const moved = await as(EVE).send(
			"post",
			`/collections/${id}/nodes/${loose.id}/move`,
			{ parentId: deepest, beforeOrder: null, afterOrder: null },
		);
		expect(moved.body.error.code).toBe("COLLECTION_TOO_DEEP");
	});

	it("caps the nodes of one collection", async () => {
		const { id } = await createAs(EVE, (await teamOfThree()).toHexString());
		const collectionId = new Types.ObjectId(id);
		await CollectionNodeModel.insertMany(
			Array.from({ length: COLLECTION_NODES_MAX }, (_, index) => ({
				collectionId,
				parentId: null,
				kind: "folder",
				order: `a${index}`,
				name: `F${index}`,
				updatedBy: EVE,
			})),
		);
		const res = await as(EVE).send(
			"post",
			`/collections/${id}/nodes`,
			folder("one more"),
		);
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("COLLECTION_NODES_LIMIT");
		expect(await CollectionModel.countDocuments()).toBe(1);
	});
});
