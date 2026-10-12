/**
 * Writing an Editor's variable chosen in "Set as variable" or "Add to":
 * the value becomes the shared value (synced to everyone) through the
 * same APIs as the tables. Each write starts from a fresh copy (the API
 * replaces the whole list) and stores the answer in the query cache,
 * which recolours the editors. Only once the shared value is saved, a
 * local value of the caller for that name is reset, or it would keep
 * hiding the new value.
 */
import type { LocalValue } from "@localman/shared/api-client";
import type { QueryClient } from "@tanstack/react-query";
import {
	fetchCollection,
	updateCollection,
} from "../collections/collections-api";
import { collectionKey } from "../collections/use-collections";
import {
	type LocalValueWrite,
	fetchEnvironment,
	fetchGlobals,
	setEnvironmentLocalValues,
	setEnvironmentVariables,
	setGlobals,
	setGlobalsLocalValues,
} from "../environments/environments-api";
import {
	collectionLocalKey,
	environmentKey,
	globalsKey,
	storeEnvironment,
	storeLocalValues,
} from "../environments/use-environments";
import {
	fetchCollectionLocalValues,
	setCollectionLocalValues,
} from "../environments/variable-scopes-api";
import type { TargetScope, VariableTargets } from "./variable-targets";
import {
	upsertCollectionVariable,
	upsertSharedVariable,
} from "./variable-writes";

export interface VariableWriteRequest {
	scope: Exclude<TargetScope, "temporary">;
	key: string;
	value: string;
}

/**
 * What happened to the caller's local value of the name: none to reset,
 * reset, or still there because resetting it failed (it keeps winning).
 */
export type LocalOutcome = "none" | "reset" | "kept";

/** One scope's way to read and write: shared list, then local values. */
interface ScopeWriter {
	localValues: readonly LocalValue[];
	saveShared: () => Promise<void>;
	resetLocal: (values: LocalValueWrite[]) => Promise<void>;
}

async function writerFor(
	client: QueryClient,
	targets: VariableTargets,
	{ scope, key, value }: VariableWriteRequest,
): Promise<ScopeWriter> {
	const fresh = <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
		client.fetchQuery({ queryKey, queryFn, staleTime: 0 });
	if (scope === "environment") {
		const id = targets.environment?.id;
		if (!id) throw new Error("No active environment");
		const current = await fresh(environmentKey(id), () => fetchEnvironment(id));
		const writes = upsertSharedVariable(current.variables, key, value);
		return {
			localValues: current.localValues,
			saveShared: async () =>
				storeEnvironment(client, await setEnvironmentVariables(id, writes)),
			resetLocal: async (values) =>
				storeLocalValues(
					client,
					environmentKey(id),
					await setEnvironmentLocalValues(id, values),
				),
		};
	}
	if (scope === "global") {
		const workspaceId = targets.workspaceId;
		if (!workspaceId) throw new Error("No workspace");
		const queryKey = globalsKey(workspaceId);
		const current = await fresh(queryKey, () => fetchGlobals(workspaceId));
		const writes = upsertSharedVariable(current.variables, key, value);
		return {
			localValues: current.localValues,
			saveShared: async () => {
				client.setQueryData(queryKey, await setGlobals(workspaceId, writes));
			},
			resetLocal: async (values) =>
				storeLocalValues(
					client,
					queryKey,
					await setGlobalsLocalValues(workspaceId, values),
				),
		};
	}
	const id = targets.collection?.id;
	if (!id) throw new Error("No collection");
	const [current, localValues] = await Promise.all([
		fresh(collectionKey(id), () => fetchCollection(id)),
		fresh(collectionLocalKey(id), () => fetchCollectionLocalValues(id)),
	]);
	const variables = upsertCollectionVariable(current.variables, key, value);
	return {
		localValues,
		saveShared: async () => {
			client.setQueryData(
				collectionKey(id),
				await updateCollection(id, { variables }),
			);
		},
		resetLocal: async (values) => {
			client.setQueryData(
				collectionLocalKey(id),
				await setCollectionLocalValues(id, values),
			);
		},
	};
}

/**
 * Writes an Editor's variable to its scope. Rejects (with the API error)
 * when the scope is gone or refuses the shared value; a failed local
 * reset after that does not reject, it comes back as `kept`.
 */
export async function writeSharedVariable(
	client: QueryClient,
	targets: VariableTargets,
	request: VariableWriteRequest,
): Promise<LocalOutcome> {
	const key = request.key.trim();
	const writer = await writerFor(client, targets, { ...request, key });
	await writer.saveShared();
	if (!writer.localValues.some((local) => local.key === key)) return "none";
	try {
		await writer.resetLocal([{ key, value: null }]);
		return "reset";
	} catch {
		return "kept";
	}
}
