/** Fork status, forks list, creating forks, previews and syncs. */
import type {
	CollectionDetail,
	ConflictSide,
	MergeOption,
} from "@localman/shared/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCollection } from "../collections/collections-api";
import { useDiscardPageEdits } from "../collections/page-save-context";
import { COLLECTIONS_KEY, collectionKey } from "../collections/use-collections";
import { useRefreshBoundTabs } from "../collections/use-refresh-bound-tabs";
import { ENVIRONMENTS_KEY } from "../environments/use-environments";
import {
	type ForkTarget,
	applySync,
	createFork,
	fetchForkStatus,
	fetchForks,
	fetchSyncPreview,
	relabelFork,
} from "./forks-api";

const forksKey = (target: ForkTarget) =>
	["forks", target.kind, target.id] as const;

export function useForkStatus(target: ForkTarget, enabled = true) {
	return useQuery({
		queryKey: [...forksKey(target), "status"],
		queryFn: () => fetchForkStatus(target),
		enabled,
	});
}

export function useForkList(target: ForkTarget, enabled = true) {
	return useQuery({
		queryKey: [...forksKey(target), "list"],
		queryFn: () => fetchForks(target),
		enabled,
	});
}

export function useSyncPreview(
	fork: ForkTarget,
	direction: "pull" | "merge",
	enabled: boolean,
) {
	return useQuery({
		queryKey: [...forksKey(fork), "preview", direction],
		queryFn: () => fetchSyncPreview(fork, direction),
		enabled,
		staleTime: 0,
		// Each comparison reads both sides whole: only on opening the dialog.
		refetchOnWindowFocus: false,
	});
}

/**
 * After a write to collections or environments: refetch them, put the
 * saved requests into tabs that have no unsaved edits, and drop page
 * edits made against the old content.
 */
function useAfterSync() {
	const client = useQueryClient();
	const refreshTabs = useRefreshBoundTabs();
	const discardPageEdits = useDiscardPageEdits();
	return async (kind: ForkTarget["kind"], ids: readonly string[]) => {
		await client.invalidateQueries({ queryKey: ["forks"] });
		if (kind === "environment") {
			await client.invalidateQueries({ queryKey: ENVIRONMENTS_KEY });
			return;
		}
		for (const id of ids) {
			discardPageEdits(id);
			const detail = await client
				.fetchQuery<CollectionDetail>({
					queryKey: collectionKey(id),
					queryFn: () => fetchCollection(id),
					staleTime: 0,
				})
				.catch(() => null);
			if (detail) refreshTabs(detail);
		}
		await client.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, "list"] });
	};
}

export function useForkActions(target: ForkTarget) {
	const client = useQueryClient();
	const afterSync = useAfterSync();
	return {
		create: useMutation({
			mutationFn: (input: { label: string; workspaceId: string }) =>
				createFork(target, input),
			onSuccess: () => afterSync(target.kind, []),
		}),
		relabel: useMutation({
			mutationFn: (label: string) => relabelFork(target, label),
			onSuccess: () => client.invalidateQueries({ queryKey: forksKey(target) }),
		}),
		sync: useMutation({
			mutationFn: (input: {
				direction: "pull" | "merge";
				resolutions: Record<string, ConflictSide>;
				option?: MergeOption;
				/** The other side, refreshed too. */
				sourceId: string;
			}) => applySync(target, input.direction, input.resolutions, input.option),
			onSuccess: (_done, input) =>
				afterSync(target.kind, [target.id, input.sourceId]),
		}),
	};
}
