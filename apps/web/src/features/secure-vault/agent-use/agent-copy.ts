/**
 * The copy of a vault value that agents may use (ADR-0009): the browser
 * sends the plaintext as `agentValue` along with the value's ciphertext,
 * and the server keeps it encrypted with its own key. A new local value
 * sent without it drops the copy, so every write of a value whose use is
 * on carries it again.
 */
import type { QueryClient } from "@tanstack/react-query";
import {
	type LocalValueWrite,
	setEnvironmentLocalValues,
	setGlobalsLocalValues,
} from "../../environments/local-values-api";
import {
	collectionLocalKey,
	environmentKey,
	globalsKey,
	storeLocalValues,
} from "../../environments/use-environments";
import { setCollectionLocalValues } from "../../environments/variable-scopes-api";
import type { AgentUseTarget } from "./agent-use-api";

/**
 * Writes with the agents' copy added to each value set for a name in
 * `agentKeys` (the secrets whose use is on). Removing a value keeps the
 * use: agents then use the shared value, for the same hosts.
 */
export function withAgentCopies(
	writes: readonly LocalValueWrite[],
	agentKeys: ReadonlySet<string>,
): LocalValueWrite[] {
	return writes.map((write) =>
		write.value !== null &&
		write.agentValue === undefined &&
		agentKeys.has(write.key)
			? { ...write, agentValue: write.value }
			: write,
	);
}

/**
 * Sends the local value `value` of `key` again with its copy for agents,
 * and keeps the answer in the scope's cache.
 */
export async function writeAgentCopy(
	client: QueryClient,
	target: AgentUseTarget,
	secretKeys: ReadonlySet<string>,
	key: string,
	value: string,
): Promise<void> {
	const writes: LocalValueWrite[] = [{ key, value, agentValue: value }];
	switch (target.kind) {
		case "environment":
			storeLocalValues(
				client,
				environmentKey(target.id),
				await setEnvironmentLocalValues(target.id, writes, secretKeys),
			);
			return;
		case "global":
			storeLocalValues(
				client,
				globalsKey(target.id),
				await setGlobalsLocalValues(target.id, writes, secretKeys),
			);
			return;
		case "collection":
			client.setQueryData(
				collectionLocalKey(target.id),
				await setCollectionLocalValues(target.id, writes, secretKeys),
			);
			return;
	}
}
