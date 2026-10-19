import type { OperationContext } from "@localman/operations";
import {
	type CollectionDetail,
	type CollectionNode,
	type EffectiveAuth,
	type RequestAuth,
	isLiteralValue,
	redactAuth,
} from "@localman/shared/api-client";
import { isAgentCall } from "../../http/require-auth.js";

/*
 * What an agent (a token, not a browser session) reads of a collection:
 * never a secret variable's value, never a credential typed into an
 * `auth` (bearer token, basic password, API key value). Both read as `""`,
 * the form an exported file uses; the variable keeps its `secret` flag,
 * the auth its type, username and key name. A `{{variable}}` reference is
 * no credential and stays. Writing that form back keeps the stored value
 * (`collection-secret-keep.ts`). The web app gets everything as stored.
 */

/** Tells whether a collection variable name is a secret. */
export type SecretKeyTest = (key: string) => boolean;

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Root auth never holds `inherit`, and blanking keeps the type. */
function withholdEffectiveAuth(auth: EffectiveAuth): EffectiveAuth {
	const blanked = redactAuth(auth);
	return blanked.type === "inherit" ? auth : blanked;
}

/** A folder, request or example with its typed-in credentials blanked. */
export function withholdNodeCredentials(node: CollectionNode): CollectionNode {
	switch (node.kind) {
		case "folder":
			return { ...node, auth: redactAuth(node.auth) };
		case "request":
			return {
				...node,
				draft: { ...node.draft, auth: redactAuth(node.draft.auth) },
			};
		case "example": {
			const auth = redactAuth(node.request.auth);
			return { ...node, request: { ...node.request, auth } };
		}
	}
}

/** The collection as an agent reads it (see the top of this file). */
export function withholdCollectionSecrets(
	detail: CollectionDetail,
): CollectionDetail {
	return {
		...detail,
		auth: withholdEffectiveAuth(detail.auth),
		variables: detail.variables.map((variable) =>
			variable.secret ? { ...variable, value: "" } : variable,
		),
		nodes: detail.nodes.map(withholdNodeCredentials),
	};
}

/** The collection as this caller may read it. */
export function collectionForCaller(
	ctx: OperationContext,
	detail: CollectionDetail,
): CollectionDetail {
	return isAgentCall(ctx) ? withholdCollectionSecrets(detail) : detail;
}

/** A node as this caller may read it. */
export function nodeForCaller(
	ctx: OperationContext,
	node: CollectionNode,
): CollectionNode {
	return isAgentCall(ctx) ? withholdNodeCredentials(node) : node;
}

/** The credential field of each auth type, as `redactAuth` blanks it. */
const CREDENTIAL_FIELD = new Map<string, string>([
	["bearer", "token"],
	["basic", "password"],
	["apikey", "value"],
] satisfies [Exclude<RequestAuth["type"], "inherit" | "none">, string][]);

/**
 * Any JSON (a diff side, a merge conflict side) with every auth-shaped
 * object's literal credential blanked, however deep it sits.
 */
export function withholdCredentials(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(withholdCredentials);
	if (!isFields(value)) return value;
	const field =
		typeof value.type === "string"
			? CREDENTIAL_FIELD.get(value.type)
			: undefined;
	const credential = field === undefined ? undefined : value[field];
	if (field && typeof credential === "string" && isLiteralValue(credential)) {
		return { ...value, [field]: "" };
	}
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			key,
			withholdCredentials(item),
		]),
	);
}

/** The variables list of a root-like value; `undefined` when it has none. */
export function variablesOf(root: unknown): unknown {
	return isFields(root) ? root.variables : undefined;
}

/**
 * Names flagged secret in any of these variable lists (anything else is
 * skipped), so a flag dropped on one side still withholds the other's.
 */
export function flaggedSecretKeys(...lists: readonly unknown[]): Set<string> {
	const keys = new Set<string>();
	for (const list of lists) {
		if (!Array.isArray(list)) continue;
		for (const entry of list) {
			if (isFields(entry) && entry.secret === true) {
				if (typeof entry.key === "string") keys.add(entry.key);
			}
		}
	}
	return keys;
}

/**
 * A variables list with the value of every secret blanked: flagged on the
 * entry itself or named by `isSecret`. Anything but a list is returned as is.
 */
export function withholdVariables(
	list: unknown,
	isSecret: SecretKeyTest,
): unknown {
	if (!Array.isArray(list)) return list;
	return list.map((entry: unknown) => {
		if (!isFields(entry) || !("value" in entry)) return entry;
		const named = typeof entry.key === "string" && isSecret(entry.key);
		return entry.secret === true || named ? { ...entry, value: "" } : entry;
	});
}

/**
 * A collection root, folder, request or example (or `null`) of unchecked
 * shape, as an agent reads it: secret variable values and credentials
 * blanked.
 */
export function withholdEntitySecrets(
	entity: unknown,
	isSecret: SecretKeyTest,
): unknown {
	const withheld =
		isFields(entity) && Array.isArray(entity.variables)
			? { ...entity, variables: withholdVariables(entity.variables, isSecret) }
			: entity;
	return withholdCredentials(withheld);
}

/** Descriptions of the operations returning a collection or nodes. */
export const AGENT_READ_NOTE =
	'Called with an agent token (MCP), secret variable values and credentials typed into an auth (bearer token, basic password, API key value; a `{{variable}}` stays) read as `""`, as in an export.';
/** Descriptions of the operations writing what an agent read. */
export const AGENT_WRITE_NOTE =
	'Called with an agent token, a secret variable value or auth credential sent back as `""` (as an agent reads it) keeps its stored value; send a value to replace it.';
