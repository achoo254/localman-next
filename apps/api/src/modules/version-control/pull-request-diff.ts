import { OperationError, defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import type { CollectionState } from "../collections/revision-patch.js";
import { ROOT_KEY } from "./collection-merge.js";
import { PR_ACCESS } from "./pull-request-operations.js";
import { requirePullRequest } from "./pull-request-read.js";
import { liveMerge } from "./pull-request-sides.js";
import {
	PULL_REQUEST_PATH,
	pullRequestIdSchema,
} from "./pull-request-views-schema.js";
import { sameContent } from "./three-way-merge.js";

export interface PullRequestChangeDiff {
	/** The item in the source now; `null` when the pull request adds it. */
	before: unknown;
	/** The item as the merge would leave it; `null` when it removes it. */
	after: unknown;
}

function changeNotFound(): OperationError {
	return new OperationError(
		404,
		"PULL_REQUEST_CHANGE_NOT_FOUND",
		"This pull request has no such change now",
	);
}

/** The item under `key`; own keys only, so `constructor` names nothing. */
const itemOf = (state: CollectionState, key: string): unknown => {
	if (key === ROOT_KEY) return state.root;
	return Object.hasOwn(state.nodes, key) ? state.nodes[key] : null;
};

/**
 * One change of a live pull request, before and after, for anyone who can
 * see its changes (`changeKey` from its preview). 404 once it is merged or
 * declined, or when the key no longer names a change.
 */
export async function pullRequestChangeDiff(
	sub: string,
	id: string,
	changeKey: string,
): Promise<PullRequestChangeDiff> {
	const { pr, source } = await requirePullRequest(sub, id);
	const live = await liveMerge(sub, pr, source);
	if (!live) throw changeNotFound();
	const before = itemOf(live.states.source, changeKey);
	const after = itemOf(live.merge.state, changeKey);
	if (sameContent(before, after)) throw changeNotFound();
	return { before, after };
}

export const getPullRequestChangeDiffOperation = defineOperation({
	id: "client.getPullRequestChangeDiff",
	method: "GET",
	path: `${PULL_REQUEST_PATH}/changes/:changeKey/diff`,
	summary: "Get one change of a pull request, before and after",
	description: `\`changeKey\` is the \`key\` of a change in get_pull_request. \`before\` is the item in the source now (\`null\` when added), \`after\` the item as merging would leave it (\`null\` when removed). 404 PULL_REQUEST_CHANGE_NOT_FOUND once merged or declined, or when the key names no change now. ${PR_ACCESS}`,
	input: z.object({
		pullRequestId: pullRequestIdSchema,
		changeKey: z.string().min(1).max(200),
	}),
	output: z.object({ before: z.unknown(), after: z.unknown() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		pullRequestChangeDiff(
			requireSubject(ctx),
			input.pullRequestId,
			input.changeKey,
		),
});
