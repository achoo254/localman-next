/** Threads, counts and watch of a collection, and the writes that change them. */
import type { CommentReaction } from "@localman/shared/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collectionKey } from "../collections/use-collections";
import {
	type NewComment,
	createComment,
	deleteComment,
	editComment,
	fetchCommentCounts,
	fetchThreads,
	setReaction,
	setThreadResolved,
} from "./comments-api";
import { fetchWatch, setWatch } from "./watch-api";

export const commentsKey = (collectionId: string) =>
	[...collectionKey(collectionId), "comments"] as const;
const threadsKey = (
	collectionId: string,
	nodeId: string | null,
	includeResolved: boolean,
) =>
	[
		...commentsKey(collectionId),
		"threads",
		nodeId ?? "collection",
		includeResolved,
	] as const;
const countsKey = (collectionId: string) =>
	[...commentsKey(collectionId), "counts"] as const;
const watchKey = (collectionId: string) =>
	[...collectionKey(collectionId), "watch"] as const;

export function useThreads(
	collectionId: string,
	nodeId: string | null,
	includeResolved: boolean,
	enabled = true,
) {
	return useQuery({
		queryKey: threadsKey(collectionId, nodeId, includeResolved),
		queryFn: () => fetchThreads(collectionId, nodeId, includeResolved),
		enabled,
	});
}

export function useCommentCounts(collectionId: string, enabled = true) {
	return useQuery({
		queryKey: countsKey(collectionId),
		queryFn: () => fetchCommentCounts(collectionId),
		enabled,
	});
}

/** Every comment write, refreshing the collection's threads and counts after. */
export function useCommentActions(collectionId: string) {
	const client = useQueryClient();
	const refresh = () =>
		client.invalidateQueries({ queryKey: commentsKey(collectionId) });
	const after = { onSettled: refresh };
	return {
		create: useMutation({
			mutationFn: (comment: NewComment) => createComment(collectionId, comment),
			...after,
		}),
		edit: useMutation({
			mutationFn: ({ id, body }: { id: string; body: string }) =>
				editComment(collectionId, id, body),
			...after,
		}),
		remove: useMutation({
			mutationFn: (id: string) => deleteComment(collectionId, id),
			...after,
		}),
		resolve: useMutation({
			mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
				setThreadResolved(collectionId, id, resolved),
			...after,
		}),
		react: useMutation({
			mutationFn: ({
				id,
				reaction,
				on,
			}: { id: string; reaction: CommentReaction; on: boolean }) =>
				setReaction(collectionId, id, reaction, on),
			...after,
		}),
	};
}

export function useWatch(collectionId: string, enabled = true) {
	const client = useQueryClient();
	const query = useQuery({
		queryKey: watchKey(collectionId),
		queryFn: () => fetchWatch(collectionId),
		enabled,
	});
	const toggle = useMutation({
		mutationFn: (watching: boolean) => setWatch(collectionId, watching),
		onSuccess: (view) => client.setQueryData(watchKey(collectionId), view),
	});
	return { query, toggle };
}
