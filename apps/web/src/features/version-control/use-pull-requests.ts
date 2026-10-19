/** Pull requests of a collection, one pull request, and their writes. */
import type { ConflictSide, MergeOption } from "@localman/shared/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commentsKey } from "../comments/use-comments";
import {
	type PullRequestInput,
	createPullRequest,
	fetchPullRequest,
	fetchPullRequestChangeDiff,
	fetchPullRequestThreads,
	fetchPullRequests,
	fetchReviewerCandidates,
	mergePullRequest,
	reviewPullRequest,
	updatePullRequest,
} from "./pull-requests-api";
import { useAfterSync } from "./use-forks";

const PULL_REQUESTS_KEY = ["pullRequests"] as const;

export function usePullRequests(collectionId: string, enabled = true) {
	return useQuery({
		queryKey: [...PULL_REQUESTS_KEY, "collection", collectionId],
		queryFn: () => fetchPullRequests(collectionId),
		enabled,
	});
}

/** One change's diff, fetched once its row is opened. */
export function usePullRequestChangeDiff(
	id: string,
	changeKey: string,
	enabled: boolean,
) {
	return useQuery({
		queryKey: [...PULL_REQUESTS_KEY, "diff", id, changeKey],
		queryFn: () => fetchPullRequestChangeDiff(id, changeKey),
		enabled,
		refetchOnWindowFocus: false,
	});
}

export function usePullRequest(id: string) {
	return useQuery({
		queryKey: [...PULL_REQUESTS_KEY, "detail", id],
		queryFn: () => fetchPullRequest(id),
		// Its changes compare both collections whole: not on every focus.
		refetchOnWindowFocus: false,
	});
}

export function useReviewerCandidates(forkId: string) {
	return useQuery({
		queryKey: [...PULL_REQUESTS_KEY, "reviewers", forkId],
		queryFn: () => fetchReviewerCandidates(forkId),
	});
}

/** Kept under the source's comments, so comment writes refresh them. */
export function usePullRequestThreads(
	sourceId: string,
	id: string,
	includeResolved: boolean,
) {
	return useQuery({
		queryKey: [...commentsKey(sourceId), "pullRequest", id, includeResolved],
		queryFn: () => fetchPullRequestThreads(id, includeResolved),
	});
}

export function useCreatePullRequest(forkId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: PullRequestInput) => createPullRequest(forkId, input),
		onSuccess: () => client.invalidateQueries({ queryKey: PULL_REQUESTS_KEY }),
	});
}

/** Edit, review and merge one pull request. */
export function usePullRequestActions(id: string) {
	const client = useQueryClient();
	const afterSync = useAfterSync();
	const refresh = () =>
		client.invalidateQueries({ queryKey: PULL_REQUESTS_KEY });
	return {
		update: useMutation({
			mutationFn: (input: Partial<PullRequestInput>) =>
				updatePullRequest(id, input),
			onSuccess: refresh,
		}),
		review: useMutation({
			mutationFn: (decision: "approved" | "declined") =>
				reviewPullRequest(id, decision),
			onSuccess: refresh,
		}),
		merge: useMutation({
			mutationFn: (input: {
				option: MergeOption;
				resolutions: Record<string, ConflictSide>;
				sourceId: string;
				forkId: string;
			}) => mergePullRequest(id, input.option, input.resolutions),
			// Refreshes both collections and every pull request.
			onSuccess: (_done, input) =>
				afterSync("collection", [input.sourceId, input.forkId]),
		}),
	};
}
