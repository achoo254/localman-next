import {
	MAX_METHOD_REFERENCES,
	RESPONSE_VARIABLES,
	TEMPLATE_LIMITS,
	isFakerMethodId,
	parseTemplateReference,
} from "@localman/shared";
import { describe, expect, it } from "vitest";
import {
	DOCS_TEMPLATE_MAX_DEPTH,
	DOCS_TEMPLATE_MAX_FAKER_CALLS,
	DOCS_TEMPLATE_MAX_VALUES,
	FAKER_EXAMPLES,
	LIST_TEMPLATE,
	WRITE_TEMPLATE,
} from "./custom-response-examples";

/** Every string leaf of a JSON value. */
function strings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.flatMap(strings);
	if (value !== null && typeof value === "object") {
		return Object.values(value).flatMap(strings);
	}
	return [];
}

/**
 * Query parameters, page and body caps come from `@localman/shared`, which
 * the runtime parses with, so only the hand-written examples need checks.
 */
describe("docs match the mock runtime", () => {
	it("states the template limits enforced when a template is saved", () => {
		expect(DOCS_TEMPLATE_MAX_DEPTH).toBe(TEMPLATE_LIMITS.maxDepth);
		expect(DOCS_TEMPLATE_MAX_VALUES).toBe(TEMPLATE_LIMITS.maxNodes);
		expect(DOCS_TEMPLATE_MAX_FAKER_CALLS).toBe(MAX_METHOD_REFERENCES);
	});

	it("only shows references a response template may hold", () => {
		const references = [
			...strings(LIST_TEMPLATE),
			...strings(WRITE_TEMPLATE),
			...FAKER_EXAMPLES,
		]
			.map(parseTemplateReference)
			.filter((reference) => reference !== null);
		expect(references.length).toBeGreaterThan(FAKER_EXAMPLES.length);
		for (const reference of references) {
			if (reference.kind === "variable") {
				expect(RESPONSE_VARIABLES).toContain(reference.name);
			} else {
				expect(isFakerMethodId(reference.id), reference.id).toBe(true);
			}
		}
	});
});
