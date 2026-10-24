/**
 * The variable scopes of a tab as the query cache holds them, kept live
 * for the highlighter: a write that stores its answer in the cache
 * recolours every `{{name}}` at once. `null` while environments are off:
 * the editors then behave as before.
 */
import type { ResolverLayer } from "@localman/shared/api-client";
import { useMemo } from "react";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import { useCollection } from "../collections/use-collections";
import {
	useActiveEnvironment,
	useCollectionLocalValues,
	useEnvironment,
	useGlobals,
} from "../environments/use-environments";
import { useEnvironmentsEnabled } from "../environments/use-environments-enabled";
import { useVaultValues } from "../secure-vault/vault-codec";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import {
	type VariableTargets,
	buildVariableLayers,
	scopeTarget,
} from "./variable-targets";

export interface VariableScopes {
	layers: readonly ResolverLayer[];
	targets: VariableTargets;
}

export function useVariableScopes(
	tab: Pick<WorkbenchTab, "source" | "temporary">,
): VariableScopes | null {
	const enabled = useEnvironmentsEnabled();
	const workspaceId = useCurrentWorkspace(enabled).current?.id ?? null;
	const scoped = enabled ? workspaceId : null;
	const globals = useGlobals(scoped).data;
	const activeId = useActiveEnvironment(scoped).data?.environmentId ?? null;
	const environment = useEnvironment(enabled ? activeId : null).data;
	const collectionId = enabled ? (tab.source?.collectionId ?? null) : null;
	const collection = useCollection(
		collectionId ?? "",
		collectionId !== null,
	).data;
	const collectionLocal = useCollectionLocalValues(collectionId).data;
	const { temporary } = tab;
	// Decrypted vault values landing (or the vault locking) redraw the layers.
	const vaultValues = useVaultValues();

	// biome-ignore lint/correctness/useExhaustiveDependencies: `vaultValues` changes when vault values decrypt or lock; `buildVariableLayers` reads them from the codec's cache.
	return useMemo(() => {
		if (!enabled) return null;
		const layers = buildVariableLayers({
			globals,
			collection,
			collectionLocal,
			collectionId: collectionId ?? undefined,
			environment,
			temporary,
		});
		const targets: VariableTargets = {
			workspaceId,
			environment: environment
				? {
						id: environment.id,
						name: environment.name,
						...scopeTarget(
							environment.role === "editor",
							environment.variables,
							environment.localValues,
						),
					}
				: null,
			collection: collection
				? {
						id: collection.id,
						name: collection.name,
						...scopeTarget(
							collection.role === "editor",
							collection.variables,
							collectionLocal ?? [],
						),
					}
				: null,
			globals: globals
				? scopeTarget(
						globals.role === "editor",
						globals.variables,
						globals.localValues,
					)
				: null,
		};
		return { layers, targets };
	}, [
		enabled,
		workspaceId,
		globals,
		collection,
		collectionLocal,
		collectionId,
		environment,
		temporary,
		vaultValues,
	]);
}
