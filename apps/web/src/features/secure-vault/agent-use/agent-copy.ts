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
 * Names whose new local value must carry a copy for agents: those the
 * server says keep one (`agentUse` of the local values it answered) and
 * those whose use is on (`uses`, when loaded), whose copy must start.
 */
export function agentCopyKeys(
	localValues: readonly { key: string; agentUse?: boolean }[],
	uses: readonly { key: string }[] | null | undefined,
): Set<string> {
	return new Set([
		...localValues.filter((entry) => entry.agentUse).map((entry) => entry.key),
		...(uses ?? []).map((use) => use.key),
	]);
}

/**
 * Writes with the agents' copy added to each value set for a name in
 * `agentKeys` that is still a secret (`secretKeys`: a copy of anything
 * else is refused). Removing a value keeps the use: agents then use the
 * shared value, for the same hosts.
 */
export function withAgentCopies(
	writes: readonly LocalValueWrite[],
	agentKeys: ReadonlySet<string>,
	secretKeys: ReadonlySet<string>,
): LocalValueWrite[] {
	return writes.map((write) =>
		write.value !== null &&
		write.agentValue === undefined &&
		agentKeys.has(write.key) &&
		secretKeys.has(write.key)
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
