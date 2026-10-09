import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { generateResourceData } from "./resource-data-api";
import type { DataChange, Resource } from "./resource-model";
import { fetchResources } from "./resources-api";

export const resourcesKey = (projectId: string) =>
	["projects", projectId, "resources"] as const;

export function useResources(projectId: string) {
	return useQuery({
		queryKey: resourcesKey(projectId),
		queryFn: () => fetchResources(projectId),
	});
}

/** The list with the record counts a write reported. */
export function withChanges(
	list: readonly Resource[],
	changes: readonly DataChange[],
): Resource[] {
	const after = new Map(changes.map((c) => [c.resourceId, c.countAfter]));
	return list.map((resource) => {
		const count = after.get(resource.id);
		return count === undefined ? resource : { ...resource, count };
	});
}

export interface ResourceCache {
	/** Writes reported counts into the cached list (no refetch). */
	applyChanges: (changes: readonly DataChange[]) => void;
	/** Refetches after writes that change the tree or schemas. */
	invalidate: () => Promise<void>;
}

function cacheOf(client: QueryClient, projectId: string): ResourceCache {
	const key = resourcesKey(projectId);
	return {
		applyChanges: (changes) =>
			client.setQueryData<Resource[]>(key, (list) =>
				list ? withChanges(list, changes) : list,
			),
		invalidate: () => client.invalidateQueries({ queryKey: key }),
	};
}

export function useResourceCache(projectId: string): ResourceCache {
	const client = useQueryClient();
	return useMemo(() => cacheOf(client, projectId), [client, projectId]);
}

export interface GenerateVariables {
	resource: Resource;
	count: number;
}

const generateKey = (projectId: string) =>
	["projects", projectId, "generate"] as const;

/** The list with one resource's count replaced. */
function withCount(
	list: Resource[] | undefined,
	resourceId: string,
	count: number,
): Resource[] | undefined {
	return list?.map((item) =>
		item.id === resourceId ? { ...item, count } : item,
	);
}

/**
 * Generator bar write. The bar shows the new count at once (optimistic);
 * requests of one project run one after another (mutation scope), so
 * answers cannot arrive out of order. A refused write puts back only that
 * resource's previous count, a success takes the counts the API reports
 * (children may be reset too), and the last write to settle refetches the
 * list so the cache ends on the server's truth.
 */
export function useGenerateResource(projectId: string) {
	const client = useQueryClient();
	const key = resourcesKey(projectId);
	return useMutation({
		mutationKey: generateKey(projectId),
		scope: { id: `generate-${projectId}` },
		mutationFn: ({ resource, count }: GenerateVariables) =>
			generateResourceData(projectId, resource.id, count),
		onMutate: async ({ resource, count }: GenerateVariables) => {
			await client.cancelQueries({ queryKey: key });
			const previous = client
				.getQueryData<Resource[]>(key)
				?.find((item) => item.id === resource.id)?.count;
			client.setQueryData<Resource[]>(key, (list) =>
				withCount(list, resource.id, count),
			);
			return { previous };
		},
		onError: (_error, { resource }, context) => {
			const previous = context?.previous;
			if (previous === undefined) return;
			client.setQueryData<Resource[]>(key, (list) =>
				withCount(list, resource.id, previous),
			);
		},
		onSuccess: (changes) => cacheOf(client, projectId).applyChanges(changes),
		onSettled: async () => {
			// This write still counts as pending here; refetch once the queue
			// is empty so a later optimistic value is not overwritten.
			if (client.isMutating({ mutationKey: generateKey(projectId) }) <= 1) {
				await client.invalidateQueries({ queryKey: key });
			}
		},
	});
}
