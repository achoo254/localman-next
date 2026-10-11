import { emptyRequestBody } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, patchAs } from "../access/testing/access-fixture.js";
import { COLLECTION_BYTES_MAX, nodeBytes } from "./collection-bytes.js";
import { CollectionModel } from "./collection-model.js";
import { createCollection } from "./collection-service.js";
import {
	addNode,
	createAs,
	draftOf,
	emptyCollection,
	folder,
	requestNode,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

async function rootStats(id: string) {
	const root = await CollectionModel.findById(id).lean();
	return { bytes: root?.bytes ?? 0, requests: root?.requestCount ?? 0 };
}

const nearlyFull = (id: string, room: number) =>
	CollectionModel.updateOne(
		{ _id: id },
		{ $set: { bytes: COLLECTION_BYTES_MAX - room } },
	);

describe("collection byte budget", () => {
	it("keeps bytes and the request count current through node writes", async () => {
		const id = await emptyCollection();
		const empty = await rootStats(id);
		expect(empty.bytes).toBeGreaterThan(0);
		const dir = await addNode(EVE, id, folder("Dir"));
		const req = await addNode(EVE, id, requestNode("Req", dir.id));
		const grown = await rootStats(id);
		expect(grown.requests).toBe(1);
		const body = {
			...emptyRequestBody(),
			type: "raw" as const,
			raw: "x".repeat(1000),
		};
		const before = {
			kind: "request" as const,
			name: "Req",
			description: "",
			draft: draftOf("Req"),
		};
		const after = { ...before, draft: draftOf("Req", { body }) };
		await patchAs(EVE, `/collections/${id}/nodes/${req.id}`, {
			draft: after.draft,
		});
		const delta = nodeBytes(after) - nodeBytes(before);
		expect(delta).toBeGreaterThan(1000 - 10);
		expect((await rootStats(id)).bytes).toBe(grown.bytes + delta);
		await as(EVE).send("delete", `/collections/${id}/nodes/${dir.id}`);
		expect(await rootStats(id)).toEqual(empty);
		const listed = await as(EVE).get(
			`/workspaces/${(await CollectionModel.findById(id).lean())?.workspaceId}/collections`,
		);
		expect(listed.body.items[0].requestCount).toBe(0);
	});

	it("rejects node and root writes past the budget with 413", async () => {
		const id = await emptyCollection();
		const req = await addNode(EVE, id, requestNode("Req"));
		await nearlyFull(id, 10);
		const created = await as(EVE).send(
			"post",
			`/collections/${id}/nodes`,
			requestNode("More"),
		);
		expect(created.status).toBe(413);
		expect(created.body.error.code).toBe("COLLECTION_TOO_LARGE");
		const bigger = draftOf("Req", {
			url: `https://api.example.com/${"a".repeat(100)}`,
		});
		const updated = await patchAs(EVE, `/collections/${id}/nodes/${req.id}`, {
			draft: bigger,
		});
		expect(updated.body.error.code).toBe("COLLECTION_TOO_LARGE");
		const root = await patchAs(EVE, `/collections/${id}`, {
			description: "d".repeat(100),
		});
		expect(root.body.error.code).toBe("COLLECTION_TOO_LARGE");
		// Shrinking is always allowed, even over the budget.
		expect(
			(await patchAs(EVE, `/collections/${id}`, { name: "N" })).status,
		).toBe(200);
		expect(
			(await as(EVE).send("delete", `/collections/${id}/nodes/${req.id}`))
				.status,
		).toBe(200);
		expect(
			(await as(EVE).send("post", `/collections/${id}/nodes`, folder("Fits")))
				.status,
		).toBe(201);
	});

	it("counts an imported tree up front", async () => {
		const ws = (await teamOfThree()).toHexString();
		const raw = "x".repeat(1_000_000);
		const items = Array.from({ length: 22 }, (_, index) => ({
			kind: "request" as const,
			id: `r${index}`,
			name: `R${index}`,
			description: "",
			examples: [],
			draft: draftOf(`R${index}`, {
				body: { ...emptyRequestBody(), type: "raw", raw },
			}),
		}));
		const tree = {
			name: "Huge",
			description: "",
			auth: { type: "none" as const },
			variables: [],
			scripts: { pre: "", post: "" },
			tags: [],
			status: null,
			items,
		};
		await expect(createCollection(EVE, ws, { tree })).rejects.toMatchObject({
			status: 413,
			code: "COLLECTION_TOO_LARGE",
		});
		expect(await CollectionModel.countDocuments()).toBe(0);
		const small = await createAs(EVE, ws, {
			tree: { ...tree, items: items.slice(0, 2) },
		});
		expect((await rootStats(small.id)).requests).toBe(2);
	});
});
