import type {
	CollectionDetail,
	MergePreview,
} from "@localman/shared/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	VIC,
	patchAs,
	personalWorkspace,
} from "../access/testing/access-fixture.js";
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

/** A team collection by Ada with one request, forked by Eve into the team. */
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
		label: "eve-fork",
		workspaceId: ws,
	});
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	const fork = res.body as CollectionDetail;
	const forkReq = fork.nodes.find((node) => node.name === "List");
	return {
		ws,
		source: source.id,
		req: req.id,
		fork: fork.id,
		forkReq: forkReq?.id ?? "",
	};
}

const setUrl = (
	sub: string,
	id: string,
	node: string,
	url: string,
	name = "List",
) =>
	patchAs(sub, `/collections/${id}/nodes/${node}`, {
		draft: draftOf(name, { url }),
	});
const detail = async (sub: string, id: string) =>
	(await as(sub).get(`/collections/${id}`)).body as CollectionDetail;
const preview = async (
	sub: string,
	id: string,
	direction: "pull" | "merge",
) => {
	const res = await as(sub).get(`/collections/${id}/${direction}`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body as MergePreview;
};

describe("forking a collection", () => {
	it("needs Pro", async () => {
		await UserModel.updateMany({}, { $set: { plan: "free" } });
		const ws = (await teamOfThree()).toHexString();
		const source = await createAs(ADA, ws);
		const res = await as(EVE).send("post", `/collections/${source.id}/forks`, {
			label: "x",
			workspaceId: ws,
		});
		expect(res.status).toBe(403);
		expect(res.body.error.code).toBe("PLAN_FEATURE_UNAVAILABLE");
	});

	it("links the copy to its source, which counts and lists it", async () => {
		const { source, fork } = await forked();
		const status = await as(EVE).get(`/collections/${fork}/fork-status`);
		expect(status.body.fork).toMatchObject({
			label: "eve-fork",
			createdByName: "Eve",
			source: { id: source, name: "Orders API", available: true },
		});
		expect(
			(await as(ADA).get(`/collections/${source}/fork-status`)).body.forkCount,
		).toBe(1);
		const list = await as(ADA).get(`/collections/${source}/forks`);
		expect(list.body.items).toMatchObject([
			{ forkId: fork, label: "eve-fork", canOpen: true },
		]);
		expect((await detail(EVE, fork)).name).toBe("Orders API");
	});

	it("lets a Viewer fork into their personal workspace only", async () => {
		const { ws, source } = await forked();
		const team = await as(VIC).send("post", `/collections/${source}/forks`, {
			label: "v",
			workspaceId: ws,
		});
		expect(team.status).toBe(403);
		expect(team.body.error.code).toBe("FORK_TARGET_NOT_ALLOWED");
		const own = (await personalWorkspace(VIC)).toHexString();
		const res = await as(VIC).send("post", `/collections/${source}/forks`, {
			label: "v",
			workspaceId: own,
		});
		expect(res.status).toBe(201);
		const merge = await as(VIC).send(
			"post",
			`/collections/${res.body.id}/merge`,
			{},
		);
		expect(merge.status).toBe(403);
	});
});

describe("pulling and merging", () => {
	it("pulls the source's change next to the fork's own", async () => {
		const { source, req, fork, forkReq } = await forked();
		await setUrl(ADA, source, req, "https://source.example");
		await patchAs(EVE, `/collections/${fork}`, { description: "fork notes" });
		const view = await preview(EVE, fork, "pull");
		expect(view.conflicts).toEqual([]);
		expect(view.changes).toEqual([
			{ kind: "changed", entityKind: "request", name: "List" },
		]);
		expect(
			(await as(EVE).send("post", `/collections/${fork}/pull`, {})).status,
		).toBe(200);
		const after = await detail(EVE, fork);
		expect(after.description).toBe("fork notes");
		const node = after.nodes.find((item) => item.id === forkReq);
		expect(node?.kind === "request" && node.draft.url).toBe(
			"https://source.example",
		);
		expect((await preview(EVE, fork, "pull")).changes).toEqual([]);
	});

	it("asks for a choice when both sides changed the same field", async () => {
		const { source, req, fork, forkReq } = await forked();
		await setUrl(ADA, source, req, "https://source.example");
		await setUrl(EVE, fork, forkReq, "https://fork.example");
		const view = await preview(EVE, fork, "pull");
		expect(
			view.conflicts.map((c) => [c.id, c.path, c.source, c.destination]),
		).toEqual([
			[
				`${req}:draft.url`,
				"draft.url",
				"https://source.example",
				"https://fork.example",
			],
		]);
		const open = await as(EVE).send("post", `/collections/${fork}/pull`, {});
		expect(open.status).toBe(409);
		expect(open.body.error.code).toBe("MERGE_CONFLICTS");
		const done = await as(EVE).send("post", `/collections/${fork}/pull`, {
			resolutions: { [`${req}:draft.url`]: "destination" },
		});
		expect(done.status).toBe(200);
		const node = (await detail(EVE, fork)).nodes.find(
			(item) => item.id === forkReq,
		);
		expect(node?.kind === "request" && node.draft.url).toBe(
			"https://fork.example",
		);
	});

	it("merges new and deleted requests into the source, recorded as one change", async () => {
		const { source, req, fork, forkReq } = await forked();
		await addNode(EVE, fork, {
			kind: "request",
			parentId: null,
			name: "Create",
			draft: draftOf("Create"),
		});
		await as(EVE).send("delete", `/collections/${fork}/nodes/${forkReq}`);
		const view = await preview(ADA, fork, "merge");
		expect(view.changes.map((c) => [c.kind, c.name]).sort()).toEqual([
			["added", "Create"],
			["removed", "List"],
		]);
		expect(
			(await as(ADA).send("post", `/collections/${fork}/merge`, {})).status,
		).toBe(200);
		const after = await detail(ADA, source);
		expect(after.nodes.map((node) => node.name)).toEqual(["Create"]);
		expect(after.nodes.some((node) => node.id === req)).toBe(false);
		const log = await as(ADA).get(`/collections/${source}/changelog`);
		expect(log.body.sessions[0].changes[0]).toMatchObject({
			action: "merge",
			entityName: "eve-fork",
		});
		// Nothing left to merge, and the fork does not see its own change as new.
		expect((await preview(ADA, fork, "merge")).changes).toEqual([]);
		expect((await preview(EVE, fork, "pull")).changes).toEqual([]);
	});

	it("updates the fork with mergeAndUpdate and trashes it with mergeAndDelete", async () => {
		const { source, req, fork } = await forked();
		await setUrl(ADA, source, req, "https://source.example");
		await patchAs(EVE, `/collections/${fork}`, { description: "from fork" });
		const res = await as(EVE).send("post", `/collections/${fork}/merge`, {
			option: "mergeAndUpdate",
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect((await detail(ADA, source)).description).toBe("from fork");
		const forkNode = (await detail(EVE, fork)).nodes[0];
		expect(forkNode?.kind === "request" && forkNode.draft.url).toBe(
			"https://source.example",
		);
		await patchAs(EVE, `/collections/${fork}`, { description: "last" });
		const del = await as(EVE).send("post", `/collections/${fork}/merge`, {
			option: "mergeAndDelete",
		});
		expect(del.status).toBe(200);
		expect((await as(EVE).get(`/collections/${fork}`)).status).toBe(404);
		expect((await detail(ADA, source)).description).toBe("last");
	});

	it("keeps a fork whose source is gone, and refuses to sync it", async () => {
		const { source, fork } = await forked();
		await as(ADA).send("delete", `/collections/${source}`, {
			confirm: "delete",
		});
		await as(ADA).send("delete", `/trash/collections/${source}`);
		const status = await as(EVE).get(`/collections/${fork}/fork-status`);
		expect(status.body.fork.source).toMatchObject({
			name: null,
			available: false,
		});
		const pull = await as(EVE).get(`/collections/${fork}/pull`);
		expect(pull.status).toBe(404);
		expect(pull.body.error.code).toBe("FORK_SOURCE_UNAVAILABLE");
	});
});
