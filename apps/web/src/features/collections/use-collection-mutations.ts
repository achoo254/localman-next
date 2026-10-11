/**
 * Writes on whole collections. Rename and favorite update the sidebar
 * list at once and roll back with a toast when the API refuses; the
 * others wait for the API (the caller shows a spinner) and then refresh.
 */
import type {
	CollectionDetail,
	CollectionSummary,
} from "@localman/shared/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { collectionErrorMessage } from "./collection-errors";
import {
	type CollectionSource,
	createCollection,
	duplicateCollection,
	moveCollectionToWorkspace,
	setFavorite,
	updateCollection,
} from "./collections-api";
import { trashCollection } from "./trash-api";
import {
	COLLECTIONS_KEY,
	TRASH_KEY,
	collectionKey,
	collectionListKey,
} from "./use-collections";

type Summaries = CollectionSummary[];

/** The list entry of a collection just created or copied. */
function summaryOf(detail: CollectionDetail): CollectionSummary {
	return {
		id: detail.id,
		workspaceId: detail.workspaceId,
		name: detail.name,
		role: detail.role,
		favorite: false,
		requestCount: detail.nodes.filter((node) => node.kind === "request").length,
		updatedAt: detail.updatedAt,
	};
}

/** A new or copied collection: shown at once, then the list fetched again. */
function useRemember() {
	const client = useQueryClient();
	return async (detail: CollectionDetail): Promise<void> => {
		client.setQueryData(collectionKey(detail.id), detail);
		const queryKey = collectionListKey(detail.workspaceId);
		client.setQueryData<Summaries>(queryKey, (list) =>
			list && !list.some((item) => item.id === detail.id)
				? [...list, summaryOf(detail)]
				: list,
		);
		await client.invalidateQueries({ queryKey });
	};
}

export function useCreateCollection(workspaceId: string) {
	const remember = useRemember();
	return useMutation({
		mutationFn: (source: CollectionSource) =>
			createCollection(workspaceId, source),
		onSuccess: remember,
	});
}

export function useDuplicateCollection() {
	const remember = useRemember();
	return useMutation({
		mutationFn: (collectionId: string) => duplicateCollection(collectionId),
		onSuccess: remember,
	});
}

/** Optimistic edit of one summary in the workspace's list. */
function useListEdit<V extends { id: string }>(
	workspaceId: string,
	mutationFn: (variables: V) => Promise<unknown>,
	edit: (summary: CollectionSummary, variables: V) => CollectionSummary,
) {
	const client = useQueryClient();
	const toast = useToast();
	const t = useT();
	const queryKey = collectionListKey(workspaceId);
	const mutationKey = ["optimistic", ...queryKey];
	return useMutation({
		mutationKey,
		mutationFn,
		onMutate: async (variables: V) => {
			await client.cancelQueries({ queryKey });
			const previous = client.getQueryData<Summaries>(queryKey);
			client.setQueryData<Summaries>(queryKey, (list) =>
				list?.map((item) =>
					item.id === variables.id ? edit(item, variables) : item,
				),
			);
			return { previous };
		},
		onError: (error, _variables, snapshot) => {
			if (snapshot?.previous) client.setQueryData(queryKey, snapshot.previous);
			toast.show({ tone: "error", title: collectionErrorMessage(error, t) });
		},
		onSettled: (_data, _error, variables) => {
			void client.invalidateQueries({ queryKey: collectionKey(variables.id) });
			// A refetch now would undo another edit still on its way.
			if (client.isMutating({ mutationKey }) <= 1) {
				void client.invalidateQueries({ queryKey });
			}
		},
	});
}

export function useRenameCollection(workspaceId: string) {
	return useListEdit(
		workspaceId,
		({ id, name }: { id: string; name: string }) =>
			updateCollection(id, { name }),
		(summary, { name }) => ({ ...summary, name }),
	);
}

export function useFavoriteCollection(workspaceId: string) {
	return useListEdit(
		workspaceId,
		({ id, favorite }: { id: string; favorite: boolean }) =>
			setFavorite(id, favorite),
		(summary, { favorite }) => ({ ...summary, favorite }),
	);
}

/** Gone from the sidebar: list and detail forgotten, trash refetched. */
function useForget() {
	const client = useQueryClient();
	return (summary: CollectionSummary): void => {
		client.setQueryData<Summaries>(
			collectionListKey(summary.workspaceId),
			(list) => list?.filter((item) => item.id !== summary.id),
		);
		client.removeQueries({ queryKey: collectionKey(summary.id) });
		void client.invalidateQueries({ queryKey: TRASH_KEY });
	};
}

/** `confirm` is the typed word when the collection holds requests. */
export function useTrashCollection() {
	const forget = useForget();
	return useMutation({
		mutationFn: ({ summary, confirm }: TrashInput) =>
			trashCollection(summary.id, confirm),
		onSuccess: (_data, { summary }) => forget(summary),
	});
}

interface TrashInput {
	summary: CollectionSummary;
	confirm?: string;
}

export function useMoveCollection() {
	const client = useQueryClient();
	const forget = useForget();
	return useMutation({
		mutationFn: ({ summary, workspaceId }: MoveInput) =>
			moveCollectionToWorkspace(summary.id, workspaceId),
		onSuccess: (_data, { summary }) => {
			forget(summary);
			void client.invalidateQueries({
				queryKey: [...COLLECTIONS_KEY, "list"],
			});
		},
	});
}

interface MoveInput {
	summary: CollectionSummary;
	workspaceId: string;
}
