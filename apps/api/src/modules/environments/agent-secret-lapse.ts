import type { VariableEntry } from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { AgentSecretUseModel } from "../secret-vault/agent-secret-use-model.js";
import { LocalVariableValueModel } from "./local-variable-value-model.js";
import { collectionScope } from "./scope-local-service.js";

/**
 * Variables of a scope that stopped being secrets (type changed back or
 * variable removed) lose what agents were let use (ADR-0009): everyone's
 * hosts for them and the copies of their vault values. A secret made
 * again under the same name then starts with no hosts, instead of
 * silently going back to where the old one could go.
 */
export async function dropAgentSecretUses(
	scope: string,
	keys: readonly string[],
	session?: ClientSession,
): Promise<void> {
	if (keys.length === 0) return;
	const names = { $in: [...keys] };
	await AgentSecretUseModel.deleteMany({ scope, key: names }, { session });
	await LocalVariableValueModel.updateMany(
		{ scope, key: names, agentValue: { $exists: true } },
		{ $unset: { agentValue: "" as const } },
		{ session },
	);
}

function secretNames(variables: readonly VariableEntry[]): Set<string> {
	return new Set(
		variables
			.filter((variable) => variable.secret === true)
			.map((variable) => variable.key),
	);
}

/**
 * A collection's variables were rewritten from `before` to `after` (an
 * edit, restore, merge, pull or sync): names flagged `secret` before and
 * not after lose their agent uses, in the writer's transaction.
 */
export async function dropLapsedCollectionSecrets(
	collectionId: Types.ObjectId,
	before: readonly VariableEntry[],
	after: readonly VariableEntry[],
	session: ClientSession,
): Promise<void> {
	const still = secretNames(after);
	const lapsed = [...secretNames(before)].filter((key) => !still.has(key));
	await dropAgentSecretUses(collectionScope(collectionId), lapsed, session);
}
