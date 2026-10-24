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
import { collectionKey } from "../collections/use-collections";
import { secretNames } from "../secure-vault/vault-codec";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import {
	setEnvironmentLocalValues,
	setGlobalsLocalValues,
} from "./local-values-api";
import {
	activeEnvironmentKey,
	collectionLocalKey,
	environmentKey,
	globalsKey,
	storeLocalValues,
} from "./use-environments";
import { useEnvironmentsEnabled } from "./use-environments-enabled";
import { setCollectionLocalValues } from "./variable-scopes-api";

export interface ScriptScopeTargets {
	workspaceId: string;
	environmentId: string | null;
	/** The collection of the request that ran the scripts, if bound to one. */
	collectionId: string | null;
}

export async function saveScriptScopes(
	client: QueryClient,
	targets: ScriptScopeTargets,
	changes: ScriptScopeChanges,
): Promise<ScopeSaveResult> {
	const { workspaceId, environmentId, collectionId } = targets;
	const saves: Promise<unknown>[] = [];
	const secretsIn = (key: readonly unknown[]) =>
		secretNames(
			client.getQueryData<{
				variables: { key: string; type?: string; secret?: boolean }[];
			}>(key)?.variables ?? [],
		);
	const dropped: ScopeSaveResult["dropped"] = [];
	if (changes.environment.length > 0 && !environmentId) {
		dropped.push("environment");
	}
	if (changes.collectionVariables.length > 0 && !collectionId) {
		dropped.push("collectionVariables");
	}
	if (changes.globals.length > 0) {
		saves.push(
			setGlobalsLocalValues(
				workspaceId,
				changes.globals,
				secretsIn(globalsKey(workspaceId)),
			).then((values) =>
				storeLocalValues(client, globalsKey(workspaceId), values),
			),
		);
	}
	if (changes.environment.length > 0 && environmentId) {
		saves.push(
			setEnvironmentLocalValues(
				environmentId,
				changes.environment,
				secretsIn(environmentKey(environmentId)),
			).then((values) =>
				storeLocalValues(client, environmentKey(environmentId), values),
			),
		);
	}
	if (changes.collectionVariables.length > 0 && collectionId) {
		saves.push(
			setCollectionLocalValues(
				collectionId,
				changes.collectionVariables,
				secretsIn(collectionKey(collectionId)),
			).then((values) =>
				client.setQueryData(collectionLocalKey(collectionId), values),
			),
		);
	}
	const results = await Promise.allSettled(saves);
	const saved = results.every((result) => result.status === "fulfilled");
	return { saved, dropped };
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
