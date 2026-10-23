/** Live Mock Sync status, conflicts, turning it off, and new synced collections. */
import type { ConflictSide } from "@localman/shared/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useFeatures } from "../../config/features";
import { COLLECTIONS_KEY } from "../collections/use-collections";
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
 * The collection's sync (`null`: not synced), checked again every
 * `SYNC_POLL_MS`; when a sync changed it, the collection and its tabs
 * are refreshed.
 */
export function useSyncStatus(collectionId: string) {
	const enabled = useLiveMockSyncEnabled();
	const afterSync = useAfterSync();
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
		if (before !== null && count > before) {
			void afterSync("collection", [collectionId]);
		}
	}, [count, collectionId, afterSync]);
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
