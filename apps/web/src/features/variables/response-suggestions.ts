/**
 * `{{response "<request>" "<JSONPath>"}}` offered after `{{`: for every
 * other request of the tab's collection, its whole response (`$`) and each
 * top-level key of the last response kept in this browser tab, so a chain
 * is one pick away. Pure: the caller passes the requests and the kept
 * responses.
 */
import {
	type KeptResponse,
	type TabSource,
	parseResponseReference,
	valueOfReference,
} from "@localman/shared/api-client";

/** A saved request of the collection, by name. */
export interface ReferenceRequest {
	readonly name: string;
	readonly source: TabSource;
}

export interface ReferenceSuggestion {
	/** The text between the braces, e.g. `response "Log in" "$.token"`. */
	readonly expression: string;
	/** The value it reads now from the kept response; `null` if none kept. */
	readonly value: string | null;
}

/** Top-level keys offered per request, after its whole response. */
export const REFERENCE_KEYS_MAX = 8;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The request name quoted as a reference reads it; `null` if it cannot be. */
function quotedName(name: string): string | null {
	if (!name.includes('"')) return `"${name}"`;
	return name.includes("'") ? null : `'${name}'`;
}

/** The expression for `name` at `path`, or `null` when it would not parse. */
export function referenceExpression(name: string, path: string): string | null {
	const quoted = quotedName(name.trim());
	if (!quoted) return null;
	const expression = `response ${quoted} "${path}"`;
	return parseResponseReference(expression) ? expression : null;
}

/** JSONPaths of the top-level keys of a JSON object body. */
function keyPaths(kept: KeptResponse | undefined): string[] {
	if (!kept || kept.response.bodyEncoding !== "utf8") return [];
	let body: unknown;
	try {
		body = JSON.parse(kept.response.body);
	} catch {
		return [];
	}
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		return [];
	}
	return Object.keys(body)
		.filter((key) => IDENTIFIER.test(key))
		.slice(0, REFERENCE_KEYS_MAX)
		.map((key) => `$.${key}`);
}

function valueAt(expression: string, kept: KeptResponse | undefined) {
	const reference = parseResponseReference(expression);
	if (!reference || !kept) return null;
	try {
		return valueOfReference(reference, kept.response);
	} catch {
		return null;
	}
}

/**
 * Suggestions for the requests of the collection other than `current`
 * (a request may not refer to itself), in the collection's order.
 */
export function referenceSuggestions(
	requests: readonly ReferenceRequest[],
	current: TabSource | null,
	keptOf: (source: TabSource) => KeptResponse | undefined,
): ReferenceSuggestion[] {
	return requests
		.filter((request) => request.source.nodeId !== current?.nodeId)
		.flatMap((request) => {
			const kept = keptOf(request.source);
			return ["$", ...keyPaths(kept)].flatMap((path) => {
				const expression = referenceExpression(request.name, path);
				return expression
					? [{ expression, value: valueAt(expression, kept) }]
					: [];
			});
		});
}
