import type {
	CollectionNode,
	PullRequestDetail,
} from "@localman/shared/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, VIC, patchAs } from "../access/testing/access-fixture.js";
import {
	draftOf,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { UserModel } from "../users/user-model.js";
import { changedFork, open } from "./testing/pull-request-fixture.js";

useCollectionTestDb();

beforeEach(async () => {
	await UserModel.updateMany(
		{},
		{ $set: { plan: "pro", planExpiresAt: null } },
	);
});

const diffOf = (sub: string, pr: string, key: string) =>
	as(sub).get(`/pull-requests/${pr}/changes/${key}/diff`);
const urlOf = (item: unknown) => {
	const node = item as CollectionNode | null;
	return node?.kind === "request" ? node.draft.url : undefined;
};
const methodOf = (item: unknown) => {
	const node = item as CollectionNode | null;
	return node?.kind === "request" ? node.draft.method : undefined;
};
const detail = async (sub: string, pr: string) =>
	(await as(sub).get(`/pull-requests/${pr}`)).body as PullRequestDetail;

describe("the diff of a pull request change", () => {
	it("shows the source item now and as the merge would leave it", async () => {
		const { req, fork } = await changedFork();
		const pr = await open(fork);
		// A Viewer of the source reviews the content too.
		const res = await diffOf(VIC, pr.id, req);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(urlOf(res.body.before)).toBe("https://api.example.com");
		expect(urlOf(res.body.after)).toBe("https://api.example.com/v2");
	});

	it("answers 404 for a key that names no change, and once merged", async () => {
		const { req, fork } = await changedFork();
		const pr = await open(fork);
		const missing = await diffOf(ADA, pr.id, "nope");
		expect(missing.status).toBe(404);
		expect(missing.body.error.code).toBe("PULL_REQUEST_CHANGE_NOT_FOUND");
		// The collection itself is unchanged, and `constructor` is no item.
		expect((await diffOf(ADA, pr.id, "collection")).status).toBe(404);
		expect((await diffOf(ADA, pr.id, "constructor")).status).toBe(404);
		const merged = await as(ADA).send(
			"post",
			`/pull-requests/${pr.id}/merge`,
			{},
		);
		expect(merged.status, JSON.stringify(merged.body)).toBe(200);
		expect((await diffOf(ADA, pr.id, req)).status).toBe(404);
	});

	it("follows a pull of the source's updates while the pull request is open", async () => {
		const { source, req, fork } = await changedFork();
		const pr = await open(fork);
		await patchAs(ADA, `/collections/${source}`, {
			description: "from source",
		}).expect(200);
		const pull = await as(EVE).send("post", `/collections/${fork}/pull`, {});
		expect(pull.status, JSON.stringify(pull.body)).toBe(200);
		const after = await detail(ADA, pr.id);
		expect(after.status).toBe("open");
		// Pulled updates are no longer a change; the fork's own change stays.
		expect(after.preview?.changes.map((change) => change.key)).toEqual([req]);
		expect(urlOf((await diffOf(ADA, pr.id, req)).body.after)).toBe(
			"https://api.example.com/v2",
		);
		await patchAs(ADA, `/collections/${source}/nodes/${req}`, {
			draft: draftOf("List", { method: "POST" }),
		}).expect(200);
		// The source moved under the open pull request: before follows it,
		// and the fork's URL still comes along.
		const moved = (await diffOf(ADA, pr.id, req)).body;
		expect(methodOf(moved.before)).toBe("POST");
		expect(methodOf(moved.after)).toBe("POST");
		expect(urlOf(moved.after)).toBe("https://api.example.com/v2");
	});
});
