import { OperationError } from "@localman/operations";
import { requireCollection } from "../collections/collection-access.js";
import type { SecretTest } from "../environments/agent-secret-mask.js";
import { requireEnvironment } from "../environments/environment-access.js";
import { environmentScope } from "../environments/environment-model.js";
import { globalsScope } from "../environments/global-variables-model.js";
import { getGlobals } from "../environments/globals-service.js";
import { LocalVariableValueModel } from "../environments/local-variable-value-model.js";
import { collectionScope } from "../environments/scope-local-service.js";
import {
	collectionSecrets,
	environmentSecrets,
	globalsSecrets,
} from "../environments/scope-secret-keys.js";
import {
	AgentSecretUseModel,
	type StoredAgentSecretUse,
} from "./agent-secret-use-model.js";
import { isLocalmanHost } from "./localman-hosts.js";

export type AgentUseKind = "environment" | "collection" | "global";

export interface AgentUseTarget {
	readonly kind: AgentUseKind;
	/** Environment, collection or (globals) workspace id. */
	readonly id: string;
}

export interface AgentSecretUse {
	readonly key: string;
	readonly hosts: string[];
}

/** The scope behind a target, once the caller may use it, and its secrets. */
async function resolveTarget(
	sub: string,
	target: AgentUseTarget,
): Promise<{ scope: string; isSecret: SecretTest }> {
	switch (target.kind) {
		case "environment": {
			const { environmentId } = await requireEnvironment(sub, target.id, "use");
			return {
				scope: environmentScope(environmentId),
				isSecret: await environmentSecrets(target.id),
			};
		}
		case "collection": {
			const { collectionId } = await requireCollection(sub, target.id, "view");
			return {
				scope: collectionScope(collectionId),
				isSecret: await collectionSecrets(target.id),
			};
		}
		case "global": {
			const globals = await getGlobals(sub, target.id);
			return {
				scope: globalsScope(globals.workspaceId),
				isSecret: await globalsSecrets(target.id),
			};
		}
	}
}

/** The caller's uses in one scope, by name. */
export async function listAgentSecretUses(
	sub: string,
	target: AgentUseTarget,
): Promise<AgentSecretUse[]> {
	const { scope } = await resolveTarget(sub, target);
	const rows = await AgentSecretUseModel.find(
		{ userId: sub, scope },
		{ key: 1, hosts: 1 },
	)
		.sort({ key: 1 })
		.lean<StoredAgentSecretUse[]>();
	return rows.map((row) => ({ key: row.key, hosts: [...row.hosts] }));
}

/**
 * Lets the caller's agents use secret `key` of the scope, sent to `hosts`
 * only (already lowercased by the schema). 400 `AGENT_USE_NOT_SECRET` for
 * a name that is not a secret there; 400 `AGENT_HOST_NOT_ALLOWED` for a
 * host of Localman itself.
 */
export async function setAgentSecretUse(
	sub: string,
	target: AgentUseTarget,
	key: string,
	hosts: readonly string[],
): Promise<AgentSecretUse> {
	const { scope, isSecret } = await resolveTarget(sub, target);
	if (!isSecret(key)) {
		throw new OperationError(
			400,
			"AGENT_USE_NOT_SECRET",
			"Only secret variables need letting agents use them",
		);
	}
	const own = hosts.filter(isLocalmanHost);
	if (own.length > 0) {
		throw new OperationError(
			400,
			"AGENT_HOST_NOT_ALLOWED",
			"A secret is never sent to Localman's own mock, tunnel or app hosts",
			{ hosts: own.join(", ") },
		);
	}
	const unique = [...new Set(hosts)];
	await AgentSecretUseModel.updateOne(
		{ userId: sub, scope, key },
		{ $set: { hosts: unique } },
		{ upsert: true },
	);
	return { key, hosts: unique };
}

/** Stops it, and drops the copy agents had of a vault value. */
export async function removeAgentSecretUse(
	sub: string,
	target: AgentUseTarget,
	key: string,
): Promise<{ removed: boolean }> {
	const { scope } = await resolveTarget(sub, target);
	const { deletedCount } = await AgentSecretUseModel.deleteOne({
		userId: sub,
		scope,
		key,
	});
	await LocalVariableValueModel.updateOne(
		{ userId: sub, scope, key },
		{ $unset: { agentValue: "" as const } },
	);
	return { removed: deletedCount > 0 };
}

/** Hosts per scope and name the caller allowed, for a send. */
export async function agentSecretHosts(
	sub: string,
	scopes: readonly string[],
): Promise<Map<string, readonly string[]>> {
	const rows = await AgentSecretUseModel.find(
		{ userId: sub, scope: { $in: [...scopes] } },
		{ scope: 1, key: 1, hosts: 1 },
	).lean<StoredAgentSecretUse[]>();
	return new Map(rows.map((row) => [hostsKey(row.scope, row.key), row.hosts]));
}

export const hostsKey = (scope: string, key: string): string =>
	`${scope}\u0000${key}`;
