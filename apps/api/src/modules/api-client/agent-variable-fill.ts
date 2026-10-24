import { OperationError } from "@localman/operations";
import {
	type ProxyRequest,
	createInterpolator,
	interpolationScope,
	proxyRequestSchema,
	resolveVariable,
} from "@localman/shared/api-client";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { buildLayers } from "./agent-variable-layers.js";
import { maskSecrets } from "./secret-mask.js";

export interface FilledRequest {
	/** The request to send, `{{variables}}` filled and checked again. */
	readonly request: ProxyRequest;
	/** Values of secret variables filled in: never shown to the caller. */
	readonly secrets: readonly string[];
}

/**
 * Fills `{{variables}}` of a request on the server, for a caller that
 * cannot read secrets (an agent). Values come as the browser would pick
 * them; a vault value only when the user lets agents use it. A name the
 * caller may not use stops the send (409 `SECRET_WITHHELD`, `details.keys`,
 * `details.vault` for those locked in the vault); any other unknown name
 * stays as typed. Without `variables` the request goes as it is.
 */
export async function fillVariables(
	sub: string,
	input: ProxyRequest,
): Promise<FilledRequest> {
	const { variables: refs, ...request } = input;
	if (!refs) return { request, secrets: [] };
	if (!runtimeSettings().secretVault) {
		throw new OperationError(
			404,
			"SECRET_VAULT_DISABLED",
			"Filling variables on the server is not available on this server",
		);
	}
	const { layers, locked } = await buildLayers(sub, refs);
	const interpolator = createInterpolator({
		scopes: [interpolationScope(layers)],
	});
	const filled = {
		...request,
		url: interpolator.apply(request.url),
		headers: request.headers.map((header) => ({
			name: interpolator.apply(header.name),
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
	const secrets = interpolator
		.secretsUsed()
		.flatMap((name) => values.get(name) ?? []);
	const checked = proxyRequestSchema.safeParse(filled);
	if (!checked.success) {
		const issue = checked.error.issues[0];
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			maskSecrets(
				`${issue?.path.join(".") ?? "request"}: ${issue?.message ?? "invalid"} after filling variables`,
				secrets,
			),
		);
	}
	return { request: checked.data, secrets };
}
