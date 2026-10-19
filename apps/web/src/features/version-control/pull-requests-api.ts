/** Pull requests of collection forks and their comments, parsed. */
import type {
	CommentThreadView,
	ConflictSide,
	MergeOption,
	PullRequestDetail,
	PullRequestReviewView,
	PullRequestView,
	ReviewerCandidate,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectArray,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { collectionPath } from "../collections/collections-api";
import { parseThread } from "../comments/comments-api";
import { parseMergePreview } from "./forks-api";

const STATUSES: readonly PullRequestView["status"][] = [
	"open",
	"approved",
	"declined",
	"merged",
];
const DECISIONS: readonly PullRequestReviewView["decision"][] = [
	"pending",
	"approved",
	"declined",
];

export const pullRequestPath = (id: string) =>
	`/api/v1/pull-requests/${encodeURIComponent(id)}`;

function reviewOf(value: unknown): PullRequestReviewView {
	const data = expectRecord(value, "review");
	const decision = DECISIONS.find((item) => item === data.decision);
	if (!decision) throw new InvalidResponseError("review decision");
	return {
		userId: expectString(data, "userId"),
		name: optionalString(data, "name"),
		decision,
		at: optionalString(data, "at"),
	};
}

export function parsePullRequest(value: unknown): PullRequestView {
	const data = expectRecord(value, "pull request");
	const status = STATUSES.find((item) => item === data.status);
	if (!status) throw new InvalidResponseError("pull request status");
	return {
		id: expectString(data, "id"),
		sourceId: expectString(data, "sourceId"),
		sourceName: optionalString(data, "sourceName"),
		forkId: expectString(data, "forkId"),
		forkLabel: optionalString(data, "forkLabel"),
		title: expectString(data, "title"),
		description: expectString(data, "description"),
		authorId: expectString(data, "authorId"),
		authorName: optionalString(data, "authorName"),
		reviewers: expectArray(data, "reviewers").map(reviewOf),
		status,
		mergedByName: optionalString(data, "mergedByName"),
		mergedAt: optionalString(data, "mergedAt"),
		createdAt: expectString(data, "createdAt"),
		canReview: expectBoolean(data, "canReview"),
		canMerge: expectBoolean(data, "canMerge"),
		canEdit: expectBoolean(data, "canEdit"),
	};
}

/** Pull requests into or out of the collection, newest first. */
export async function fetchPullRequests(
	collectionId: string,
): Promise<PullRequestView[]> {
	const data = expectRecord(
		await apiRequest(`${collectionPath(collectionId)}/pull-requests`),
		"pull requests",
	);
	return expectArray(data, "items").map(parsePullRequest);
}

export async function fetchPullRequest(id: string): Promise<PullRequestDetail> {
	const data = expectRecord(
		await apiRequest(pullRequestPath(id)),
		"pull request",
	);
	return {
		...parsePullRequest(data),
		preview: data.preview === null ? null : parseMergePreview(data.preview),
	};
}

/** One change of a pull request: the source item now, and after merging. */
export async function fetchPullRequestChangeDiff(
	id: string,
	changeKey: string,
): Promise<{ before: unknown; after: unknown }> {
	const data = expectRecord(
		await apiRequest(
			`${pullRequestPath(id)}/changes/${encodeURIComponent(changeKey)}/diff`,
		),
		"pull request change",
	);
	return { before: data.before ?? null, after: data.after ?? null };
}

/** Editors of the fork's source, offered as reviewers. */
export async function fetchReviewerCandidates(
	forkId: string,
): Promise<ReviewerCandidate[]> {
	const data = expectRecord(
		await apiRequest(`${collectionPath(forkId)}/pull-request-reviewers`),
		"reviewers",
	);
	return expectArray(data, "items").map((value) => {
		const item = expectRecord(value, "reviewer");
		return {
			userId: expectString(item, "userId"),
			username: expectString(item, "username"),
			name: optionalString(item, "name"),
		};
	});
}

export interface PullRequestInput {
	title: string;
	description: string;
	reviewerIds: string[];
}

export async function createPullRequest(
	forkId: string,
	input: PullRequestInput,
): Promise<PullRequestView> {
	return parsePullRequest(
		await apiRequest(`${collectionPath(forkId)}/pull-requests`, {
			method: "POST",
			body: input,
		}),
	);
}

export async function updatePullRequest(
	id: string,
	input: Partial<PullRequestInput>,
): Promise<PullRequestView> {
	return parsePullRequest(
		await apiRequest(pullRequestPath(id), { method: "PATCH", body: input }),
	);
}

export async function reviewPullRequest(
	id: string,
	decision: "approved" | "declined",
): Promise<PullRequestView> {
	return parsePullRequest(
		await apiRequest(`${pullRequestPath(id)}/review`, {
			method: "PUT",
			body: { decision },
		}),
	);
}

export async function mergePullRequest(
	id: string,
	option: MergeOption,
	resolutions: Record<string, ConflictSide>,
): Promise<{ followUpFailed: boolean }> {
	const data = expectRecord(
		await apiRequest(`${pullRequestPath(id)}/merge`, {
			method: "POST",
			body: { option, resolutions },
		}),
		"merged pull request",
	);
	return { followUpFailed: data.followUp === "failed" };
}

export async function fetchPullRequestThreads(
	id: string,
	includeResolved: boolean,
): Promise<CommentThreadView[]> {
	const suffix = includeResolved ? "?includeResolved=true" : "";
	const data = expectRecord(
		await apiRequest(`${pullRequestPath(id)}/comments${suffix}`),
		"thread list",
	);
	return expectArray(data, "threads").map(parseThread);
}
