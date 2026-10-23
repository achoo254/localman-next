/** Live Mock Sync status, conflicts, turning it off, and new synced collections. */
import type {
	CollectionDetail,
	ConflictSide,
} from "@localman/shared/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useFeatures } from "../../config/features";
import { fetchCollection } from "../collections/collections-api";
import { COLLECTIONS_KEY, collectionKey } from "../collections/use-collections";
import { useRefreshBoundTabs } from "../collections/use-refresh-bound-tabs";
import { ENVIRONMENTS_KEY } from "../environments/use-environments";
import { useAfterSync } from "../version-control/use-forks";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";
import {
	type SyncNames,
	createSyncedCollection,
	fetchProjectSyncedCollections,
	fetchSyncPreview,
	fetchSyncStatus,
	resolveSync,
	stopSync,
} from "./live-mock-sync-api";

/** How often an open collection checks whether the mock changed it. */
export const SYNC_POLL_MS = 15_000;

const syncKey = (collectionId: string) => ["mockSync", collectionId] as const;
const projectKey = (projectId: string) =>
	["mockSync", "project", projectId] as const;

/** Collections live in workspaces: Live Mock Sync needs that flag too. */
export function useLiveMockSyncEnabled(): boolean {
	const { liveMockSync } = useFeatures();
	return useWorkspacesEnabled() && liveMockSync;
}

/**
 * After a sync in the background (someone changed the mock): the
 * collection, its open tabs and environments are fetched again. Unsaved
 * edits stay, on pages and in tabs: nobody asked for this change here.
 */
function useRefreshAfterBackgroundSync() {
	const client = useQueryClient();
	const refreshTabs = useRefreshBoundTabs();
	return useCallback(
		async (collectionId: string) => {
			const detail = await client
				.fetchQuery<CollectionDetail>({
					queryKey: collectionKey(collectionId),
					queryFn: () => fetchCollection(collectionId),
					staleTime: 0,
				})
				.catch(() => null);
			if (detail) refreshTabs(detail);
			await client.invalidateQueries({
				queryKey: [...COLLECTIONS_KEY, "list"],
			});
			await client.invalidateQueries({ queryKey: ENVIRONMENTS_KEY });
		},
		[client, refreshTabs],
	);
}

/**
 * The collection's sync (`null`: not synced), checked again every
 * `SYNC_POLL_MS`. With `follow` (one place per page), a sync that changed
 * the collection or its environment refreshes them.
 */
export function useSyncStatus(collectionId: string, follow = false) {
	const enabled = useLiveMockSyncEnabled();
	const refresh = useRefreshAfterBackgroundSync();
	const query = useQuery({
		queryKey: syncKey(collectionId),
		queryFn: () => fetchSyncStatus(collectionId),
		enabled,
		refetchInterval: (state) => (state.state.data ? SYNC_POLL_MS : false),
	});
	const seen = useRef<number | null>(null);
	const count = query.data?.syncCount ?? null;
	useEffect(() => {
		if (count === null) return;
		const before = seen.current;
		seen.current = count;
		if (follow && before !== null && count > before) {
			void refresh(collectionId);
		}
	}, [count, collectionId, follow, refresh]);
	return query;
}

export function useSyncConflictsPreview(collectionId: string, open: boolean) {
	return useQuery({
		queryKey: [...syncKey(collectionId), "preview"],
		queryFn: () => fetchSyncPreview(collectionId),
		enabled: open,
		staleTime: 0,
		refetchOnWindowFocus: false,
	});
}

export function useSyncActions(collectionId: string) {
	const client = useQueryClient();
	const afterSync = useAfterSync();
	const settle = async () => {
		await client.invalidateQueries({ queryKey: ["mockSync"] });
		await afterSync("collection", [collectionId]);
	};
	return {
		resolve: useMutation({
			mutationFn: (resolutions: Record<string, ConflictSide>) =>
				resolveSync(collectionId, resolutions),
			onSuccess: settle,
		}),
		stop: useMutation({
			mutationFn: () => stopSync(collectionId),
			onSuccess: () => client.invalidateQueries({ queryKey: ["mockSync"] }),
		}),
	};
}

export function useProjectSyncedCollections(projectId: string) {
	const enabled = useLiveMockSyncEnabled();
	return useQuery({
		queryKey: projectKey(projectId),
		queryFn: () => fetchProjectSyncedCollections(projectId),
		enabled,
	});
}

export function useCreateSyncedCollection() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: {
			projectId: string;
			workspaceId: string;
			names: SyncNames;
		}) =>
			createSyncedCollection(input.projectId, input.workspaceId, input.names),
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: ["mockSync"] });
			await client.invalidateQueries({ queryKey: COLLECTIONS_KEY });
			// Its environment holds baseUrl and the id variables.
			await client.invalidateQueries({ queryKey: ENVIRONMENTS_KEY });
		},
	});
}
