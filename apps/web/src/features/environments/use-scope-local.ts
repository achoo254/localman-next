import type { LocalValue, VariableView } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { withAgentCopies } from "../secure-vault/agent-use/agent-copy";
import { useAgentUse } from "../secure-vault/agent-use/use-agent-use";
import { openScopeValues } from "../secure-vault/open-scope-values";
import { useResealLegacy } from "../secure-vault/use-reseal-legacy";
import { type LocalTarget, useVaultValues } from "../secure-vault/vault-codec";
import {
	type LocalValueWrite,
	environmentLocalTarget,
	globalsLocalTarget,
	patchLocal,
} from "./local-values-api";
import {
	environmentKey,
	globalsKey,
	storeLocalValues,
} from "./use-environments";

export interface ScopeLocalInput {
	kind: "environment" | "global";
	/** Environment id, or the workspace id of the globals. */
	id: string;
	variables: readonly VariableView[];
	/** As the server sent them (vault values still sealed). */
	localValues: readonly LocalValue[];
}

const NONE: ReadonlySet<string> = new Set();

/**
 * The caller's own values of an environment or the globals as the table
 * uses them: opened through the vault, saved sealed (secret names of the
 * server and of the drafts alike) with the agents' copies, and plain
 * values of secrets saved before the vault moved into it.
 */
export function useScopeLocal(input: ScopeLocalInput) {
	const client = useQueryClient();
	const { kind, id } = input;
	useVaultValues();
	const localValues = openScopeValues(kind, id, input.localValues);
	const agent = useAgentUse({ kind, id }, input.variables, localValues);
	const cacheKey = kind === "environment" ? environmentKey(id) : globalsKey(id);
	const targetOf = (secrets: ReadonlySet<string>): LocalTarget =>
		kind === "environment"
			? environmentLocalTarget(id, secrets)
			: globalsLocalTarget(id, secrets);
	const store = (values: LocalValue[]) =>
		storeLocalValues(client, cacheKey, values);

	const saveLocal = async (
		values: LocalValueWrite[],
		draftSecrets: ReadonlySet<string> = NONE,
	) => {
		// A variable switched to secret but not saved yet is sealed already.
		const secrets = new Set([...agent.secrets, ...draftSecrets]);
		store(
			await patchLocal(
				targetOf(secrets),
				withAgentCopies(values, agent.keys, secrets),
			),
		);
	};
	useResealLegacy(
		targetOf(agent.secrets),
		input.localValues,
		() =>
			client.getQueryData<{ localValues: LocalValue[] }>(cacheKey)?.localValues,
		store,
	);
	return { localValues, agent, saveLocal };
}
