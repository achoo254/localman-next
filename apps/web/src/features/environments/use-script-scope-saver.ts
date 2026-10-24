/**
 * Saves what scripts set or unset in `lm.globals`, `lm.collectionVariables`
 * and `lm.environment` as the caller's local values (never shared ones,
 * as in Postman), then updates the cached tables so they show it.
 */
import type {
	ActiveEnvironment,
	ScriptScopeChanges,
} from "@localman/shared/api-client";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type {
	SaveScopes,
	ScopeSaveResult,
} from "../api-client/workbench/send-hooks";
import { fetchCollection } from "../collections/collections-api";
import { collectionKey } from "../collections/use-collections";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import { fetchEnvironment, fetchGlobals } from "./environments-api";
import {
	setEnvironmentLocalValues,
	setGlobalsLocalValues,
} from "./local-values-api";
import {
	type ScriptScope,
	scopeFetch,
	writeScriptScope,
} from "./script-scope-write";
import {
	activeEnvironmentKey,
	collectionLocalKey,
	environmentKey,
	globalsKey,
	storeLocalValues,
} from "./use-environments";
import { useEnvironmentsEnabled } from "./use-environments-enabled";
import {
	fetchCollectionLocalValues,
	setCollectionLocalValues,
} from "./variable-scopes-api";

export interface ScriptScopeTargets {
	workspaceId: string;
	environmentId: string | null;
	/** The collection of the request that ran the scripts, if bound to one. */
	collectionId: string | null;
}

const globalsScope = (client: QueryClient, id: string): ScriptScope => ({
	agentTarget: { kind: "global", id },
	load: () =>
		client.fetchQuery({
			queryKey: globalsKey(id),
			queryFn: () => fetchGlobals(id),
			...scopeFetch,
		}),
	write: async (values, secrets) =>
		storeLocalValues(
			client,
			globalsKey(id),
			await setGlobalsLocalValues(id, values, secrets),
		),
});

const environmentScope = (client: QueryClient, id: string): ScriptScope => ({
	agentTarget: { kind: "environment", id },
	load: () =>
		client.fetchQuery({
			queryKey: environmentKey(id),
			queryFn: () => fetchEnvironment(id),
			...scopeFetch,
		}),
	write: async (values, secrets) =>
		storeLocalValues(
			client,
			environmentKey(id),
			await setEnvironmentLocalValues(id, values, secrets),
		),
});

const collectionScope = (client: QueryClient, id: string): ScriptScope => ({
	agentTarget: { kind: "collection", id },
	load: async () => {
		const [detail, localValues] = await Promise.all([
			client.fetchQuery({
				queryKey: collectionKey(id),
				queryFn: () => fetchCollection(id),
				...scopeFetch,
			}),
			client.fetchQuery({
				queryKey: collectionLocalKey(id),
				queryFn: () => fetchCollectionLocalValues(id),
				...scopeFetch,
			}),
		]);
		return { variables: detail.variables, localValues };
	},
	write: async (values, secrets) => {
		client.setQueryData(
			collectionLocalKey(id),
			await setCollectionLocalValues(id, values, secrets),
		);
	},
});

export async function saveScriptScopes(
	client: QueryClient,
	targets: ScriptScopeTargets,
	changes: ScriptScopeChanges,
): Promise<ScopeSaveResult> {
	const { workspaceId, environmentId, collectionId } = targets;
	const saves: ReturnType<typeof writeScriptScope>[] = [];
	const dropped: ScopeSaveResult["dropped"] = [];
	if (changes.environment.length > 0 && !environmentId) {
		dropped.push("environment");
	}
	if (changes.collectionVariables.length > 0 && !collectionId) {
		dropped.push("collectionVariables");
	}
	const save = (scope: ScriptScope, writes: ScriptScopeChanges["globals"]) =>
		saves.push(writeScriptScope(client, scope, writes));
	if (changes.globals.length > 0) {
		save(globalsScope(client, workspaceId), changes.globals);
	}
	if (changes.environment.length > 0 && environmentId) {
		save(environmentScope(client, environmentId), changes.environment);
	}
	if (changes.collectionVariables.length > 0 && collectionId) {
		save(collectionScope(client, collectionId), changes.collectionVariables);
	}
	const results = await Promise.allSettled(saves);
	const saved = results.every(
		(result) => result.status === "fulfilled" && result.value.saved,
	);
	const withheld = results.flatMap((result) =>
		result.status === "fulfilled" ? result.value.withheld : [],
	);
	return withheld.length > 0
		? { saved, dropped, withheld }
		: { saved, dropped };
}

/** `undefined` while environments are off: script changes stay in the send. */
export function useScriptScopeSaver(): SaveScopes | undefined {
	const enabled = useEnvironmentsEnabled();
	const client = useQueryClient();
	const workspaceId = useCurrentWorkspace(enabled).current?.id ?? null;
	return useMemo(() => {
		if (!enabled || workspaceId === null) return undefined;
		return (collectionId) => {
			// Read when the send starts: switching environments before the
			// response comes back must not move the changes to the new one.
			const active = client.getQueryData<ActiveEnvironment>(
				activeEnvironmentKey(workspaceId),
			);
			const environmentId = active?.environmentId ?? null;
			const targets = { workspaceId, environmentId, collectionId };
			return (changes) => saveScriptScopes(client, targets, changes);
		};
	}, [enabled, workspaceId, client]);
}
