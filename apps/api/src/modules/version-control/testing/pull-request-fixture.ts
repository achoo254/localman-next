import type {
	CollectionDetail,
	PullRequestView,
} from "@localman/shared/api-client";
import { expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	patchAs,
	personalWorkspace,
} from "../../access/testing/access-fixture.js";
import {
	addNode,
	createAs,
	draftOf,
	teamOfThree,
} from "../../collections/testing/collection-fixture.js";

/**
 * Ada's team collection with one request, forked by Eve, whose fork
 * changes the request's URL; the fork is in the team, or in Eve's
 * personal workspace where Ada cannot open it.
 */
export async function changedFork(where: "team" | "personal" = "team") {
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
		workspaceId:
			where === "team" ? ws : (await personalWorkspace(EVE)).toHexString(),
	});
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	const fork = res.body as CollectionDetail;
	const forkReq = fork.nodes.find((node) => node.name === "List")?.id ?? "";
	await patchAs(EVE, `/collections/${fork.id}/nodes/${forkReq}`, {
		draft: draftOf("List", { url: "https://api.example.com/v2" }),
	}).expect(200);
	return { source: source.id, req: req.id, fork: fork.id };
}

/** Eve opens "Use v2" from the fork, asking `reviewerIds`. */
export async function open(fork: string, reviewerIds: string[] = [ADA]) {
	const res = await as(EVE).send("post", `/collections/${fork}/pull-requests`, {
		title: "Use v2",
		description: "Moves **List** to v2.",
		reviewerIds,
	});
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return res.body as PullRequestView;
}

export const review = (sub: string, id: string, decision: string) =>
	as(sub).send("put", `/pull-requests/${id}/review`, { decision });
