import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	notificationsOf,
	patchAs,
} from "../access/testing/access-fixture.js";
import { useCollectionTestDb } from "../collections/testing/collection-fixture.js";
import { UserModel } from "../users/user-model.js";
import { changedFork, open, review } from "./testing/pull-request-fixture.js";

useCollectionTestDb();

beforeEach(async () => {
	await UserModel.updateMany(
		{},
		{ $set: { plan: "pro", planExpiresAt: null } },
	);
});

const merge = (id: string, option = "merge") =>
	as(ADA).send("post", `/pull-requests/${id}/merge`, { option });

describe("pull requests from a fork the merger cannot open", () => {
	it("merge plainly; the options acting on the fork need it", async () => {
		const { source, fork } = await changedFork("personal");
		expect((await as(ADA).get(`/collections/${fork}`)).status).toBe(404);
		const pr = await open(fork);
		const detail = await as(ADA).get(`/pull-requests/${pr.id}`);
		expect(detail.body).toMatchObject({ canMerge: true });
		expect(detail.body.preview.changes).toHaveLength(1);
		expect((await merge(pr.id, "mergeAndUpdate")).status).toBe(404);
		const merged = await merge(pr.id);
		expect(merged.status, JSON.stringify(merged.body)).toBe(200);
		const after = await as(ADA).get(`/collections/${source}`);
		expect(JSON.stringify(after.body)).toContain("api.example.com/v2");
	});
});

describe("concurrent writes to a pull request", () => {
	it("keep a review and an edit made at once", async () => {
		const { fork } = await changedFork();
		const pr = await open(fork);
		const [reviewed, edited] = await Promise.all([
			review(ADA, pr.id, "approved"),
			patchAs(EVE, `/pull-requests/${pr.id}`, { title: "Use v2 paging" }),
		]);
		expect([reviewed.status, edited.status]).toEqual([200, 200]);
		const now = await as(EVE).get(`/pull-requests/${pr.id}`);
		expect(now.body).toMatchObject({
			title: "Use v2 paging",
			status: "approved",
		});
	});

	it("merge once when two merges race", async () => {
		const { fork } = await changedFork();
		const pr = await open(fork);
		const results = await Promise.all([merge(pr.id), merge(pr.id)]);
		expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
		const notices = (await notificationsOf(EVE)).filter(
			(item) => item.type === "pullRequest.merged",
		);
		expect(notices).toHaveLength(1);
	});

	it("do not merge a declined one", async () => {
		const { fork } = await changedFork();
		const pr = await open(fork);
		await review(ADA, pr.id, "declined").expect(200);
		const res = await merge(pr.id);
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("PULL_REQUEST_CLOSED");
	});

	it("tell a reviewer asked again only once", async () => {
		const { fork } = await changedFork();
		const pr = await open(fork);
		const path = `/pull-requests/${pr.id}`;
		await patchAs(EVE, path, { reviewerIds: [] }).expect(200);
		await patchAs(EVE, path, { reviewerIds: [ADA] }).expect(200);
		const opened = (await notificationsOf(ADA)).filter(
			(item) => item.type === "pullRequest.opened",
		);
		expect(opened).toHaveLength(1);
	});
});
