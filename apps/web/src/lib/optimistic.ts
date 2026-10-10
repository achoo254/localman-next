import {
	type QueryClient,
	type QueryKey,
	type UseMutationResult,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "../components/ui/toast";
import { errorMessage } from "./api-client";

/** What `onMutate` saved: the cached value before the optimistic change. */
export interface OptimisticSnapshot<TData> {
	previous: TData | undefined;
}

export interface OptimisticOptions<TData, TVariables> {
	/** Cache entry shown on screen, e.g. `projectsKey`. */
	queryKey: QueryKey;
	/** The cached value as it will be once the server agrees. */
	apply: (current: TData, variables: TVariables) => TData;
}

/** Mutation key of the optimistic writes to one cache entry. */
const writesKey = (queryKey: QueryKey): QueryKey => ["optimistic", ...queryKey];

/**
 * `onMutate` / `onError` / `onSettled` of an optimistic write:
 * - before the request: cancel refetches of `queryKey` (they would bring
 *   back the old value), keep a snapshot, write `apply(current)` at once;
 * - on failure: put the snapshot back and toast the error;
 * - when the last write to this entry settles: refetch it, so the cache
 *   ends on the server's truth without overwriting a write still queued.
 */
export function optimisticHandlers<TData, TVariables>(
	client: QueryClient,
	showError: (message: string) => void,
	{ queryKey, apply }: OptimisticOptions<TData, TVariables>,
) {
	return {
		mutationKey: writesKey(queryKey),
		onMutate: async (
			variables: TVariables,
		): Promise<OptimisticSnapshot<TData>> => {
			await client.cancelQueries({ queryKey });
			const previous = client.getQueryData<TData>(queryKey);
			if (previous !== undefined) {
				client.setQueryData<TData>(queryKey, apply(previous, variables));
			}
			return { previous };
		},
		onError: (
			error: unknown,
			_variables: TVariables,
			snapshot: OptimisticSnapshot<TData> | undefined,
		): void => {
			if (snapshot?.previous !== undefined) {
				client.setQueryData<TData>(queryKey, snapshot.previous);
			}
			showError(errorMessage(error));
		},
		onSettled: async (): Promise<void> => {
			// This write still counts as running here.
			if (client.isMutating({ mutationKey: writesKey(queryKey) }) <= 1) {
				await client.invalidateQueries({ queryKey });
			}
		},
	};
}

export interface OptimisticMutationOptions<TData, TVariables, TResult>
	extends OptimisticOptions<TData, TVariables> {
	mutationFn: (variables: TVariables) => Promise<TResult>;
}

/**
 * Mutation that updates the screen before the server answers and rolls
 * back with an error toast if it refuses. For toggles and renames; actions
 * whose result is unknown until the server answers use `Button loading`.
 *
 * ```ts
 * const rename = useOptimisticMutation({
 *   queryKey: projectsKey,
 *   mutationFn: ({ id, name }: Rename) => renameProject(id, name),
 *   apply: (list: Project[], { id, name }) =>
 *     list.map((p) => (p.id === id ? { ...p, name } : p)),
 * });
 * rename.mutate({ id, name });
 * ```
 */
export function useOptimisticMutation<TData, TVariables, TResult = unknown>({
	mutationFn,
	...options
}: OptimisticMutationOptions<TData, TVariables, TResult>): UseMutationResult<
	TResult,
	unknown,
	TVariables,
	OptimisticSnapshot<TData>
> {
	const client = useQueryClient();
	const toast = useToast();
	const showError = (message: string) =>
		toast.show({ tone: "error", title: message });
	return useMutation({
		mutationFn,
		...optimisticHandlers(client, showError, options),
	});
}
