import { limitsFor } from "@localman/shared/constants";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCurrentUser } from "../auth/use-current-user";
import {
	type TrashFilters,
	type TrashListing,
	deleteTrashed,
	fetchTrash,
	restoreTrashed,
} from "./trash-api";
import { COLLECTIONS_KEY, TRASH_KEY } from "./use-collections";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until `purgeAt` (rounded up, never below 0). */
export function daysLeft(purgeAt: string, now: Date): number {
	const ms = new Date(purgeAt).getTime() - now.getTime();
	return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / DAY_MS)) : 0;
}

/** At or below this many days left, the count shows in the warning colour. */
export const TRASH_WARNING_DAYS = 7;

/** Days a deleted collection stays in the Trash, on the caller's plan. */
export function useTrashDays(): number {
	const session = useCurrentUser();
	const plan = session.status === "authenticated" ? session.user.plan : "free";
	return limitsFor(plan).trashDays;
}

export function useTrash(filters: TrashFilters) {
	return useQuery({
		queryKey: [...TRASH_KEY, filters],
		queryFn: () => fetchTrash(filters),
		placeholderData: keepPreviousData,
	});
}

/** Gone from every trash list (restored or deleted for good). */
function useLeaveTrash() {
	const client = useQueryClient();
	return (id: string): void => {
		client.setQueriesData<TrashListing>({ queryKey: TRASH_KEY }, (list) =>
			list
				? { ...list, items: list.items.filter((item) => item.id !== id) }
				: list,
		);
		void client.invalidateQueries({ queryKey: TRASH_KEY });
	};
}

export function useRestoreTrashed() {
	const client = useQueryClient();
	const leave = useLeaveTrash();
	return useMutation({
		mutationFn: ({ id, workspaceId }: { id: string; workspaceId: string }) =>
			restoreTrashed(id, workspaceId),
		onSuccess: (_data, { id }) => {
			leave(id);
			void client.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, "list"] });
		},
	});
}

export function useDeleteTrashed() {
	const leave = useLeaveTrash();
	return useMutation({
		mutationFn: (id: string) => deleteTrashed(id),
		onSuccess: (_data, id) => leave(id),
	});
}
