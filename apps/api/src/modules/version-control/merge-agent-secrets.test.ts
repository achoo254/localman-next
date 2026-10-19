import type { AnyOperation } from "@localman/operations";
import type {
	CollectionDetail,
	MergePreview,
	PullRequestDetail,
} from "@localman/shared/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, patchAs } from "../access/testing/access-fixture.js";
import {
	draftOf,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { callAsAgent } from "../environments/testing/agent-caller.js";
import { UserModel } from "../users/user-model.js";
import { forkOperations } from "./fork-operations.js";
import { getPullRequestChangeDiffOperation } from "./pull-request-diff.js";
import { getPullRequestOperation } from "./pull-request-operations.js";
import { changedFork, open } from "./testing/pull-request-fixture.js";

useCollectionTestDb();

beforeEach(async () => {
	await UserModel.updateMany(
		{},
		{ $set: { plan: "pro", planExpiresAt: null } },
	);
});

const SOURCE_SECRET = "source-s3cret-41b7";
const FORK_SECRET = "fork-s3cret-c09e";

function operation(id: string): AnyOperation {
	const op = forkOperations.find((item) => item.id === id);
	if (!op) throw new Error(`No operation ${id}`);
	return op;
}

const setSecret = (sub: string, collection: string, value: string) =>
	patchAs(sub, `/collections/${collection}`, {
		variables: [
			{ key: "baseUrl", value: "https://api.example.com" },
			{ key: "token", value, secret: true },
		],
	}).expect(200);

function expectNone(output: unknown, ...secrets: string[]): void {
	const json = JSON.stringify(output);
	for (const secret of secrets) expect(json).not.toContain(secret);
}

describe("merge views read by an agent", () => {
	it("blanks secret variables in a pull request's root diff", async () => {
		const { fork } = await changedFork();
		await setSecret(EVE, fork, FORK_SECRET);
		const pr = await open(fork);
		const input = { pullRequestId: pr.id, changeKey: "collection" };
		const web = await as(ADA).get(
			`/pull-requests/${pr.id}/changes/collection/diff`,
		);
		expect(web.status, JSON.stringify(web.body)).toBe(200);
		expect(JSON.stringify(web.body.after)).toContain(FORK_SECRET);
		const agent = await callAsAgent(
			getPullRequestChangeDiffOperation,
			ADA,
			input,
		);
		expectNone(agent, FORK_SECRET);
		// The rest of the root still reads as it is.
		expect(JSON.stringify(agent)).toContain("https://api.example.com");
	});

	it("blanks secret variables in previews and pull request conflicts", async () => {
		const { source, fork } = await changedFork();
		await setSecret(ADA, source, SOURCE_SECRET);
		await setSecret(EVE, fork, FORK_SECRET);
		const pr = await open(fork);
		const views: { op: AnyOperation; sub: string; input: object }[] = [
			{
				op: operation("client.previewCollectionPull"),
				sub: EVE,
				input: { collectionId: fork },
			},
			{
				op: operation("client.previewCollectionMerge"),
				sub: ADA,
				input: { collectionId: fork },
			},
			{
				op: getPullRequestOperation,
				sub: ADA,
				input: { pullRequestId: pr.id },
			},
		];
		for (const { op, sub, input } of views) {
			const agent = await callAsAgent(op, sub, input);
			expectNone(agent, SOURCE_SECRET, FORK_SECRET);
			const preview =
				"preview" in (agent as object)
					? (agent as PullRequestDetail).preview
					: (agent as MergePreview);
			expect(preview?.conflicts.map((item) => item.path)).toEqual([
				"variables",
			]);
		}
		// The web app still shows both sides of the conflict.
		const pull = await as(EVE).get(`/collections/${fork}/pull`);
		const detail = await as(ADA).get(`/pull-requests/${pr.id}`);
		for (const body of [pull.body, detail.body]) {
			expect(JSON.stringify(body)).toContain(SOURCE_SECRET);
			expect(JSON.stringify(body)).toContain(FORK_SECRET);
		}
	});

	it("blanks typed-in auth in pull request diffs, previews and conflicts", async () => {
		const { source, req, fork } = await changedFork();
		const bearer = (token: string) => ({ type: "bearer", token });
		await patchAs(ADA, `/collections/${source}`, {
			auth: bearer("source-auth-2d8e"),
		}).expect(200);
		await patchAs(EVE, `/collections/${fork}`, {
			auth: bearer("fork-auth-77b0"),
		}).expect(200);
		const forkDetail = (await as(EVE).get(`/collections/${fork}`))
			.body as CollectionDetail;
		const forkReq = forkDetail.nodes.find((node) => node.name === "List");
		await patchAs(EVE, `/collections/${fork}/nodes/${forkReq?.id ?? ""}`, {
			draft: draftOf("List", {
				url: "https://api.example.com/v2",
				auth: { type: "bearer", token: "fork-request-auth-31c4" },
			}),
		}).expect(200);
		const pr = await open(fork);
		const typed = [
			"source-auth-2d8e",
			"fork-auth-77b0",
			"fork-request-auth-31c4",
		];
		const agentViews = [
			await callAsAgent(getPullRequestChangeDiffOperation, ADA, {
				pullRequestId: pr.id,
				changeKey: req,
			}),
			await callAsAgent(operation("client.previewCollectionPull"), EVE, {
				collectionId: fork,
			}),
			await callAsAgent(operation("client.previewCollectionMerge"), ADA, {
				collectionId: fork,
			}),
			await callAsAgent(getPullRequestOperation, ADA, { pullRequestId: pr.id }),
		];
		for (const view of agentViews) expectNone(view, ...typed);
		const diff = await as(ADA).get(
			`/pull-requests/${pr.id}/changes/${req}/diff`,
		);
		expect(JSON.stringify(diff.body)).toContain("fork-request-auth-31c4");
		const detail = JSON.stringify(
			(await as(ADA).get(`/pull-requests/${pr.id}`)).body,
		);
		expect(detail).toContain("source-auth-2d8e");
		expect(detail).toContain("fork-auth-77b0");
	});
});
