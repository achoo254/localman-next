/**
 * Query keys and reads of environments, globals, local values of
 * collections and the active environment. Writes update these entries
 * with what the server answered, so every open view agrees at once.
 */
import type {
	ActiveEnvironment,
	EnvironmentDetail,
	GlobalsDetail,
	LocalValue,
} from "@localman/shared/api-client";
import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import {
	fetchEnvironment,
	fetchEnvironments,
	fetchGlobals,
} from "./environments-api";
import {
	fetchActiveEnvironment,
	fetchCollectionLocalValues,
	setActiveEnvironment,
} from "./variable-scopes-api";

export const ENVIRONMENTS_KEY = ["environments"] as const;
export const environmentListKey = (workspaceId: string) =>
	[...ENVIRONMENTS_KEY, "list", workspaceId] as const;
export const environmentKey = (id: string) =>
	[...ENVIRONMENTS_KEY, "detail", id] as const;
export const globalsKey = (workspaceId: string) =>
	[...ENVIRONMENTS_KEY, "globals", workspaceId] as const;
export const activeEnvironmentKey = (workspaceId: string) =>
	[...ENVIRONMENTS_KEY, "active", workspaceId] as const;
export const collectionLocalKey = (collectionId: string) =>
	[...ENVIRONMENTS_KEY, "collection-local", collectionId] as const;

const STALE_MS = 15_000;

export function useEnvironmentList(workspaceId: string | null) {
	return useQuery({
		queryKey: environmentListKey(workspaceId ?? ""),
		queryFn: () => fetchEnvironments(workspaceId ?? ""),
		enabled: workspaceId !== null,
		staleTime: STALE_MS,
	});
}

export function useEnvironment(id: string | null) {
	return useQuery({
		queryKey: environmentKey(id ?? ""),
		queryFn: () => fetchEnvironment(id ?? ""),
		enabled: id !== null,
		staleTime: STALE_MS,
	});
}

export function useGlobals(workspaceId: string | null) {
	return useQuery({
		queryKey: globalsKey(workspaceId ?? ""),
		queryFn: () => fetchGlobals(workspaceId ?? ""),
		enabled: workspaceId !== null,
		staleTime: STALE_MS,
	});
}

export function useActiveEnvironment(workspaceId: string | null) {
	return useQuery({
		queryKey: activeEnvironmentKey(workspaceId ?? ""),
		queryFn: () => fetchActiveEnvironment(workspaceId ?? ""),
		enabled: workspaceId !== null,
		staleTime: STALE_MS,
	});
}

export function useCollectionLocalValues(collectionId: string | null) {
	return useQuery({
		queryKey: collectionLocalKey(collectionId ?? ""),
		queryFn: () => fetchCollectionLocalValues(collectionId ?? ""),
		enabled: collectionId !== null,
		staleTime: STALE_MS,
	});
}

/** Stores an environment the server answered, in its detail and the list. */
export function storeEnvironment(
	client: QueryClient,
	detail: EnvironmentDetail,
): void {
	client.setQueryData(environmentKey(detail.id), detail);
	void client.invalidateQueries({
		queryKey: environmentListKey(detail.workspaceId),
	});
}

/** Replaces the caller's local values in a cached environment or globals. */
export function storeLocalValues<T extends EnvironmentDetail | GlobalsDetail>(
	client: QueryClient,
	key: readonly unknown[],
	localValues: LocalValue[],
): void {
	client.setQueryData<T>(key, (current) =>
		current ? { ...current, localValues } : current,
	);
}

/** Picks the active environment, optimistically; an error rolls it back. */
export function useSetActiveEnvironment(workspaceId: string | null) {
	const client = useQueryClient();
	const toast = useToast();
	const t = useT();
	return useMutation({
		mutationFn: (environmentId: string | null) =>
			setActiveEnvironment(workspaceId ?? "", environmentId),
		onMutate: async (environmentId) => {
			const key = activeEnvironmentKey(workspaceId ?? "");
			await client.cancelQueries({ queryKey: key });
			const previous = client.getQueryData<ActiveEnvironment>(key);
			client.setQueryData<ActiveEnvironment>(key, {
				workspaceId: workspaceId ?? "",
				environmentId,
			});
			return { previous };
		},
		onError: (error, _id, context) => {
			client.setQueryData(
				activeEnvironmentKey(workspaceId ?? ""),
				context?.previous,
			);
			toast.show({
				tone: "error",
				title: t("environments.errors.activeFailed"),
				description: errorMessage(error),
			});
		},
		onSuccess: (active) =>
			client.setQueryData(activeEnvironmentKey(active.workspaceId), active),
	});
}
