/** Assertions shared by the schema inference tests. */
import { expect } from "vitest";
import { RESOURCE_NAME_PATTERN } from "./resource-constants.js";
import { resourceFieldsSchema } from "./resource-schema.js";
import type { SchemaInferenceResult } from "./schema-inference.js";

/** The resources of a successful result, each with a valid name and schema. */
export function resourcesOf(result: SchemaInferenceResult) {
	if (!result.ok) {
		throw new Error(`${result.error.code}: ${result.error.message}`);
	}
	for (const resource of result.resources) {
		expect(resource.name).toMatch(RESOURCE_NAME_PATTERN);
		expect(resourceFieldsSchema.safeParse(resource.fields).success).toBe(true);
	}
	return result.resources;
}
