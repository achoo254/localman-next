import { checkJson, isJsonObject } from "@localman/shared";
import {
	type TypeExportResource,
	exportTypeScript,
	exportZodSchemas,
} from "@localman/shared/constants";
import type { Resource } from "./resource-model";

export type TypeFormat = "ts" | "zod";

/**
 * `resource` with the parent and children its relation fields embed, so
 * the export defines every type it references (and nothing else).
 */
export function exportSetOf(
	resource: Resource,
	resources: readonly Resource[],
): TypeExportResource[] {
	const wanted = new Set([resource.id]);
	for (const field of resource.schema) {
		if (field.type === "Parent Resource" && resource.parentId) {
			wanted.add(resource.parentId);
		}
		if (field.type === "Child Resource" && field.childId) {
			wanted.add(field.childId);
		}
	}
	return resources
		.filter((item) => wanted.has(item.id))
		.map((item) => ({ ...item, template: templateOf(item) }));
}

/** The object template as checked JSON (it came from the API as JSON). */
function templateOf(resource: Resource): TypeExportResource["template"] {
	if (resource.template === null) return null;
	const checked = checkJson(resource.template);
	return checked.ok && isJsonObject(checked.value) ? checked.value : null;
}

/** Source code of the saved types of `resource`, and its file name. */
export function exportTypes(
	format: TypeFormat,
	resource: Resource,
	resources: readonly Resource[],
): { code: string; fileName: string } {
	const set = exportSetOf(resource, resources);
	return format === "ts"
		? { code: exportTypeScript(set), fileName: `${resource.name}.ts` }
		: { code: exportZodSchemas(set), fileName: `${resource.name}.schema.ts` };
}
