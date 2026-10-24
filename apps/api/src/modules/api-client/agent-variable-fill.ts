import { OperationError } from "@localman/operations";
import {
	type ProxyRequest,
	createInterpolator,
	interpolationScope,
	proxyRequestSchema,
	resolveVariable,
} from "@localman/shared/api-client";
import { secretVaultEnabled } from "../secret-vault/secret-vault-gate.js";
import { assertSecretDestination } from "./agent-secret-destination.js";
import { buildLayers } from "./agent-variable-layers.js";

export interface FilledRequest {
	/** The request to send, `{{variables}}` filled and checked again. */
	readonly request: ProxyRequest;
	/** Values of secret variables filled in: never shown to the caller. */
	readonly secrets: readonly string[];
	/** Where a redirect may lead once secrets are filled; unset otherwise. */
	readonly redirectAllowed?: (to: URL) => boolean;
}

/**
 * Fills `{{variables}}` of a request on the server, for a caller that
 * cannot read secrets (an agent). Values come as the browser would pick
 * them; a vault value only when the user lets agents use it. A name the
 * caller may not use stops the send (409 `SECRET_WITHHELD`, `details.keys`,
 * `details.vault` for those locked in the vault); any other unknown name
 * stays as typed. A filled secret must be let to agents, for the request's
 * host (`assertSecretDestination`). Without `variables` the request goes
 * as it is.
 */
export async function fillVariables(
	sub: string,
	input: ProxyRequest,
): Promise<FilledRequest> {
	const { variables: refs, ...request } = input;
	if (!refs) return { request, secrets: [] };
	if (!secretVaultEnabled()) {
		throw new OperationError(
			404,
			"SECRET_VAULT_DISABLED",
			"Filling variables on the server is not available on this server",
		);
	}
	const built = await buildLayers(sub, refs);
	const { layers, locked, copies } = built;
	const interpolator = createInterpolator({
		scopes: [interpolationScope(layers)],
	});
	const filled = {
		...request,
		url: interpolator.apply(request.url),
		// Header names cannot hold braces (schema), so only values are filled.
		headers: request.headers.map((header) => ({
			name: header.name,
			value: interpolator.apply(header.value),
		})),
		body:
			request.bodyType === "text" && request.body !== null
				? interpolator.apply(request.body)
				: request.body,
	};
	const unresolved = new Set(interpolator.unresolved());
	const blocked = [...unresolved].filter(
		(name) => resolveVariable(name, layers).winner?.withheld === true,
	);
	if (blocked.length > 0) {
		const inVault = blocked.filter((name) => {
			const winner = resolveVariable(name, layers).winner;
			return winner ? locked.get(winner.kind)?.has(name) === true : false;
		});
		throw new OperationError(
			409,
			"SECRET_WITHHELD",
			inVault.length > 0
				? 'Some variables are in the user\'s browser vault; the user can turn on "Let agents use" for them'
				: "Some secret variables are hidden from you",
			{ keys: blocked.join(", "), vault: inVault.join(", ") },
		);
	}
	const values = new Map(
		interpolationScope(layers).variables.map((entry) => [
			entry.key,
			entry.value,
		]),
	);
	const secrets = [
		...interpolator.secretsUsed().flatMap((name) => values.get(name) ?? []),
		...copies,
	];
	const checked = proxyRequestSchema.safeParse(filled);
	if (!checked.success) {
		// Only where, never why: a reason (too long, a line break) would say
		// something about a secret's value.
		const field = checked.error.issues[0]?.path[0] ?? "request";
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			`The ${String(field)} is not valid once variables are filled`,
		);
	}
	const templates = [
		request.url,
		...request.headers.map((header) => header.value),
		...(request.bodyType === "text" && request.body ? [request.body] : []),
	];
	const redirectAllowed = await assertSecretDestination(
		sub,
		templates,
		built,
		checked.data,
		secrets,
	);
	return redirectAllowed
		? { request: checked.data, secrets, redirectAllowed }
		: { request: checked.data, secrets };
}
