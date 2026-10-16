import type { CollectionDetail } from "@localman/shared/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, patchAs } from "../access/testing/access-fixture.js";
import {
	addNode,
	createAs,
	draftOf,
	teamOfThree,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { UserModel } from "../users/user-model.js";

useCollectionTestDb();

beforeEach(async () => {
	await UserModel.updateMany(
		{},
		{ $set: { plan: "pro", planExpiresAt: null } },
	);
});

async function forked() {
	const ws = (await teamOfThree()).toHexString();
	const source = await createAs(ADA, ws, { name: "Orders API" });
	const req = await addNode(ADA, source.id, {
		kind: "request",
		parentId: null,
		name: "List",
		draft: draftOf("List"),
	});
	const res = await as(EVE).send("post", `/collections/${source.id}/forks`, {
		label: "eve",
		workspaceId: ws,
	});
	const fork = res.body as CollectionDetail;
	return {
		source: source.id,
		req: req.id,
		fork: fork.id,
		forkReq: fork.nodes[0]?.id ?? "",
	};
}

const setUrl = (sub: string, id: string, node: string, url: string) =>
	patchAs(sub, `/collections/${id}/nodes/${node}`, {
		draft: draftOf("List", { url }),
	});
const names = async (sub: string, id: string) =>
	(
		(await as(sub).get(`/collections/${id}`)).body as CollectionDetail
	).nodes.map((node) => node.name);
const sync = (
	sub: string,
	id: string,
	direction: "pull" | "merge",
	resolutions = {},
) => as(sub).send("post", `/collections/${id}/${direction}`, { resolutions });
const changes = async (sub: string, id: string, direction: "pull" | "merge") =>
	(await as(sub).get(`/collections/${id}/${direction}`)).body.changes;

describe("a node one side deleted and the other kept", () => {
	it("merged back once, stays one node in the source", async () => {
		const { source, req, fork, forkReq } = await forked();
		await as(ADA).send("delete", `/collections/${source}/nodes/${req}`);
		await setUrl(EVE, fork, forkReq, "https://one");
		expect((await sync(ADA, fork, "merge", { [req]: "source" })).status).toBe(
			200,
		);
		expect(await names(ADA, source)).toEqual(["List"]);
		await setUrl(EVE, fork, forkReq, "https://two");
		const again = await sync(ADA, fork, "merge");
		expect(again.status, JSON.stringify(again.body)).toBe(200);
		expect(await names(ADA, source)).toEqual(["List"]);
		expect(await changes(EVE, fork, "pull")).toEqual([]);
	});

	it("pulled back once, is not removed from the source by the next merge", async () => {
		const { source, req, fork, forkReq } = await forked();
		await as(EVE).send("delete", `/collections/${fork}/nodes/${forkReq}`);
		await setUrl(ADA, source, req, "https://edited");
		expect((await sync(EVE, fork, "pull", { [req]: "source" })).status).toBe(
			200,
		);
		expect(await names(EVE, fork)).toEqual(["List"]);
		expect(await changes(ADA, fork, "merge")).toEqual([]);
		expect((await sync(ADA, fork, "merge")).status).toBe(200);
		expect(await names(ADA, source)).toEqual(["List"]);
	});
});
