import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	patchAs,
} from "../access/testing/access-fixture.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	addNode,
	createAs,
	draftOf,
	folder,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const search = (sub: string, ws: string, q: string) =>
	as(sub).get(
		`/workspaces/${ws}/collections/search?q=${encodeURIComponent(q)}`,
	);

async function shop() {
	const ws = (await teamOfThree()).toHexString();
	const cafe = await createAs(ADA, ws, { name: "Café API" });
	const orders = await addNode(EVE, cafe.id, folder("Đơn hàng"));
	const nested = await addNode(EVE, cafe.id, folder("Mới", orders.id));
	const create = await addNode(EVE, cafe.id, {
		kind: "request",
		parentId: nested.id,
		name: "Tạo đơn",
		draft: draftOf("Tạo đơn", { method: "POST" }),
	});
	return { ws, cafe, orders, create };
}

describe("client.searchCollections", () => {
	it("matches collections, folders and requests ignoring case and accents", async () => {
		const { ws, cafe, orders, create } = await shop();
		const byCollection = await search(VIC, ws, "CAFE");
		expect(byCollection.body).toEqual({
			matches: [
				{
					collectionId: cafe.id,
					collectionName: "Café API",
					nodeId: null,
					kind: "collection",
					name: "Café API",
					path: [],
				},
			],
			truncated: false,
		});
		const res = await search(VIC, ws, "don");
		expect(res.body.matches).toHaveLength(2);
		expect(res.body.matches).toContainEqual({
			collectionId: cafe.id,
			collectionName: "Café API",
			nodeId: create.id,
			kind: "request",
			name: "Tạo đơn",
			method: "POST",
			path: ["Đơn hàng", "Mới"],
		});
		expect(res.body.matches).toContainEqual(
			expect.objectContaining({ nodeId: orders.id, kind: "folder", path: [] }),
		);
		await patchAs(EVE, `/collections/${cafe.id}/nodes/${create.id}`, {
			name: "Create order",
		});
		const renamed = await search(VIC, ws, "create");
		expect(
			renamed.body.matches.map((m: { nodeId: string }) => m.nodeId),
		).toEqual([create.id]);
		expect((await search(VIC, ws, "d.n")).body.matches).toEqual([]);
	});

	it("searches only what the caller may open", async () => {
		const { ws, cafe } = await shop();
		const other = await createAs(ADA, ws, { name: "Other cafe" });
		expect((await search(OLLIE, ws, "cafe")).status).toBe(404);
		await as(ADA).send("post", `/elements/collection/${other.id}/shares`, {
			usernameOrEmail: "ollie",
			role: "viewer",
		});
		const shared = await search(OLLIE, ws, "cafe");
		expect(
			shared.body.matches.map((m: { collectionId: string }) => m.collectionId),
		).toEqual([other.id]);
		await as(ADA).send("delete", `/collections/${cafe.id}`, {
			confirm: "delete",
		});
		expect((await search(VIC, ws, "đơn")).body.matches).toEqual([]);
	});

	it("caps the matches and validates the query", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Bulk" });
		await CollectionNodeModel.insertMany(
			Array.from({ length: 120 }, (_, index) => ({
				collectionId: new Types.ObjectId(id),
				parentId: null,
				kind: "folder",
				order: `a${index}`,
				name: `Match ${index}`,
				searchName: `match ${index}`,
				updatedBy: EVE,
			})),
		);
		const res = await search(EVE, ws, "match");
		expect(res.body.matches).toHaveLength(100);
		expect(res.body.truncated).toBe(true);
		expect((await search(EVE, ws, "x".repeat(101))).status).toBe(400);
		expect((await search(EVE, ws, "  ")).status).toBe(400);
	});
});
