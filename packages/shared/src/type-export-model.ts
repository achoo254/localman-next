/**
 * Language-neutral model of the records a resource tree returns, rendered
 * by `type-exporters.ts` as TypeScript or Zod. A record holds `id`, the
 * `{parent}Id` of a nested resource and its stored fields (from the object
 * template when there is one, else from the schema); `Parent Resource` and
 * `Child Resource` fields are added by the mock API and embed the related
 * records without their own relation fields, so a resource that has
 * relations gets a separate `…Record` type for the embedded form.
 */
import type { JsonObject } from "./json-value.js";
import {
	OBJECT_ID_FIELD,
	RELATION_FIELD_TYPES,
	type ResourceFieldDefinition,
	parentKeyOf,
} from "./resource-constants.js";
import {
	DICT,
	NULL,
	SKIPPED_KEYS,
	STRING,
	type TypeField,
	type TypeNode,
	objectFields,
	schemaField,
	union,
} from "./type-export-fields.js";

/** What the exporters need of a resource (a resource view fits). */
export interface TypeExportResource {
	readonly id: string;
	readonly name: string;
	readonly parentId: string | null;
	/** `{parent}Id`; worked out from the parent when absent. */
	readonly parentKey?: string | null;
	readonly schema: readonly ResourceFieldDefinition[];
	readonly template?: JsonObject | null;
}

export interface ResourceTypeModel {
	readonly resourceName: string;
	/** Type of a record as the resource's own endpoints return it. */
	readonly typeName: string;
	/** Type of the embedded record; `null` when it equals `typeName`. */
	readonly recordName: string | null;
	readonly stored: readonly TypeField[];
	readonly relations: readonly TypeField[];
}

/** `blog-posts` → `BlogPost`; a leading digit gets a `Resource` prefix. */
function typeNameOf(resourceName: string): string {
	// `parentKeyOf` singularises: `categories` → `categoryId`.
	const singular = parentKeyOf(resourceName).slice(0, -"Id".length);
	const words = singular.match(/[A-Za-z0-9]+/g) ?? [];
	const name = words
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join("");
	return /^[A-Z]/.test(name) ? name : `Resource${name}`;
}

function claim(used: Set<string>, wanted: string): string {
	let name = wanted;
	for (let n = 2; used.has(name); n += 1) name = `${wanted}${n}`;
	used.add(name);
	return name;
}

/** Parents before children, siblings in input order. */
function treeOrder(
	resources: readonly TypeExportResource[],
): TypeExportResource[] {
	const ids = new Set(resources.map((resource) => resource.id));
	const ordered: TypeExportResource[] = [];
	const visit = (parentId: string | null, seen: Set<string>): void => {
		for (const resource of resources) {
			const isRoot = parentId === null && !ids.has(resource.parentId ?? "");
			if (seen.has(resource.id) || !(isRoot || resource.parentId === parentId))
				continue;
			seen.add(resource.id);
			ordered.push(resource);
			visit(resource.id, seen);
		}
	};
	visit(null, new Set());
	return ordered;
}

/** One model per resource, parents first, with unique type names. */
export function buildTypeModels(
	resources: readonly TypeExportResource[],
): ResourceTypeModel[] {
	const used = new Set<string>();
	const named = treeOrder(resources).map((resource) => {
		const typeName = claim(used, typeNameOf(resource.name));
		const related = resource.schema.some((f) =>
			RELATION_FIELD_TYPES.has(f.type),
		);
		const recordName = related ? claim(used, `${typeName}Record`) : null;
		return { resource, typeName, recordName };
	});
	const byId = new Map(named.map((entry) => [entry.resource.id, entry]));
	const refTo = (id: string): TypeNode => {
		const target = byId.get(id);
		if (target === undefined) return DICT;
		return { kind: "ref", name: target.recordName ?? target.typeName };
	};
	return named.map(({ resource, typeName, recordName }) => {
		const { parentId } = resource;
		const parent = byId.get(parentId ?? "")?.resource;
		const parentKey =
			resource.parentKey !== undefined
				? resource.parentKey
				: parent && parentKeyOf(parent.name);
		const relations = resource.schema.flatMap((field): TypeField[] => {
			const note = field.type;
			if (field.type === "Parent Resource") {
				const type = parentId === null ? NULL : union([refTo(parentId), NULL]);
				return [{ key: field.name, type, note }];
			}
			if (field.type !== "Child Resource") return [];
			const child = byId.get(field.childId ?? "")?.resource;
			const item = child?.parentId === resource.id ? refTo(child.id) : DICT;
			return [{ key: field.name, type: { kind: "array", item }, note }];
		});
		const generated = [OBJECT_ID_FIELD, ...(parentKey ? [parentKey] : [])];
		const skip = new Set([...generated, ...relations.map((f) => f.key)]);
		const stored = resource.template
			? objectFields(resource.template, skip)
			: resource.schema
					.filter((f) => !skip.has(f.name) && !SKIPPED_KEYS.has(f.name))
					.map(schemaField);
		return {
			resourceName: resource.name,
			typeName,
			recordName,
			stored: [...generated.map((key) => ({ key, type: STRING })), ...stored],
			relations,
		};
	});
}
