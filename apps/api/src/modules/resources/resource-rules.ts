import { OperationError } from "@localman/operations";
import {
	type JsonObject,
	MAX_RECORD_BYTES,
	OBJECT_ID_FIELD,
	type ResourceField,
	estimateTemplateBytes,
	fakerMethodMaxBytes,
} from "@localman/shared";
import type { StoredResource } from "./resource-model.js";
import type { AttachProblem, AttachProblemCode } from "./resource-tree.js";

const TREE_ERRORS: Readonly<
	Record<AttachProblemCode, { status: number; code: string }>
> = {
	PARENT_NOT_FOUND: { status: 404, code: "NOT_FOUND" },
	SELF_PARENT: { status: 409, code: "TREE_CYCLE" },
	CYCLE: { status: 409, code: "TREE_CYCLE" },
	DUPLICATE_NAME: { status: 409, code: "RESOURCE_NAME_TAKEN" },
	TOO_DEEP: { status: 409, code: "TREE_TOO_DEEP" },
};

export function treeError(problem: AttachProblem): OperationError {
	const { status, code } = TREE_ERRORS[problem.code];
	return new OperationError(status, code, problem.message);
}

/** Where a schema sits in the tree. */
export interface SchemaPlace {
	/** Parent ID field name, `null` for a root. */
	readonly parentKey: string | null;
	/** Ids of the direct children. */
	readonly childIds: ReadonlySet<string>;
}

export function childIdsOf(
	resources: readonly StoredResource[],
	resource: StoredResource,
): Set<string> {
	return new Set(
		resources
			.filter((candidate) => candidate.parentId?.equals(resource._id))
			.map((child) => child._id.toHexString()),
	);
}

/** What a resource generates records from. */
export interface ResourceDefinition {
	readonly schema: readonly ResourceField[];
	readonly template: JsonObject | null;
}

/**
 * Why the definition cannot be used at `place`, or `null`: a field or a
 * top-level template key reusing `id` or the Parent ID name (its value
 * would be hidden by the generated one), a Parent Resource field on a
 * root, or a Child Resource field that does not point at a direct child.
 */
export function definitionProblem(
	{ schema, template }: ResourceDefinition,
	place: SchemaPlace,
): string | null {
	for (const key of Object.keys(template ?? {})) {
		if (key === OBJECT_ID_FIELD || key === place.parentKey) {
			return `Template key "${key}" is generated for every record; rename it`;
		}
	}
	for (const field of schema) {
		if (field.name === place.parentKey) {
			return `"${field.name}" is the generated Parent ID of this resource`;
		}
		if (field.type === "Parent Resource" && place.parentKey === null) {
			return `Field "${field.name}" needs a parent resource`;
		}
		if (
			field.type === "Child Resource" &&
			!place.childIds.has(field.childId ?? "")
		) {
			return `Field "${field.name}" must point at a direct child resource`;
		}
	}
	return null;
}

/**
 * Throws when the definition does not fit: 400 when the caller sent it,
 * 409 when a stored one stops fitting because of a rename or a move.
 */
export function assertDefinitionFits(
	definition: ResourceDefinition,
	place: SchemaPlace,
	sentByCaller: boolean,
): void {
	const problem = definitionProblem(definition, place);
	if (!problem) return;
	throw sentByCaller
		? new OperationError(400, "VALIDATION_ERROR", problem)
		: new OperationError(409, "FIELD_CONFLICT", problem);
}

/** Drops relation fields a move made meaningless (as the prototype does). */
export function withoutStaleRelations(
	schema: readonly ResourceField[],
	place: SchemaPlace,
): ResourceField[] {
	return schema.filter(
		(field) =>
			(field.type !== "Parent Resource" || place.parentKey !== null) &&
			(field.type !== "Child Resource" ||
				place.childIds.has(field.childId ?? "")),
	);
}

/** Room for `id` and the parent link a stored record adds to its data. */
const RECORD_FRAME_BYTES = 64;

/**
 * Refuses (400 `TEMPLATE_TOO_LARGE`) an object template whose worst
 * render, from the per-method bounds of `fakerMethodMaxBytes`, would pass
 * `MAX_RECORD_BYTES`, so it fails when saved rather than at every generate.
 */
export function assertTemplateFits(
	template: JsonObject | null | undefined,
): void {
	if (!template) return;
	const estimatedBytes =
		estimateTemplateBytes(template, fakerMethodMaxBytes) + RECORD_FRAME_BYTES;
	if (estimatedBytes <= MAX_RECORD_BYTES) return;
	throw new OperationError(
		400,
		"TEMPLATE_TOO_LARGE",
		`This template can produce records of about ${estimatedBytes} bytes; a record holds at most ${MAX_RECORD_BYTES}`,
		{ maxBytes: MAX_RECORD_BYTES, estimatedBytes },
	);
}
