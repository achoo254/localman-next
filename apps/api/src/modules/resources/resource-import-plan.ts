import { OperationError } from "@localman/operations";
import {
	type InferredResource,
	type JsonObject,
	MAX_SCHEMA_FIELDS,
	type ResourceFieldDefinition,
	type SchemaImportWarning,
	inferSchema,
	parentKeyOf,
} from "@localman/shared";
import { freeParentKey, renameKey } from "./resource-import-parent-key.js";
import {
	type Selection,
	selectOpenApi,
	warningsFor,
} from "./resource-import-selection.js";
import { schemaImportError } from "./schema-import-error.js";

export const IMPORT_FORMATS = ["json", "openapi", "csv"] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export interface ImportRequest {
	readonly format: ImportFormat;
	/** Text, or an already parsed JSON value for `json` and `openapi`. */
	readonly input: unknown;
	/** Final name of the main resource (the first one). */
	readonly name?: string;
	/** OpenAPI: the `components.schemas` entry to import. */
	readonly schema?: string;
	/** OpenAPI: also import the schemas nested under the chosen one. */
	readonly includeRelated: boolean;
	/** Final names of the other resources, by the name the import gave them. */
	readonly names: Readonly<Record<string, string>>;
}

/** A Child Resource field to add once the child resource exists. */
export interface PlannedChildField {
	readonly name: string;
	/** `key` of the child resource. */
	readonly child: string;
	/** Final name of the child resource. */
	readonly childName: string;
}

export interface PlannedResource {
	/** Name the import inferred, unique in the import: the key of `names`. */
	readonly key: string;
	/** Final name; unique among its siblings only. */
	readonly name: string;
	/** `key` of the parent in this import, `null` for a top-level one. */
	readonly parent: string | null;
	/** Final name of the parent. */
	readonly parentName: string | null;
	readonly fields: readonly ResourceFieldDefinition[];
	readonly childFields: readonly PlannedChildField[];
	/** Seed records; the parent link uses the final parent's key. */
	readonly records: readonly JsonObject[];
	/** The source held more records than a resource keeps. */
	readonly truncated: boolean;
}

export interface ImportPlan {
	/** Parents before children; the first one is the main resource. */
	readonly resources: readonly PlannedResource[];
	readonly warnings: readonly SchemaImportWarning[];
	/** OpenAPI: schemas that can become the main resource, document order. */
	readonly schemaNames: readonly string[];
	readonly selectedSchema: string | null;
	/** OpenAPI: resources nested under the chosen schema (`includeRelated`). */
	readonly relatedCount: number;
}

function finalNamesOf(
	resources: readonly InferredResource[],
	request: ImportRequest,
): Map<string, string> {
	const keys = new Set(resources.map((resource) => resource.name));
	const unknown = Object.keys(request.names).filter((key) => !keys.has(key));
	if (unknown.length > 0) {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			`"names" has no resource "${unknown[0]}" in this import`,
			unknown.map((key) => ({
				path: `names.${key}`,
				message: "is not a resource of this import",
			})),
		);
	}
	const renamed = (key: string): string | undefined =>
		Object.hasOwn(request.names, key) ? request.names[key] : undefined;
	return new Map(
		resources.map((r, index) => [
			r.name,
			(index === 0 ? request.name : undefined) ?? renamed(r.name) ?? r.name,
		]),
	);
}

/**
 * Reads the source (`inferSchema`, which bounds size and work), keeps the
 * chosen OpenAPI schema, applies the final names (also to the `{parent}Id`
 * of seed records, renaming a field that already had that name, see
 * `freeParentKey`) and plans a Child Resource field wherever the source
 * nested a list. Throws `SCHEMA_IMPORT_FAILED` or `VALIDATION_ERROR`.
 */
export function planImport(request: ImportRequest): ImportPlan {
	const inferred = inferSchema(request.input, { format: request.format });
	if (!inferred.ok) throw schemaImportError(inferred.error);
	const selection: Selection =
		request.format === "openapi"
			? selectOpenApi(inferred.resources, request)
			: {
					resources: inferred.resources,
					schemaNames: [],
					selectedSchema: null,
					relatedCount: 0,
				};
	const { resources } = selection;
	const warnings = warningsFor(inferred.warnings, resources);
	const finalName = finalNamesOf(resources, request);
	const nameOf = (key: string): string => finalName.get(key) ?? key;
	const renames: SchemaImportWarning[] = [];
	const planned = resources.map((r): PlannedResource => {
		const parentName = r.parentName === null ? null : nameOf(r.parentName);
		const fromKey = r.parentName === null ? null : parentKeyOf(r.parentName);
		const toKey = parentName === null ? null : parentKeyOf(parentName);
		const freed =
			toKey === null
				? { fields: r.fields, renamedTo: null, warnings: [] }
				: freeParentKey(r.name, r.fields, toKey);
		renames.push(...freed.warnings);
		const moveRecordKeys = (record: JsonObject): JsonObject => {
			if (fromKey === null || toKey === null) return record;
			const { renamedTo } = freed;
			const moved =
				renamedTo === null ? record : renameKey(record, toKey, renamedTo);
			return renameKey(moved, fromKey, toKey);
		};
		const { fields } = freed;
		const names = new Set(fields.map((field) => field.name));
		if (toKey !== null) names.add(toKey);
		const childFields = resources.flatMap((child): PlannedChildField[] => {
			const field = child.parentField;
			if (child.parentName !== r.name || !field || names.has(field)) return [];
			names.add(field);
			return [
				{ name: field, child: child.name, childName: nameOf(child.name) },
			];
		});
		return {
			key: r.name,
			name: nameOf(r.name),
			parent: r.parentName,
			parentName,
			fields,
			childFields: childFields.slice(0, MAX_SCHEMA_FIELDS - fields.length),
			records: (r.records ?? []).map(moveRecordKeys),
			truncated: warnings.some(
				(w) => w.code === "TOO_MANY_RECORDS" && w.path === r.name,
			),
		};
	});
	return {
		...selection,
		resources: planned,
		warnings: [...warnings, ...renames],
	};
}
