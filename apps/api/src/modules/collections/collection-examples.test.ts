import { EXAMPLE_BODY_MAX } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, VIC, patchAs } from "../access/testing/access-fixture.js";
import { CollectionModel } from "./collection-model.js";
import {
	addNode,
	draftOf,
	emptyCollection,
	exampleNode,
	folder,
	moveAsEve,
	requestNode,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

async function withRequest() {
	const id = await emptyCollection();
	const dir = await addNode(EVE, id, folder("Dir"));
	const req = await addNode(EVE, id, requestNode("Get", dir.id));
	return { id, dir, req };
}

describe("examples", () => {
	it("live under a request node and nowhere else", async () => {
		const { id, dir, req } = await withRequest();
		const res = await as(EVE).send(
			"post",
			`/collections/${id}/nodes`,
			exampleNode("200 OK", req.id),
		);
		expect(res.status, JSON.stringify(res.body)).toBe(201);
		expect(res.body).toMatchObject({
			kind: "example",
			parentId: req.id,
			name: "200 OK",
		});
		expect(res.body.response.status).toBe(200);
		const path = `/collections/${id}/nodes`;
		expect(
			(await as(EVE).send("post", path, exampleNode("x", dir.id))).body.error
				.code,
		).toBe("INVALID_PARENT");
		expect(
			(
				await as(EVE).send("post", path, {
					...exampleNode("x", req.id),
					parentId: null,
				})
			).status,
		).toBe(400);
		expect(
			(await as(EVE).send("post", path, requestNode("child", res.body.id))).body
				.error.code,
		).toBe("INVALID_PARENT");
		expect(
			(await as(VIC).send("post", path, exampleNode("x", req.id))).status,
		).toBe(403);
	});

	it("edits, reorders under its request only, and refuses fields of other kinds", async () => {
		const { id, req } = await withRequest();
		const other = await addNode(EVE, id, requestNode("Other"));
		const a = await addNode(EVE, id, exampleNode("A", req.id));
		const b = await addNode(EVE, id, exampleNode("B", req.id));
		const edited = await patchAs(EVE, `/collections/${id}/nodes/${a.id}`, {
			name: "Renamed",
			response: {
				...exampleNode("A", req.id).response,
				status: 404,
				statusText: "Not Found",
			},
		});
		expect(edited.body).toMatchObject({
			name: "Renamed",
			response: { status: 404 },
		});
		const wrong = await patchAs(EVE, `/collections/${id}/nodes/${a.id}`, {
			draft: draftOf("x"),
		});
		expect(wrong.body.error.code).toBe("INVALID_NODE_FIELDS");
		const away = await moveAsEve(id, a.id, {
			parentId: other.id,
			beforeOrder: null,
			afterOrder: null,
		});
		expect(away.body.error.code).toBe("INVALID_PARENT");
		const reorder = await moveAsEve(id, a.id, {
			parentId: req.id,
			beforeOrder: b.order,
			afterOrder: null,
		});
		expect(reorder.status).toBe(200);
		expect(reorder.body.order > b.order).toBe(true);
	});

	it("refuses bodies above the limit and counts toward the budget", async () => {
		const { id, req } = await withRequest();
		const before = (await CollectionModel.findById(id).lean())?.bytes ?? 0;
		await addNode(EVE, id, exampleNode("Big", req.id, "x".repeat(10_000)));
		const after = (await CollectionModel.findById(id).lean())?.bytes ?? 0;
		expect(after - before).toBeGreaterThan(10_000);
		// The limit counts UTF-8 bytes: half as many "é" already fill it.
		const path = `/collections/${id}/nodes`;
		const fits = exampleNode("Fits", req.id, "é".repeat(EXAMPLE_BODY_MAX / 2));
		expect((await as(EVE).send("post", path, fits)).status).toBe(201);
		const tooBig = exampleNode(
			"Huge",
			req.id,
			"é".repeat(EXAMPLE_BODY_MAX / 2 + 1),
		);
		const res = await as(EVE).send("post", path, tooBig);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
		const status = {
			...exampleNode("Bad", req.id),
			response: { ...exampleNode("Bad", req.id).response, status: 600 },
		};
		expect((await as(EVE).send("post", path, status)).status).toBe(400);
	});

	it("go with their request when it is deleted or duplicated, and stay out of search", async () => {
		const { id, req } = await withRequest();
		await addNode(EVE, id, exampleNode("Saved", req.id));
		const copy = await as(EVE).send(
			"post",
			`/collections/${id}/nodes/${req.id}/duplicate`,
		);
		expect(copy.body.nodes.map((n: { kind: string }) => n.kind)).toEqual([
			"request",
			"example",
		]);
		expect(copy.body.nodes[1].parentId).toBe(copy.body.nodes[0].id);
		const ws = (
			await CollectionModel.findById(id).lean()
		)?.workspaceId.toHexString();
		const found = await as(EVE).get(
			`/workspaces/${ws}/collections/search?q=saved`,
		);
		expect(found.body.matches).toEqual([]);
		const dry = await as(EVE).send(
			"delete",
			`/collections/${id}/nodes/${req.id}?dryRun=true`,
		);
		expect(dry.body).toMatchObject({ requests: 1, examples: 1, folders: 0 });
	});
});
