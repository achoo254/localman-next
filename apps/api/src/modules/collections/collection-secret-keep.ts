import {
	type ApiRequestDraft,
	type CollectionNode,
	type EffectiveAuth,
	type RequestAuth,
	type VariableEntry,
	isLiteralValue,
} from "@localman/shared/api-client";

/*
 * An agent reads secret variable values and typed-in credentials as `""`
 * (`collection-secret-mask.ts`). When it writes that form back, the stored
 * value stays, so editing what it read never erases a secret; a real value
 * replaces it. Applied to an agent's writes only: in the web app, `""`
 * still clears.
 */

/**
 * The variables an agent sent, a stored secret sent back as
 * `secret: true, value: ""` taking its stored value back (by name).
 */
export function keepWithheldSecrets(
	sent: readonly VariableEntry[],
	stored: readonly VariableEntry[],
): VariableEntry[] {
	const secrets = new Map<string, string>();
	for (const variable of stored) {
		if (variable.secret === true && !secrets.has(variable.key)) {
			secrets.set(variable.key, variable.value);
		}
	}
	return sent.map((variable) => {
		const kept = secrets.get(variable.key);
		return variable.secret === true && variable.value === "" && kept
			? { ...variable, value: kept }
			: variable;
	});
}

/** A stored credential an agent read blanked (a literal, not a reference). */
const withheld = (stored: string): boolean => isLiteralValue(stored);

/**
 * The auth an agent sent, a blank credential of the stored auth's type
 * taking the stored literal credential back (a `{{variable}}` was shown
 * as is, so a blank sent for it clears it).
 */
export function keepWithheldAuth(
	sent: EffectiveAuth,
	stored: RequestAuth,
): EffectiveAuth;
export function keepWithheldAuth(
	sent: RequestAuth,
	stored: RequestAuth,
): RequestAuth;
export function keepWithheldAuth(
	sent: RequestAuth,
	stored: RequestAuth,
): RequestAuth {
	switch (sent.type) {
		case "bearer":
			return stored.type === "bearer" &&
				sent.token === "" &&
				withheld(stored.token)
				? { ...sent, token: stored.token }
				: sent;
		case "basic":
			return stored.type === "basic" &&
				sent.password === "" &&
				withheld(stored.password)
				? { ...sent, password: stored.password }
				: sent;
		case "apikey":
			return stored.type === "apikey" &&
				sent.value === "" &&
				withheld(stored.value)
				? { ...sent, value: stored.value }
				: sent;
		default:
			return sent;
	}
}

const keepInDraft = (
	sent: ApiRequestDraft,
	stored: ApiRequestDraft,
): ApiRequestDraft => ({
	...sent,
	auth: keepWithheldAuth(sent.auth, stored.auth),
});

interface NodeAuthFields {
	readonly auth?: RequestAuth;
	readonly draft?: ApiRequestDraft;
	readonly request?: ApiRequestDraft;
}

/**
 * A node update from an agent with blank credentials kept from `node`: a
 * folder's `auth`, a request's `draft.auth`, an example's `request.auth`.
 */
export function keepWithheldNodeAuth<U extends NodeAuthFields>(
	update: U,
	node: CollectionNode,
): U {
	if (node.kind === "folder" && update.auth) {
		return { ...update, auth: keepWithheldAuth(update.auth, node.auth) };
	}
	if (node.kind === "request" && update.draft) {
		return { ...update, draft: keepInDraft(update.draft, node.draft) };
	}
	if (node.kind === "example" && update.request) {
		return { ...update, request: keepInDraft(update.request, node.request) };
	}
	return update;
}
