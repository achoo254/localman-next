import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	patchAs,
	personalWorkspace,
} from "../access/testing/access-fixture.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	createAs,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";
import { SHOP_TREE_FOR_TESTS } from "./testing/shop-tree.js";

useCollectionTestDb();

const listOf = (sub: string, workspaceId: string) =>
	as(sub).get(`/workspaces/${workspaceId}/collections`);

describe("collections CRUD", () => {
	it("creates empty, from the REST CRUD template and from a tree", async () => {
		const ws = (await teamOfThree()).toHexString();
		const empty = await createAs(EVE, ws, { name: "Empty" });
		expect(empty).toMatchObject({
			name: "Empty",
			workspaceId: ws,
			auth: { type: "none" },
			createdBy: EVE,
			nodes: [],
		});
		const crud = await createAs(ADA, ws, { template: "rest-crud" });
		expect(crud.name).toBe("REST CRUD");
		expect(crud.variables.map((v) => v.key)).toContain("baseUrl");
		const requests = crud.nodes.filter((node) => node.kind === "request");
		expect(
			requests.map((node) => node.kind === "request" && node.draft.method),
		).toEqual(expect.arrayContaining(["GET", "POST", "PUT", "DELETE"]));
		expect(requests).toHaveLength(5);
		for (const node of requests) {
			if (node.kind === "request")
				expect(node.draft.url).toMatch(/^\{\{baseUrl\}\}\/items/);
		}
		const imported = await createAs(EVE, ws, {
			tree: SHOP_TREE_FOR_TESTS,
			name: "Shop copy",
		});
		expect(imported.name).toBe("Shop copy");
		expect(imported.auth).toEqual(SHOP_TREE_FOR_TESTS.auth);
		expect(imported.nodes.length).toBeGreaterThan(2);
	});

	it("validates the source, the depth and who may create", async () => {
		const ws = (await teamOfThree()).toHexString();
		const path = `/workspaces/${ws}/collections`;
		expect((await as(EVE).send("post", path, {})).status).toBe(400);
		const both = await as(EVE).send("post", path, {
			tree: SHOP_TREE_FOR_TESTS,
			template: "rest-crud",
		});
		expect(both.status).toBe(400);
		let items: unknown[] = [];
		for (let level = 0; level < 70; level += 1) {
			items = [
				{
					kind: "folder",
					id: `f${level}`,
					name: "f",
					description: "",
					auth: { type: "inherit" },
					scripts: { pre: "", post: "" },
					items,
				},
			];
		}
		const deep = await as(EVE).send("post", path, {
			tree: { ...SHOP_TREE_FOR_TESTS, items },
		});
		expect(deep.status).toBe(400);
		expect(deep.body.error.code).toBe("VALIDATION_ERROR");
		expect((await as(VIC).send("post", path, { name: "x" })).status).toBe(403);
		expect((await as(OLLIE).send("post", path, { name: "x" })).status).toBe(
			404,
		);
		expect(await CollectionNodeModel.countDocuments()).toBe(0);
	});

	it("lists favorites first, then by name, for members and share holders", async () => {
		const ws = (await teamOfThree()).toHexString();
		const zeta = await createAs(ADA, ws, { name: "zeta" });
		await createAs(ADA, ws, { name: "Alpha" });
		await createAs(ADA, ws, { template: "rest-crud", name: "beta" });
		expect(
			(await as(VIC).send("put", `/collections/${zeta.id}/favorite`)).status,
		).toBe(200);
		const vic = await listOf(VIC, ws);
		expect(vic.body.items.map((c: { name: string }) => c.name)).toEqual([
			"zeta",
			"Alpha",
			"beta",
		]);
		expect(vic.body.items[0].favorite).toBe(true);
		expect(vic.body.items[2].requestCount).toBe(5);
		const ada = await listOf(ADA, ws);
		expect(ada.body.items.map((c: { name: string }) => c.name)).toEqual([
			"Alpha",
			"beta",
			"zeta",
		]);
		await as(VIC).send("delete", `/collections/${zeta.id}/favorite`);
		expect((await listOf(VIC, ws)).body.items[0].name).toBe("Alpha");

		expect((await listOf(OLLIE, ws)).status).toBe(404);
		await as(ADA).send("post", `/elements/collection/${zeta.id}/shares`, {
			usernameOrEmail: "ollie",
			role: "viewer",
		});
		const ollie = await listOf(OLLIE, ws);
		expect(ollie.body.items.map((c: { id: string }) => c.id)).toEqual([
			zeta.id,
		]);
	});

	it("gets, edits and exports with the role's permissions", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { template: "rest-crud" });
		expect((await as(VIC).get(`/collections/${id}`)).status).toBe(200);
		expect((await as(OLLIE).get(`/collections/${id}`)).status).toBe(404);
		expect((await as(ADA).get("/collections/not-an-id")).status).toBe(404);
		const edit = {
			name: "Renamed",
			auth: { type: "bearer", token: "{{token}}" },
			variables: [{ key: "token", value: "t", secret: true }],
		};
		expect((await patchAs(VIC, `/collections/${id}`, edit)).status).toBe(403);
		const edited = await patchAs(EVE, `/collections/${id}`, edit);
		expect(edited.status).toBe(200);
		expect(edited.body).toMatchObject(edit);
		expect(
			(await patchAs(EVE, `/collections/${id}`, { auth: { type: "inherit" } }))
				.status,
		).toBe(400);

		const exported = await as(VIC).get(`/collections/${id}/export`);
		expect(exported.status).toBe(200);
		expect(exported.body.info).toMatchObject({
			name: "Renamed",
			schema: expect.stringContaining("v2.1.0"),
		});
		expect(exported.body.auth.type).toBe("bearer");
		const [folderItem] = exported.body.item;
		expect(folderItem.name).toBe("Items");
		expect(folderItem.item.map((item: { name: string }) => item.name)).toEqual([
			"List items",
			"Get item",
			"Create item",
			"Update item",
			"Delete item",
		]);
		expect(folderItem.item[0].request).toMatchObject({ method: "GET" });
		// A secret keeps its key; its value stays out of the file.
		expect(exported.body.variable).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: "token", value: "" }),
			]),
		);
	});
});
