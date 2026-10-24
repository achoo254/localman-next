import { OperationError } from "@localman/operations";
import {
	type ResolverLayer,
	VARIABLE_PATTERN,
	agentHostAllowed,
	resolveVariable,
} from "@localman/shared/api-client";
import {
	agentSecretHosts,
	hostsKey,
} from "../secret-vault/agent-secret-use-service.js";
import { isLocalmanHost } from "../secret-vault/localman-hosts.js";
import type { Layers } from "./agent-variable-layers.js";
import { maskSecrets } from "./secret-mask.js";

/** A filled name whose value is a secret, and the scope it came from. */
interface Guarded {
	readonly name: string;
	readonly scope: string;
}

function namesIn(templates: readonly string[]): Set<string> {
	const names = new Set<string>();
	for (const template of templates) {
		for (const match of template.matchAll(VARIABLE_PATTERN)) {
			const name = match[1]?.trim();
			if (name && !name.startsWith("$")) names.add(name);
		}
	}
	return names;
}

/** Names filled with a secret (or an agent copy), with their scope. */
function guardedNames(
	templates: readonly string[],
	{ layers, copied, scopes }: Layers,
): Guarded[] {
	return [...namesIn(templates)].flatMap((name): Guarded[] => {
		const winner = resolveVariable(name, layers as ResolverLayer[]).winner;
		if (!winner || winner.withheld || winner.value === null) return [];
		const copy = copied.get(winner.kind)?.has(name) === true;
		const scope = scopes.get(winner.kind);
		return (winner.secret || copy) && scope ? [{ name, scope }] : [];
	});
}

/**
 * A secret filled for an agent goes only where the user allowed it
 * (ADR-0009): its use must be turned on (409 `AGENT_USE_REQUIRED`) and the
 * request's host must be one of its hosts and not Localman's own (409
 * `AGENT_HOST_NOT_ALLOWED`). Returns the test for redirects (the same
 * rule on every hop), or `undefined` when no secret was filled.
 */
export async function assertSecretDestination(
	sub: string,
	templates: readonly string[],
	layers: Layers,
	url: string,
	secrets: readonly string[],
): Promise<((to: URL) => boolean) | undefined> {
	const guarded = guardedNames(templates, layers);
	if (guarded.length === 0) return undefined;
	const allowed = await agentSecretHosts(
		sub,
		guarded.map((entry) => entry.scope),
	);
	const hostsOf = (entry: Guarded) =>
		allowed.get(hostsKey(entry.scope, entry.name));
	const missing = guarded.filter((entry) => !hostsOf(entry));
	if (missing.length > 0) {
		throw new OperationError(
			409,
			"AGENT_USE_REQUIRED",
			'The user has not turned on "Let agents use" for these secrets',
			{ keys: missing.map((entry) => entry.name).join(", ") },
		);
	}
	const reaches = (host: string): boolean =>
		!isLocalmanHost(host) &&
		guarded.every((entry) => agentHostAllowed(host, hostsOf(entry) ?? []));
	const host = new URL(url).hostname;
	if (!reaches(host)) {
		throw new OperationError(
			409,
			"AGENT_HOST_NOT_ALLOWED",
			"These secrets may not be sent to this host",
			{
				keys: guarded.map((entry) => entry.name).join(", "),
				host: maskSecrets(host, secrets),
			},
		);
	}
	return (to) => reaches(to.hostname);
}
