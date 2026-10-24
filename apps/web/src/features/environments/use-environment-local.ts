import type { EnvironmentDetail } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { withAgentCopies } from "../secure-vault/agent-use/agent-copy";
import { useAgentUse } from "../secure-vault/agent-use/use-agent-use";
import { useResealLegacy } from "../secure-vault/use-reseal-legacy";
import {
	environmentScope,
	openLocalValues,
	useVaultValues,
} from "../secure-vault/vault-codec";
import {
	type LocalValueWrite,
	setEnvironmentLocalValues,
} from "./local-values-api";
import { environmentKey, storeLocalValues } from "./use-environments";

/**
 * The caller's own values of an environment as its editor uses them:
 * opened through the vault, saved sealed (with the agent copies of the
 * ones agents may use), and plain values of secrets moved into the vault.
 */
export function useEnvironmentLocal(environment: EnvironmentDetail) {
	const client = useQueryClient();
	const { id } = environment;
	useVaultValues();
	const localValues = openLocalValues(
		environmentScope(id),
		environment.localValues,
	);
	const agent = useAgentUse(
		{ kind: "environment", id },
		environment.variables,
		localValues,
	);
	const saveLocal = async (values: LocalValueWrite[]) =>
		storeLocalValues(
			client,
			environmentKey(id),
			await setEnvironmentLocalValues(
				id,
				withAgentCopies(values, agent.keys),
				agent.secrets,
			),
		);
	useResealLegacy(
		environmentScope(id),
		environment.localValues,
		agent.secrets,
		saveLocal,
	);
	return { localValues, agent, saveLocal };
}
