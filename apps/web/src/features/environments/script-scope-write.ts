/**
 * One scope's share of what scripts set: written as the caller's local
 * values with the same care as the tables. Which names are secrets comes
 * from the scope itself (fetched when not cached), never assumed: without
 * it nothing is written, so a secret never goes out plain. A value set for
 * a secret agents may use carries its copy (ADR-0009), or the server
 * would drop the copy. A value for a name that is not a secret but holds
 * a value of the vault in plain text is not written: it would carry the
 * secret out of the vault (to the server, readable by agents).
 */
import type { LocalValue } from "@localman/shared/api-client";
import type { QueryClient } from "@tanstack/react-query";
import {
	agentCopyKeys,
	withAgentCopies,
} from "../secure-vault/agent-use/agent-copy";
import {
	type AgentSecretUse,
	type AgentUseTarget,
	agentUsesKey,
	fetchAgentUses,
} from "../secure-vault/agent-use/agent-use-api";
import { openVaultValues, secretNames } from "../secure-vault/vault-codec";
import { loadVault } from "../secure-vault/vault-session";
import type { LocalValueWrite } from "./local-values-api";

/** Fresh enough to read the scope's secret names from the cache. */
const STALE_MS = 15_000;

export interface ScriptScope {
	agentTarget: AgentUseTarget;
	/** The scope's variables and the caller's local values (as stored). */
	load: () => Promise<{
		variables: readonly { key: string; type?: string; secret?: boolean }[];
		localValues: readonly LocalValue[];
	}>;
	write: (
		values: LocalValueWrite[],
		secretKeys: ReadonlySet<string>,
	) => Promise<void>;
}

/** The uses of the scope, `undefined` when they cannot be read now. */
async function usesOf(
	client: QueryClient,
	target: AgentUseTarget,
): Promise<AgentSecretUse[] | null | undefined> {
	try {
		// A server without the vault has no uses (and refuses copies).
		if ((await loadVault()).status === "off") return null;
		return await client.fetchQuery({
			queryKey: agentUsesKey(target),
			queryFn: () => fetchAgentUses(target),
			staleTime: STALE_MS,
		});
	} catch {
		return undefined;
	}
}

export interface ScriptScopeWrite {
	/** Every change that may be written was. */
	saved: boolean;
	/** Names not written: their value held a value of the vault. */
	withheld: string[];
}

/** Changes of names that are not secrets whose value copies a vault value. */
function copiesOfVault(
	changes: readonly LocalValueWrite[],
	secrets: ReadonlySet<string>,
): Set<string> {
	const vault = openVaultValues();
	if (vault.length === 0) return new Set();
	return new Set(
		changes
			.filter(
				({ key, value }) =>
					value !== null &&
					!secrets.has(key) &&
					vault.some((secret) => value.includes(secret)),
			)
			.map(({ key }) => key),
	);
}

/**
 * Writes `changes` to the scope; `saved: false` when some could not go.
 * When the uses cannot be read, the server's own word on each stored
 * value (`agentUse`) still marks which values keep a copy.
 */
export async function writeScriptScope(
	client: QueryClient,
	scope: ScriptScope,
	all: readonly LocalValueWrite[],
): Promise<ScriptScopeWrite> {
	let loaded: Awaited<ReturnType<ScriptScope["load"]>>;
	try {
		loaded = await scope.load();
	} catch {
		return { saved: false, withheld: [] };
	}
	const secrets = secretNames(loaded.variables);
	const withheld = copiesOfVault(all, secrets);
	const changes = all.filter(({ key }) => !withheld.has(key));
	if (changes.length === 0) return { saved: true, withheld: [...withheld] };
	const setsSecret = changes.some(
		(change) => change.value !== null && secrets.has(change.key),
	);
	const uses = setsSecret ? await usesOf(client, scope.agentTarget) : undefined;
	const writes = withAgentCopies(
		changes,
		agentCopyKeys(loaded.localValues, uses),
		secrets,
	);
	await scope.write(writes, secrets);
	return { saved: true, withheld: [...withheld] };
}

export const scopeFetch = { staleTime: STALE_MS };
