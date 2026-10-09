import { OperationError } from "@localman/operations";
import {
	DEFAULT_RESPONSE,
	JsonTemplateError,
	type JsonValue,
	MAX_RESOURCE_BYTES,
	type ResourceEndpoint,
	TEMPLATE_LIMITS,
	primitiveBytes,
	renderJsonTemplate,
	utf8Length,
} from "@localman/shared";
import { runFakerMethod } from "@localman/shared/faker-methods";
import type { StoredResource } from "../resources/resource-model.js";

/**
 * Most bytes of JSON one mock response may carry: what a resource may
 * hold. `Parent Resource` fields repeat the parent record in every child,
 * so a page can be larger than its records; it is measured here and
 * refused past the cap (the client can ask for fewer with `?limit`).
 */
export const MAX_RESPONSE_BYTES = MAX_RESOURCE_BYTES;

/** What a mock route does, named after the endpoint that serves it. */
export type EndpointKind = "list" | "one" | "create" | "update" | "delete";

const ENDPOINT_OF: Readonly<
	Record<EndpointKind, { method: string; path: string }>
> = {
	list: { method: "GET", path: "/:res" },
	one: { method: "GET", path: "/:res/:id" },
	create: { method: "POST", path: "/:res" },
	update: { method: "PUT", path: "/:res/:id" },
	delete: { method: "DELETE", path: "/:res/:id" },
};

/**
 * The route kind of an HTTP method; `null` for methods the source does
 * not serve (they answer 404 and run nothing). HEAD is a GET without a
 * body and PATCH shares the PUT endpoint.
 */
export function endpointKind(
	method: string,
	hasId: boolean,
): EndpointKind | null {
	switch (method) {
		case "GET":
		case "HEAD":
			return hasId ? "one" : "list";
		case "POST":
			return hasId ? null : "create";
		case "PUT":
		case "PATCH":
			return hasId ? "update" : null;
		case "DELETE":
			return hasId ? "delete" : null;
		default:
			return null;
	}
}

/** The enabled endpoint serving `kind`, or `null` (a disabled one is 404). */
export function enabledEndpoint(
	resource: StoredResource,
	kind: EndpointKind,
): ResourceEndpoint | null {
	const { method, path } = ENDPOINT_OF[kind];
	const endpoint = resource.endpoints.find(
		(candidate) => candidate.method === method && candidate.path === path,
	);
	return endpoint?.enabled === true ? endpoint : null;
}

/** Whether the response template uses `$count` (computing it costs a query). */
export function usesCount(response: JsonValue): boolean {
	return JSON.stringify(response).includes('"$count"');
}

export function responseTooLarge(bytes: number): OperationError {
	return new OperationError(
		422,
		"RESPONSE_TOO_LARGE",
		`The response would exceed ${MAX_RESPONSE_BYTES} bytes; request fewer records with ?limit`,
		{ maxBytes: MAX_RESPONSE_BYTES, actualBytes: bytes },
	);
}

/**
 * Bytes of `value` as compact JSON. Objects shared by several records
 * (an embedded parent) are walked once and counted at every place they
 * appear, so the cost follows the distinct data, not the output size.
 */
function measure(value: JsonValue, seen: WeakMap<object, number>): number {
	if (value === null || typeof value !== "object") return primitiveBytes(value);
	const known = seen.get(value);
	if (known !== undefined) return known;
	let bytes = 2;
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			bytes += measure(item, seen) + (index > 0 ? 1 : 0);
		});
	} else {
		Object.entries(value).forEach(([key, item], index) => {
			bytes += utf8Length(key) + 3 + measure(item, seen) + (index > 0 ? 1 : 0);
		});
	}
	seen.set(value, bytes);
	return bytes;
}

export interface RenderedResponse {
	readonly body: JsonValue;
	/** Measured bytes of `$mockData`, charged to the secret's byte budget. */
	readonly bytes: number;
}

/**
 * The body of a mock response: `$mockData` (the default) as is, else the
 * endpoint's template with `$mockData`, `$count` and `$category.method`
 * replaced. Rendering never evaluates anything (see `json-template`) and
 * stops at `MAX_RESPONSE_BYTES` with 422 `RESPONSE_TOO_LARGE`.
 */
export function renderResponse(
	response: JsonValue,
	mockData: JsonValue,
	count: number | null,
): RenderedResponse {
	const bytes = measure(mockData, new WeakMap());
	if (bytes > MAX_RESPONSE_BYTES) throw responseTooLarge(bytes);
	if (response === DEFAULT_RESPONSE) return { body: mockData, bytes };
	const variables = new Map<string, JsonValue>([["mockData", mockData]]);
	if (count !== null) variables.set("count", count);
	try {
		const body = renderJsonTemplate(response, {
			variables,
			resolveMethod: (id) => runFakerMethod(id),
			limits: TEMPLATE_LIMITS,
			maxRenderedNodes: Number.POSITIVE_INFINITY,
			maxBytes: MAX_RESPONSE_BYTES,
		});
		return { body, bytes };
	} catch (error) {
		if (!(error instanceof JsonTemplateError)) throw error;
		if (error.code !== "TEMPLATE_TOO_LARGE") {
			throw new OperationError(422, error.code, error.message);
		}
		throw responseTooLarge(error.bytes ?? MAX_RESPONSE_BYTES + 1);
	}
}
