/**
 * The changelog of a collection (pages of sessions, "Load older"), a
 * change's diff, hiding a diff and restoring to a change.
 */
import type {
	ChangelogChange,
	ChangelogPage,
	CollectionDetail,
} from "@localman/shared/api-client";
import {
	type InfiniteData,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	fetchActivity,
	fetchChangelog,
	fetchDiff,
	restoreChange,
	setChangeHidden,
} from "./changelog-api";
import { COLLECTIONS_KEY, collectionKey } from "./use-collections";

export const changelogKey = (id: string) =>
	[...collectionKey(id), "changelog"] as const;
export const activityKey = (id: string) =>
	[...collectionKey(id), "activity"] as const;
const diffKey = (id: string, revisionId: string) =>
	[...changelogKey(id), "diff", revisionId] as const;

/** The first page has no `before`: the newest changes. */
const NEWEST: string | null = null;

export function useChangelog(collectionId: string) {
	return useInfiniteQuery({
		queryKey: changelogKey(collectionId),
		queryFn: ({ pageParam }) => fetchChangelog(collectionId, pageParam),
		initialPageParam: NEWEST,
		getNextPageParam: (last: ChangelogPage) => last.nextBefore,
	});
}

export function useChangeDiff(
	collectionId: string,
	revisionId: string,
	enabled: boolean,
) {
	return useQuery({
		queryKey: diffKey(collectionId, revisionId),
		queryFn: () => fetchDiff(collectionId, revisionId),
		enabled,
	});
}

export function useActivity(collectionId: string, limit = 5) {
	return useQuery({
		queryKey: activityKey(collectionId),
		queryFn: () => fetchActivity(collectionId, limit),
	});
}

type Pages = InfiniteData<ChangelogPage, string | null>;

function withChange(
	pages: Pages | undefined,
	change: ChangelogChange,
): Pages | undefined {
	if (!pages) return pages;
	return {
		...pages,
		pages: pages.pages.map((page) => ({
			...page,
			sessions: page.sessions.map((session) => ({
				...session,
				changes: session.changes.map((item) =>
					item.id === change.id ? change : item,
				),
			})),
		})),
	};
}

export function useSetChangeHidden(collectionId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
			setChangeHidden(collectionId, id, hidden),
		onSuccess: (change) => {
			client.setQueryData<Pages>(changelogKey(collectionId), (pages) =>
				withChange(pages, change),
			);
			void client.invalidateQueries({
				queryKey: diffKey(collectionId, change.id),
			});
		},
	});
}

/** Restores, then refreshes the collection, its changelog and lists. */
export function useRestoreChange(
	collectionId: string,
	onRestored: (detail: CollectionDetail) => void,
) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (revisionId: string) => restoreChange(collectionId, revisionId),
		onSuccess: (detail) => {
			client.setQueryData(collectionKey(collectionId), detail);
			void client.invalidateQueries({ queryKey: changelogKey(collectionId) });
			void client.invalidateQueries({ queryKey: activityKey(collectionId) });
			void client.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, "list"] });
			onRestored(detail);
		},
	});
}
