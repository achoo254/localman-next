/**
 * The variable scopes of a send while environments are on: the current
 * workspace's globals, the bound tab's collection and the active
 * environment, each with the caller's local values. Read through the
 * query cache (fetched when stale, the cached copy when that fails), so
 * what the tables show is what goes; skipped for a request using none.
 */
import { extractUsedVariables } from "@localman/shared/api-client";
import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { VariablesOf } from "../api-client/workbench/send-hooks";
import { buildVariableLayers } from "../variables/variable-targets";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import { fetchEnvironment, fetchGlobals } from "./environments-api";
import {
	activeEnvironmentKey,
	collectionLocalKey,
	environmentKey,
	globalsKey,
} from "./use-environments";
import { useEnvironmentsEnabled } from "./use-environments-enabled";
import {
	fetchActiveEnvironment,
	fetchCollectionLocalValues,
} from "./variable-scopes-api";

const FRESH_MS = 15_000;

export function useVariableLayers(): VariablesOf | undefined {
	const enabled = useEnvironmentsEnabled();
	const client = useQueryClient();
	const workspaceId = useCurrentWorkspace(enabled).current?.id ?? null;
	return useMemo(() => {
		if (!enabled || workspaceId === null) return undefined;
		// A stale entry is refetched; when that fails, the cached one serves.
		const read = async <T>(
			queryKey: QueryKey,
			queryFn: () => Promise<T>,
		): Promise<T> => {
			try {
				return await client.fetchQuery({
					queryKey,
					queryFn,
					staleTime: FRESH_MS,
				});
			} catch (error) {
				const cached = client.getQueryData<T>(queryKey);
				if (cached === undefined) throw error;
				return cached;
			}
		};
		const layersOf: VariablesOf = async (tab, context) => {
			// A request without `{{name}}` and without scripts (which read
			// `lm.environment` and friends) needs no variables: it never
			// waits on the dashboard API.
			const draft =
				context && tab.draft.auth.type === "inherit"
					? { ...tab.draft, auth: context.inheritedAuth }
					: tab.draft;
			const scripts = context
				? [...context.preScripts, ...context.postScripts]
				: [draft.scripts.pre, draft.scripts.post];
			const scripted = scripts.some((script) => script.trim() !== "");
			const usesVariables = extractUsedVariables(draft).length > 0;
			if (!scripted && !usesVariables) return undefined;
			try {
				return await load(tab, context);
			} catch (error) {
				// Scripts alone (tests, logs) need no values: the request still
				// goes out, its scripts seeing empty scopes.
				if (!usesVariables) return undefined;
				throw error;
			}
		};
		const load = async (
			tab: Parameters<VariablesOf>[0],
			context: Parameters<VariablesOf>[1],
		) => {
			const [globals, active] = await Promise.all([
				read(globalsKey(workspaceId), () => fetchGlobals(workspaceId)),
				read(activeEnvironmentKey(workspaceId), () =>
					fetchActiveEnvironment(workspaceId),
				),
			]);
			const environmentId = active.environmentId;
			const [environment, collectionLocal] = await Promise.all([
				environmentId
					? read(environmentKey(environmentId), () =>
							fetchEnvironment(environmentId),
						)
					: null,
				tab.source && context
					? read(collectionLocalKey(tab.source.collectionId), () =>
							fetchCollectionLocalValues(tab.source?.collectionId ?? ""),
						)
					: [],
			]);
			return buildVariableLayers({
				globals,
				collection: context ? { variables: context.variables } : undefined,
				collectionLocal,
				environment: environment ?? undefined,
				// The tab's temporary layer goes on top in useSendTab.
				temporary: [],
			});
		};
		return layersOf;
	}, [enabled, workspaceId, client]);
}
