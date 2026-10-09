import { FIELD_TYPES, type JsonObject, parentKeyOf } from "@localman/shared";
import { z } from "zod";
import { generateRecords } from "./data-generator.js";
import { toRecordView } from "./record-model.js";
import type {
	ImportFormat,
	ImportPlan,
	PlannedResource,
} from "./resource-import-plan.js";

/** Records shown per resource in a preview. */
export const PREVIEW_RECORDS = 5;

export const importWarningView = z.object({
	/** Resource or `resource.field` the warning is about, `""` for the input. */
	path: z.string(),
	/** `SchemaImportWarningCode`; the web app translates it with `params`. */
	code: z.string(),
	params: z.record(z.string(), z.union([z.string(), z.number()])),
	/** English text for agents, and the fallback for an unknown code. */
	message: z.string(),
});

export const importedResourceView = z.object({
	/** Name the import gave it: the key to rename it with in `names`. */
	key: z.string(),
	name: z.string(),
	parentName: z.string().nullable(),
	fields: z.array(
		z.object({
			name: z.string(),
			type: z.enum(FIELD_TYPES),
			fakerMethod: z.string().optional(),
			/** Child Resource fields: the related resource they embed. */
			childName: z.string().optional(),
			/** The Faker method was guessed from the field name or format. */
			suggested: z.boolean(),
		}),
	),
	/** Up to 5 records: from the source, or generated for OpenAPI. */
	sample: z.array(z.record(z.string(), z.unknown())),
	sampleKind: z.enum(["source", "generated"]),
	/** Records the resource starts with (0 for OpenAPI). */
	recordCount: z.number().int().min(0),
	/** The source had more records than a resource keeps (1,000). */
	truncated: z.boolean(),
});
type ImportedResourceView = z.input<typeof importedResourceView>;

function fieldsOf(planned: PlannedResource): ImportedResourceView["fields"] {
	return [
		...planned.fields.map((field) => ({
			name: field.name,
			type: field.type,
			...(field.fakerMethod ? { fakerMethod: field.fakerMethod } : {}),
			// Imports only create Faker fields from a guess.
			suggested: field.type === "Faker.js",
		})),
		...planned.childFields.map((field) => ({
			name: field.name,
			type: "Child Resource" as const,
			childName: field.childName,
			suggested: false,
		})),
	];
}

/**
 * Sample records of an OpenAPI import, made by the data generator from
 * each schema (children linked to their parent's samples), so the preview
 * shows what "Generate" will produce. Nothing is stored.
 */
function generatedSamples(
	resources: readonly PlannedResource[],
): Map<string, JsonObject[]> {
	const samples = new Map<string, JsonObject[]>();
	const ids = new Map<string, string[]>();
	for (const planned of resources) {
		const parentKey =
			planned.parentName === null ? null : parentKeyOf(planned.parentName);
		const records = generateRecords(
			{
				schema: planned.fields,
				template: null,
				parentKey,
				resource: { id: planned.key, name: planned.name },
			},
			PREVIEW_RECORDS,
			planned.parent === null ? null : (ids.get(planned.parent) ?? null),
		);
		ids.set(
			planned.key,
			records.map((record) => record.id),
		);
		samples.set(
			planned.key,
			records.map((record) => toRecordView(record, parentKey)),
		);
	}
	return samples;
}

/**
 * What the import will create, resource by resource, for the preview:
 * the first source records, or generated ones for OpenAPI (not seeded).
 */
export function previewOf(
	plan: ImportPlan,
	format: ImportFormat,
): ImportedResourceView[] {
	const generated =
		format === "openapi" ? generatedSamples(plan.resources) : null;
	return plan.resources.map((planned) => ({
		key: planned.key,
		name: planned.name,
		parentName: planned.parentName,
		fields: fieldsOf(planned),
		sample:
			generated?.get(planned.key) ?? planned.records.slice(0, PREVIEW_RECORDS),
		sampleKind: generated ? "generated" : "source",
		recordCount: planned.records.length,
		truncated: planned.truncated,
	}));
}
