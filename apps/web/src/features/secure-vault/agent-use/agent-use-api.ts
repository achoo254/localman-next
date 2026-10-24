/**
 * The caller's list of secrets their agents may use, per scope
 * (`/api/v1/agent-secret-uses/:kind/:id`, ADR-0009). Only a browser
 * session changes it; 404 means the server does not run the vault.
 */
import { ApiError, apiRequest } from "../../../lib/api-client";
import { expectRecord, isRecord } from "../../../lib/json-guards";

export type AgentUseKind = "environment" | "collection" | "global";

export interface AgentUseTarget {
	readonly kind: AgentUseKind;
	/** Environment, collection or (globals) workspace id. */
	readonly id: string;
}

export interface AgentSecretUse {
	key: string;
	hosts: string[];
}

const pathOf = (target: AgentUseTarget, key?: string): string => {
	const base = `/api/v1/agent-secret-uses/${target.kind}/${encodeURIComponent(target.id)}`;
	return key === undefined ? base : `${base}/${encodeURIComponent(key)}`;
};

function parseUse(value: unknown): AgentSecretUse {
	if (
		!isRecord(value) ||
		typeof value.key !== "string" ||
		!Array.isArray(value.hosts) ||
		!value.hosts.every((host) => typeof host === "string")
	) {
		throw new ApiError(500, "INVALID_RESPONSE", "Invalid agent secret use");
	}
	return { key: value.key, hosts: value.hosts.filter(isString) };
}

const isString = (value: unknown): value is string => typeof value === "string";

/**
 * `null` on 404: the server does not run the vault (or the scope is gone,
 * which its page already says); either way there is nothing to show.
 */
export async function fetchAgentUses(
	target: AgentUseTarget,
): Promise<AgentSecretUse[] | null> {
	try {
		const data = expectRecord(await apiRequest(pathOf(target)), "agent uses");
		if (!Array.isArray(data.uses)) {
			throw new ApiError(500, "INVALID_RESPONSE", "Invalid agent uses");
		}
		return data.uses.map(parseUse);
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) return null;
		throw error;
	}
}

/** Turns it on, or replaces its hosts. */
export async function saveAgentUse(
	target: AgentUseTarget,
	key: string,
	hosts: readonly string[],
): Promise<AgentSecretUse> {
	return parseUse(
		await apiRequest(pathOf(target, key), {
			method: "PUT",
			body: { hosts },
		}),
	);
}

/** Stops it; the server drops the agents' copy of a vault value too. */
export async function removeAgentUse(
	target: AgentUseTarget,
	key: string,
): Promise<void> {
	await apiRequest(pathOf(target, key), { method: "DELETE" });
}
