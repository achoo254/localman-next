/**
 * Resource constants and pure helpers, without zod or the Faker catalog,
 * so a client can read limits and type lists (`@localman/shared/constants`)
 * without bundling the validation schemas. The schemas in
 * `resource-schema.ts` and `resource-templates.ts` build on these values.
 */

/** Records the generator creates at most (the 0–100 bar). */
export const MAX_GENERATE_COUNT = 100;
/** Records "Generate all" gives a resource that has none (prototype). */
export const DEFAULT_GENERATE_COUNT = 10;
/**
 * Records a resource may hold at most: the cap of `PUT …/data` and of
 * records created through the mock API. The generator stops at
 * `MAX_GENERATE_COUNT`; `MAX_RESOURCE_BYTES` applies on top.
 */
export const MAX_RECORDS_PER_RESOURCE = 1000;
/** Levels of nesting, a root resource being level 1. */
export const MAX_RESOURCE_DEPTH = 10;
export const MAX_SCHEMA_FIELDS = 50;
export const RESOURCE_NAME_MAX = 64;
export const FIELD_NAME_MAX = 64;
export const RECORD_ID_MAX = 64;

/** One URL path segment: letters, digits, `_` and `-`. */
export const RESOURCE_NAME_PATTERN = /^[A-Za-z0-9][\w-]*$/;
/**
 * Last path segment of a project's Hosted Mock MCP endpoint
 * (`{prefix}/mcp`), served before the REST routes.
 */
export const MOCK_MCP_SEGMENT = "mcp";
/**
 * Resource names refused when a resource is saved: `{prefix}/mcp` is the
 * MCP endpoint. Names compare case-sensitively, like routes.
 */
export const RESERVED_RESOURCE_NAMES: readonly string[] = [MOCK_MCP_SEGMENT];
/** Word characters, `-` and `.` (mockapi.io). */
export const FIELD_NAME_PATTERN = /^[\w\-.]+$/;
export const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/**
 * Field types of the schema editor. `Parent Resource` embeds the parent
 * record and `Child Resource` lists the records of a child resource; both
 * are resolved when the mock API answers, never stored in records.
 */
export const FIELD_TYPES = [
	"Faker.js",
	"String",
	"Number",
	"Boolean",
	"Object",
	"Array",
	"Date",
	"Parent Resource",
	"Child Resource",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Field types whose value is resolved from other resources. */
export const RELATION_FIELD_TYPES: ReadonlySet<FieldType> = new Set([
	"Parent Resource",
	"Child Resource",
]);

/**
 * Where a relation field reads its value: `parent`, or `child:<childId>`
 * for a Child Resource field; `null` for stored fields. A resource keeps
 * one field per source (a repeat would load and embed the same records
 * again), and the mock runtime queries each source once.
 */
export function relationSourceOf(
	field: Pick<ResourceFieldDefinition, "type" | "childId">,
): string | null {
	if (field.type === "Parent Resource") return "parent";
	if (field.type === "Child Resource") return `child:${field.childId ?? ""}`;
	return null;
}

/**
 * Generated, non-removable fields: `id` (Object ID) on every resource and
 * `{parent}Id` (Parent ID, see `parentKeyOf`) on a nested one. They are
 * not part of `schema`; user fields may not reuse their names.
 */
export const OBJECT_ID_FIELD = "id";

/** A schema field as stored and sent (validated by `resourceFieldSchema`). */
export interface ResourceFieldDefinition {
	readonly name: string;
	readonly type: FieldType;
	/** `category.method` of the whitelist; Faker.js fields only. */
	readonly fakerMethod?: string;
	/** Id of a direct child resource; Child Resource fields only. */
	readonly childId?: string;
}

/** Schema of a new resource besides `id` (as in the source). */
export const DEFAULT_RESOURCE_FIELDS: readonly ResourceFieldDefinition[] =
	Object.freeze([
		{ name: "createdAt", type: "Faker.js", fakerMethod: "date.past" },
		{ name: "name", type: "Faker.js", fakerMethod: "name.fullName" },
		{ name: "avatar", type: "Faker.js", fakerMethod: "image.avatar" },
	]);

function singular(name: string): string {
	if (/ies$/i.test(name)) return `${name.slice(0, -3)}y`;
	if (/(?:ss|sh|ch|x|z)es$/i.test(name)) return name.slice(0, -2);
	if (/(?:ss|us|is)$/i.test(name)) return name;
	if (/s$/i.test(name)) return name.slice(0, -1);
	return name;
}

/**
 * Name of the Parent ID field of the children of `parentName`:
 * `users` → `userId`, `categories` → `categoryId`, `boxes` → `boxId`.
 */
export function parentKeyOf(parentName: string): string {
	return `${singular(parentName) || parentName}Id`;
}

/** The five generated endpoints of a resource (PATCH shares PUT). */
export const RESOURCE_ENDPOINTS = Object.freeze([
	{ method: "GET", path: "/:res" },
	{ method: "GET", path: "/:res/:id" },
	{ method: "POST", path: "/:res" },
	{ method: "PUT", path: "/:res/:id" },
	{ method: "DELETE", path: "/:res/:id" },
] as const);
export const ENDPOINT_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
export const ENDPOINT_PATHS = ["/:res", "/:res/:id"] as const;
export const DEFAULT_RESPONSE = "$mockData";
