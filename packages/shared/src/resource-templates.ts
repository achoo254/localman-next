import { z } from "zod";
import { isFakerMethodId } from "./faker-method-catalog.js";
import { RESPONSE_VARIABLES, checkTemplate } from "./json-template.js";
import {
	type JsonCheck,
	type JsonLimits,
	type JsonObject,
	type JsonValue,
	isJsonObject,
	isPlainObject,
} from "./json-value.js";
import {
	DEFAULT_RESPONSE,
	ENDPOINT_METHODS,
	ENDPOINT_PATHS,
	RESOURCE_ENDPOINTS,
} from "./resource-constants.js";

/** Bounds of an object template and of each custom response. */
export const TEMPLATE_LIMITS: JsonLimits = Object.freeze({
	maxDepth: 10,
	maxNodes: 2_000,
});

// Defined in the zod-free module; re-exported for older imports.
export {
	DEFAULT_RESPONSE,
	ENDPOINT_METHODS,
	ENDPOINT_PATHS,
	RESOURCE_ENDPOINTS,
} from "./resource-constants.js";

const endpointKey = (endpoint: { method: string; path: string }): string =>
	`${endpoint.method} ${endpoint.path}`;
const KNOWN_ENDPOINTS: ReadonlySet<string> = new Set(
	RESOURCE_ENDPOINTS.map(endpointKey),
);

/** A zod input that accepts JSON passing `check` and yields its copy. */
function jsonInput(check: (value: unknown) => JsonCheck) {
	return z.unknown().transform((value, ctx): JsonValue => {
		const result = check(value);
		if (result.ok) return result.value;
		for (const problem of result.problems) {
			ctx.addIssue({
				code: "custom",
				message: problem.path
					? `${problem.path}: ${problem.message}`
					: problem.message,
			});
		}
		return z.NEVER;
	});
}

/**
 * Object template: a JSON object used instead of the schema to generate
 * each record. Only `$category.method` references are allowed.
 */
export const objectTemplateSchema = jsonInput((value) => {
	if (value === null) return { ok: true, value: null };
	if (!isPlainObject(value)) {
		return {
			ok: false,
			problems: [
				{ path: "", message: "Object template must be a JSON object or null" },
			],
		};
	}
	return checkTemplate(value, {
		variables: [],
		isMethod: isFakerMethodId,
		limits: TEMPLATE_LIMITS,
	});
})
	.transform((value): JsonObject | null => (isJsonObject(value) ? value : null))
	.describe(
		'JSON object rendered once per generated record, or null to use the schema. Whole-string values "$category.method" call a whitelisted Faker method (see list_faker_methods).',
	);

/** Custom response: any JSON with `$mockData`, `$count` and Faker refs. */
export const responseTemplateSchema = jsonInput((value) =>
	checkTemplate(value, {
		variables: RESPONSE_VARIABLES,
		isMethod: isFakerMethodId,
		limits: TEMPLATE_LIMITS,
	}),
).describe(
	'Response body template (JSON). Whole-string values "$mockData" (the records), "$count" (their number) and "$category.method" (Faker) are replaced per request.',
);

export const endpointInputSchema = z.object({
	method: z.enum(ENDPOINT_METHODS),
	path: z.enum(ENDPOINT_PATHS),
	enabled: z.boolean().default(true),
	response: responseTemplateSchema.optional(),
});
export type EndpointInput = z.output<typeof endpointInputSchema>;

export const endpointsInputSchema = z
	.array(endpointInputSchema)
	.max(RESOURCE_ENDPOINTS.length)
	.superRefine((endpoints, ctx) => {
		const seen = new Set<string>();
		endpoints.forEach((endpoint, index) => {
			const key = endpointKey(endpoint);
			if (!KNOWN_ENDPOINTS.has(key) || seen.has(key)) {
				ctx.addIssue({
					code: "custom",
					path: [index],
					message: KNOWN_ENDPOINTS.has(key)
						? `Endpoint ${key} appears more than once`
						: `Endpoint ${key} does not exist`,
				});
			}
			seen.add(key);
		});
	});

export interface ResourceEndpoint {
	readonly method: (typeof ENDPOINT_METHODS)[number];
	readonly path: (typeof ENDPOINT_PATHS)[number];
	readonly enabled: boolean;
	readonly response: JsonValue;
}

/**
 * The five endpoints in canonical order: the given ones as sent, the
 * missing ones enabled with the default `$mockData` response.
 */
export function completeEndpoints(
	given: readonly EndpointInput[] = [],
): ResourceEndpoint[] {
	const byKey = new Map(
		given.map((endpoint) => [endpointKey(endpoint), endpoint]),
	);
	return RESOURCE_ENDPOINTS.map(({ method, path }) => {
		const endpoint = byKey.get(endpointKey({ method, path }));
		return {
			method,
			path,
			enabled: endpoint?.enabled ?? true,
			// `null` is a valid response body; only a missing one gets the default.
			response:
				endpoint?.response === undefined ? DEFAULT_RESPONSE : endpoint.response,
		};
	});
}
