import type {
	CollectionDetail,
	PullRequestDetail,
} from "@localman/shared/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	VIC,
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

describe("pull requests", () => {
	it("asks Editors of the source to review and tells them", async () => {
		const { fork } = await changedFork();
		const candidates = await as(EVE).get(
			`/collections/${fork}/pull-request-reviewers`,
		);
		expect(
			candidates.body.items.map((item: { userId: string }) => item.userId),
		).toEqual([ADA]);
		const bad = await as(EVE).send(
			"post",
			`/collections/${fork}/pull-requests`,
			{ title: "x", reviewerIds: [VIC] },
		);
		expect(bad.status).toBe(400);
		expect(bad.body.error.code).toBe("INVALID_REVIEWER");
		const pr = await open(fork);
		expect(pr).toMatchObject({
			status: "open",
			authorName: "Eve",
			reviewers: [{ userId: ADA, decision: "pending" }],
			canEdit: true,
			canReview: false,
		});
		const notices = await notificationsOf(ADA);
		expect(notices.map((item) => item.type)).toEqual(["pullRequest.opened"]);
		expect(notices[0]?.link).toContain(`pr=${pr.id}`);
	});

	it("shows its changes, keyed for comments that stay off the collection panel", async () => {
		const { source, req, fork } = await changedFork();
		const pr = await open(fork);
		const detail = (await as(VIC).get(`/pull-requests/${pr.id}`))
			.body as PullRequestDetail;
		expect(detail.preview?.changes).toEqual([
			{ key: req, kind: "changed", entityKind: "request", name: "List" },
		]);
		const posted = await as(VIC).send(
			"post",
			`/pull-requests/${pr.id}/comments`,
			{ changeKey: req, body: "Why v2?" },
		);
		expect(posted.status, JSON.stringify(posted.body)).toBe(201);
		const reply = await as(EVE).send(
			"post",
			`/pull-requests/${pr.id}/comments`,
			{ threadId: posted.body.threadId, body: "New paging." },
		);
		expect(reply.status).toBe(201);
		const threads = (await as(ADA).get(`/pull-requests/${pr.id}/comments`)).body
			.threads;
		expect(threads).toHaveLength(1);
		expect(threads[0]).toMatchObject({ changeKey: req });
		expect(threads[0].comments).toHaveLength(2);
		const panel = await as(ADA).get(`/collections/${source}/comments`);
		expect(panel.body.threads).toEqual([]);
		const counts = await as(ADA).get(`/collections/${source}/comment-counts`);
		expect(counts.body.counts).toEqual({});
	});

	it("lets only reviewers decide and only the author edit", async () => {
		const { fork } = await changedFork();
		const pr = await open(fork);
		expect((await review(EVE, pr.id, "approved")).status).toBe(403);
		expect(
			(await patchAs(ADA, `/pull-requests/${pr.id}`, { title: "Mine" })).status,
		).toBe(403);
		const approved = await review(ADA, pr.id, "approved");
		expect(approved.body).toMatchObject({ status: "approved" });
		expect((await notificationsOf(EVE)).map((item) => item.type)).toEqual([
			"pullRequest.reviewed",
		]);
		const edited = await patchAs(EVE, `/pull-requests/${pr.id}`, {
			title: "Use v2 paging",
		});
		expect(edited.body).toMatchObject({
			title: "Use v2 paging",
			status: "approved",
		});
	});

	it("is closed by a decline", async () => {
		const { fork } = await changedFork();
		const pr = await open(fork);
		expect((await review(ADA, pr.id, "declined")).body.status).toBe("declined");
		const again = await review(ADA, pr.id, "approved");
		expect(again.status).toBe(409);
		expect(again.body.error.code).toBe("PULL_REQUEST_CLOSED");
		const detail = await as(ADA).get(`/pull-requests/${pr.id}`);
		expect(detail.body).toMatchObject({ preview: null, canMerge: false });
	});

	it("merges into the source without approval, once", async () => {
		const { source, req, fork } = await changedFork();
		const pr = await open(fork);
		expect(
			(await as(VIC).send("post", `/pull-requests/${pr.id}/merge`)).status,
		).toBe(403);
		const merged = await as(ADA).send("post", `/pull-requests/${pr.id}/merge`);
		expect(merged.status, JSON.stringify(merged.body)).toBe(200);
		expect(merged.body).toMatchObject({
			followUp: "none",
			pullRequest: { status: "merged", mergedByName: "Ada" },
		});
		const node = (
			(await as(ADA).get(`/collections/${source}`)).body as CollectionDetail
		).nodes.find((item) => item.id === req);
		expect(node?.kind === "request" && node.draft.url).toBe(
			"https://api.example.com/v2",
		);
		expect((await notificationsOf(EVE)).map((item) => item.type)).toEqual([
			"pullRequest.merged",
		]);
		const twice = await as(ADA).send("post", `/pull-requests/${pr.id}/merge`);
		expect(twice.status).toBe(409);
		const listed = await as(EVE).get(`/collections/${fork}/pull-requests`);
		expect(listed.body.items).toMatchObject([{ id: pr.id, status: "merged" }]);
	});

	it("needs Pro to open one", async () => {
		const { fork } = await changedFork();
		await UserModel.updateMany({}, { $set: { plan: "free" } });
		const res = await as(EVE).send(
			"post",
			`/collections/${fork}/pull-requests`,
			{
				title: "x",
			},
		);
		expect(res.status).toBe(403);
		expect(res.body.error.code).toBe("PLAN_FEATURE_UNAVAILABLE");
	});

	it("hides a pull request from people who cannot open its source", async () => {
		const { fork } = await changedFork();
		const pr = await open(fork);
		const outsider = await as("someone-else").get(`/pull-requests/${pr.id}`);
		expect(outsider.status).toBe(404);
		expect(outsider.body.error.code).toBe("PULL_REQUEST_NOT_FOUND");
	});
});
