import { z } from "zod";
import { isFakerMethodId } from "./faker-method-catalog.js";
import { RESPONSE_VARIABLES, checkTemplate } from "./json-template.js";
import type { JsonCheck, JsonLimits, JsonValue } from "./json-value.js";

/** Bounds of an object template and of each custom response. */
export const TEMPLATE_LIMITS: JsonLimits = Object.freeze({
	maxDepth: 10,
	maxNodes: 2_000,
});

/** A zod input that accepts JSON passing `check` and yields its copy. */
export function jsonInput(check: (value: unknown) => JsonCheck) {
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
 * Custom response: any JSON with `$mockData`, `$count` and Faker refs.
 * Shared by endpoint responses and conditional rule responses.
 */
export const responseTemplateSchema = jsonInput((value) =>
	checkTemplate(value, {
		variables: RESPONSE_VARIABLES,
		isMethod: isFakerMethodId,
		limits: TEMPLATE_LIMITS,
	}),
).describe(
	'Response body template (JSON). Whole-string values "$mockData" (the records), "$count" (their number) and "$category.method" (Faker) are replaced per request.',
);
