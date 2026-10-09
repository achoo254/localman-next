/**
 * Which inferred resources an import keeps: for OpenAPI the chosen schema
 * (default: the first top-level one) and, with `includeRelated`, the
 * schemas nested under it; and the warnings about what is kept.
 */
import {
	type InferredResource,
	MAX_SCHEMA_FIELDS,
	type ResourceFieldDefinition,
	type SchemaImportWarning,
} from "@localman/shared";
import { schemaImportError } from "./schema-import-error.js";

export interface Selection {
	readonly resources: readonly InferredResource[];
	readonly schemaNames: readonly string[];
	readonly selectedSchema: string | null;
	readonly relatedCount: number;
}

/** `root` and every resource nested under it; inference lists parents first. */
function subtreeOf(
	all: readonly InferredResource[],
	root: InferredResource,
): InferredResource[] {
	const names = new Set([root.name]);
	return all.filter((resource) => {
		if (resource === root) return true;
		if (resource.parentName === null || !names.has(resource.parentName)) {
			return false;
		}
		names.add(resource.name);
		return true;
	});
}

/** The chosen schema (default: the first top-level one) and maybe its subtree. */
export function selectOpenApi(
	all: readonly InferredResource[],
	request: { readonly schema?: string; readonly includeRelated: boolean },
): Selection {
	const schemaNames = all.flatMap((r) => (r.source ? [r.source] : []));
	if (schemaNames.length === 0) {
		return {
			resources: all,
			schemaNames,
			selectedSchema: null,
			relatedCount: 0,
		};
	}
	const wanted =
		request.schema ??
		all.find((r) => r.parentName === null && r.source)?.source ??
		schemaNames[0];
	const root = all.find((resource) => resource.source === wanted);
	if (root === undefined || wanted === undefined) {
		const name = String(wanted).slice(0, 200);
		throw schemaImportError({
			code: "SCHEMA_NOT_FOUND",
			message: `No object schema named ${JSON.stringify(name)}`,
			params: { name },
		});
	}
	const tree = subtreeOf(all, root);
	const top: InferredResource = { ...root, parentName: null };
	const base = {
		schemaNames,
		selectedSchema: wanted,
		relatedCount: tree.length - 1,
	};
	if (request.includeRelated)
		return { ...base, resources: [top, ...tree.slice(1)] };
	// Without its related resources, the fields that held them stay Arrays.
	const arrays = tree.flatMap((r): ResourceFieldDefinition[] =>
		r.parentName === root.name && r.parentField
			? [{ name: r.parentField, type: "Array" }]
			: [],
	);
	const fields = [...root.fields, ...arrays].slice(0, MAX_SCHEMA_FIELDS);
	return { ...base, resources: [{ ...top, fields }] };
}

/** Warnings about the selected resources, or about the input as a whole. */
export function warningsFor(
	warnings: readonly SchemaImportWarning[],
	resources: readonly InferredResource[],
): SchemaImportWarning[] {
	const prefixes = resources.flatMap((r) => [
		r.name,
		...(r.source ? [r.source] : []),
	]);
	return warnings.filter(
		({ path }) =>
			path === "" ||
			prefixes.some((p) => path === p || path.startsWith(`${p}.`)),
	);
}
