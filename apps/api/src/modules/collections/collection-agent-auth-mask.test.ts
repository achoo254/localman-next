import type {
	CollectionDetail,
	CollectionNode,
	RequestAuth,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, patchAs } from "../access/testing/access-fixture.js";
import { callAsAgent } from "../environments/testing/agent-caller.js";
import { getCollectionChangeDiffOperation } from "./changelog-operations.js";
import { duplicateCollectionNodeOperation } from "./collection-node-batch-operations.js";
import {
	createCollectionNodeOperation,
	updateCollectionNodeOperation,
} from "./collection-node-operations.js";
import { getCollectionOperation } from "./collection-read-operations.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import {
	duplicateCollectionOperation,
	updateCollectionOperation,
} from "./collection-write-operations.js";
import {
	addNode,
	draftOf,
	exampleNode,
	folder,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const ROOT = "root-bearer-c7a1";
const FOLDER = "folder-pass-9d02";
const REQUEST = "request-apikey-5be3";
const EXAMPLE = "example-bearer-0f6c";
const ALL = [ROOT, FOLDER, REQUEST, EXAMPLE];
const REFERENCE = "{{token}}";

/** Eve's collection with a credential typed into every kind of auth. */
async function authCollection() {
	const ws = (await teamOfThree()).toHexString();
	const created = await as(EVE).send("post", `/workspaces/${ws}/collections`, {
		name: "Orders",
	});
	const id: string = created.body.id;
	await patchAs(EVE, `/collections/${id}`, {
		auth: { type: "bearer", token: ROOT },
	}).expect(200);
	const folderId = (await addNode(EVE, id, folder("Admin"))).id;
	await patchAs(EVE, `/collections/${id}/nodes/${folderId}`, {
		auth: { type: "basic", username: "ops", password: FOLDER },
	}).expect(200);
	const apiKey: RequestAuth = {
		type: "apikey",
		key: "X-Key",
		value: REQUEST,
		in: "header",
	};
	const requestId = (
		await addNode(EVE, id, {
			kind: "request",
			parentId: folderId,
			name: "List",
			draft: draftOf("List", { auth: apiKey }),
		})
	).id;
	await addNode(EVE, id, {
		kind: "request",
		parentId: null,
		name: "Ref",
		draft: draftOf("Ref", { auth: { type: "bearer", token: REFERENCE } }),
	});
	const exampleId = (
		await addNode(EVE, id, {
			...exampleNode("Ok", requestId),
			request: draftOf("Ok", { auth: { type: "bearer", token: EXAMPLE } }),
		})
	).id;
	return { ws, id, folderId, requestId, exampleId };
}

const browserJson = async (id: string): Promise<string> =>
	JSON.stringify((await as(EVE).get(`/collections/${id}`)).body);

function expectNone(output: unknown): void {
	const json = JSON.stringify(output);
	for (const value of ALL) expect(json).not.toContain(value);
}

const nodeOf = (detail: CollectionDetail, nodeId: string): CollectionNode => {
	const node = detail.nodes.find((item) => item.id === nodeId);
	if (!node) throw new Error(`No node ${nodeId}`);
	return node;
};

describe("auth typed into a collection, read by an agent", () => {
	it("is blanked in collections, nodes and diffs; references stay", async () => {
		const { ws, id, requestId } = await authCollection();
		const read = await callAsAgent(getCollectionOperation, EVE, {
			collectionId: id,
		});
		expectNone(read);
		expect(JSON.stringify(read)).toContain(REFERENCE);
		expectNone(
			await callAsAgent(duplicateCollectionOperation, EVE, {
				collectionId: id,
				workspaceId: ws,
			}),
		);
		expectNone(
			await callAsAgent(duplicateCollectionNodeOperation, EVE, {
				collectionId: id,
				nodeId: requestId,
			}),
		);
		const revisions = await CollectionRevisionModel.find({ collectionId: id });
		expect(revisions.length).toBeGreaterThan(4);
		for (const revision of revisions) {
			const diff = await callAsAgent(getCollectionChangeDiffOperation, EVE, {
				collectionId: id,
				revisionId: revision._id.toHexString(),
			});
			expect(diff).toMatchObject({ available: true });
			expectNone(diff);
		}
		const browser = await browserJson(id);
		for (const value of ALL) expect(browser).toContain(value);
	});

	it("is blanked in what a node write returns, and stored as sent", async () => {
		const { id } = await authCollection();
		const created = (await callAsAgent(createCollectionNodeOperation, EVE, {
			collectionId: id,
			kind: "request",
			parentId: null,
			name: "New",
			draft: draftOf("New", { auth: { type: "bearer", token: "new-9e1d" } }),
		})) as CollectionNode;
		expect(JSON.stringify(created)).not.toContain("new-9e1d");
		expect(await browserJson(id)).toContain("new-9e1d");
	});
});

describe("auth written back by an agent", () => {
	it("keeps the stored value when sent back blank", async () => {
		const fixture = await authCollection();
		const { id } = fixture;
		const read = (await callAsAgent(getCollectionOperation, EVE, {
			collectionId: id,
		})) as CollectionDetail;
		await callAsAgent(updateCollectionOperation, EVE, {
			collectionId: id,
			auth: read.auth,
			description: "edited by an agent",
		});
		const update = (nodeId: string, fields: object) =>
			callAsAgent(updateCollectionNodeOperation, EVE, {
				collectionId: id,
				nodeId,
				...fields,
			});
		const folderNode = nodeOf(read, fixture.folderId);
		const requestNode = nodeOf(read, fixture.requestId);
		const example = nodeOf(read, fixture.exampleId);
		if (folderNode.kind !== "folder") throw new Error("not a folder");
		if (requestNode.kind !== "request") throw new Error("not a request");
		if (example.kind !== "example") throw new Error("not an example");
		await update(fixture.folderId, { auth: folderNode.auth });
		const edited = await update(fixture.requestId, {
			draft: { ...requestNode.draft, url: "https://api.example.com/v3" },
		});
		expectNone(edited);
		await update(fixture.exampleId, { request: example.request });
		const browser = await browserJson(id);
		for (const value of ALL) expect(browser).toContain(value);
		expect(browser).toContain("https://api.example.com/v3");
	});

	it("takes a real new value; a browser blank still clears", async () => {
		const { id, requestId } = await authCollection();
		await callAsAgent(updateCollectionOperation, EVE, {
			collectionId: id,
			auth: { type: "bearer", token: "rotated-root" },
		});
		await patchAs(EVE, `/collections/${id}/nodes/${requestId}`, {
			draft: draftOf("List", {
				auth: { type: "apikey", key: "X-Key", value: "", in: "header" },
			}),
		}).expect(200);
		const browser = await browserJson(id);
		expect(browser).toContain("rotated-root");
		expect(browser).not.toContain(ROOT);
		expect(browser).not.toContain(REQUEST);
	});
});
