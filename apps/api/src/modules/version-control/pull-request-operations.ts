import { defineOperation } from "@localman/operations";
import { z } from "zod";
import {
	USER_SCOPE,
	isAgentCall,
	requireSubject,
} from "../../http/require-auth.js";
import {
	ACCESS_NOTE,
	COLLECTION_PATH,
	collectionIdSchema,
} from "../collections/collection-read-operations.js";
import { mergeOptionSchema, resolutionsSchema } from "./fork-views-schema.js";
import { AGENT_PREVIEW, withholdPreviewSecrets } from "./merge-views.js";
import { reviewerCandidates } from "./pull-request-people.js";
import { getPullRequest, listPullRequests } from "./pull-request-read.js";
import {
	createPullRequest,
	mergePullRequest,
	reviewPullRequest,
	updatePullRequest,
} from "./pull-request-service.js";
import {
	PULL_REQUEST_PATH,
	descriptionSchema,
	pullRequestDetailView,
	pullRequestIdSchema,
	pullRequestListView,
	pullRequestView,
	reviewerIdsSchema,
	reviewerListView,
	titleSchema,
} from "./pull-request-views-schema.js";

export const PR_ACCESS =
	"404 PULL_REQUEST_NOT_FOUND when it does not exist or the caller cannot open its source collection.";
const CLOSED = "409 PULL_REQUEST_CLOSED once it is merged or declined.";

export const createPullRequestOperation = defineOperation({
	id: "client.createPullRequest",
	method: "POST",
	path: `${COLLECTION_PATH}/pull-requests`,
	summary: "Open a pull request from a collection fork into its source",
	description: `\`collectionId\` is the fork; Editors of it, Pro only (403 PLAN_FEATURE_UNAVAILABLE). \`reviewerIds\` (from list_pull_request_reviewers) must be Editors of the source (400 INVALID_REVIEWER); they are told and only they approve or decline. Approval is not required to merge. A fork may have several open pull requests. 404 FORK_NOT_FOUND when it is not a fork. ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		title: titleSchema,
		description: descriptionSchema.default(""),
		reviewerIds: reviewerIdsSchema.default([]),
	}),
	output: pullRequestView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) =>
		createPullRequest(requireSubject(ctx), input.collectionId, input),
});

export const listPullRequestsOperation = defineOperation({
	id: "client.listPullRequests",
	method: "GET",
	path: `${COLLECTION_PATH}/pull-requests`,
	summary: "List the pull requests into or out of a collection",
	description: `Newest first, at most 100: those into the collection (it is their source) and those from it (it is their fork). ${ACCESS_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema }),
	output: pullRequestListView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => ({
		items: await listPullRequests(requireSubject(ctx), input.collectionId),
	}),
});

export const listPullRequestReviewersOperation = defineOperation({
	id: "client.listPullRequestReviewers",
	method: "GET",
	path: `${COLLECTION_PATH}/pull-request-reviewers`,
	summary: "List who a pull request from a fork can ask to review",
	description: `Editors of the fork's source, except the caller. Editors of the fork, Pro only. ${ACCESS_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema }),
	output: reviewerListView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => ({
		items: await reviewerCandidates(requireSubject(ctx), input.collectionId),
	}),
});

export const getPullRequestOperation = defineOperation({
	id: "client.getPullRequest",
	method: "GET",
	path: PULL_REQUEST_PATH,
	summary: "Get a pull request with its changes",
	description: `\`preview\` is what merging it would do now (changes, conflicts with their ids for \`resolutions\`); \`null\` once merged or declined, or when the fork is gone. Each change has a \`key\` that pull request comments use as \`changeKey\`. ${AGENT_PREVIEW} ${PR_ACCESS}`,
	input: z.object({ pullRequestId: pullRequestIdSchema }),
	output: pullRequestDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => {
		const detail = await getPullRequest(
			requireSubject(ctx),
			input.pullRequestId,
		);
		return isAgentCall(ctx) && detail.preview
			? { ...detail, preview: withholdPreviewSecrets(detail.preview) }
			: detail;
	},
});

export const updatePullRequestOperation = defineOperation({
	id: "client.updatePullRequest",
	method: "PATCH",
	path: PULL_REQUEST_PATH,
	summary: "Edit the title, description or reviewers of your pull request",
	description: `Only its author (403 otherwise). \`reviewerIds\` replaces the list; reviewers kept keep their decision, new ones are told. ${CLOSED} ${PR_ACCESS}`,
	input: z.object({
		pullRequestId: pullRequestIdSchema,
		title: titleSchema.optional(),
		description: descriptionSchema.optional(),
		reviewerIds: reviewerIdsSchema.optional(),
	}),
	output: pullRequestView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		updatePullRequest(requireSubject(ctx), input.pullRequestId, input),
});

export const reviewPullRequestOperation = defineOperation({
	id: "client.reviewPullRequest",
	method: "PUT",
	path: `${PULL_REQUEST_PATH}/review`,
	summary: "Approve or decline a pull request you review",
	description: `Only its reviewers (403 otherwise). Any decline declines it (closed); else any approval approves it. Its author is told. ${CLOSED} ${PR_ACCESS}`,
	input: z.object({
		pullRequestId: pullRequestIdSchema,
		decision: z.enum(["approved", "declined"]),
	}),
	output: pullRequestView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		reviewPullRequest(requireSubject(ctx), input.pullRequestId, input.decision),
});

export const mergePullRequestOperation = defineOperation({
	id: "client.mergePullRequest",
	method: "POST",
	path: `${PULL_REQUEST_PATH}/merge`,
	summary: "Merge a pull request into its source",
	description: `Editors of the source, Pro only, whether or not it is approved; the same merge as merge_collection_fork (\`option\`, \`resolutions\` for the conflicts of get_pull_request, 409 MERGE_CONFLICTS while any lacks one). Its author is told. ${CLOSED} ${PR_ACCESS}`,
	input: z.object({
		pullRequestId: pullRequestIdSchema,
		option: mergeOptionSchema,
		resolutions: resolutionsSchema,
	}),
	output: z.object({
		pullRequest: pullRequestView,
		followUp: z.enum(["none", "done", "failed"]),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		mergePullRequest(
			requireSubject(ctx),
			input.pullRequestId,
			input.option,
			input.resolutions,
		),
});

export const pullRequestCoreOperations = [
	createPullRequestOperation,
	listPullRequestsOperation,
	listPullRequestReviewersOperation,
	getPullRequestOperation,
	updatePullRequestOperation,
	reviewPullRequestOperation,
	mergePullRequestOperation,
];
