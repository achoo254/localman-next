import { z } from "zod";
import { isFakerMethodId } from "./faker-method-catalog.js";
import { FORBIDDEN_KEYS } from "./json-value.js";
import {
	endpointsInputSchema,
	objectTemplateSchema,
} from "./resource-templates.js";

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
 * Generated, non-removable fields: `id` (Object ID) on every resource and
 * `{parent}Id` (Parent ID, see `parentKeyOf`) on a nested one. They are
 * not part of `schema`; user fields may not reuse their names.
 */
export const OBJECT_ID_FIELD = "id";

export const resourceNameSchema = z
	.string()
	.trim()
	.min(1, "Name is required")
	.max(
		RESOURCE_NAME_MAX,
		`Name must be at most ${RESOURCE_NAME_MAX} characters`,
	)
	.regex(
		RESOURCE_NAME_PATTERN,
		"Name must start with a letter or digit and contain only letters, digits, _ and -",
	);

export const resourceFieldSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(1, "Field name is required")
			.max(FIELD_NAME_MAX)
			.regex(
				FIELD_NAME_PATTERN,
				"Field names may contain letters, digits, _, - and . only",
			)
			.refine((name) => !FORBIDDEN_KEYS.includes(name), {
				message: `Field names cannot be ${FORBIDDEN_KEYS.join(", ")}`,
			}),
		type: z.enum(FIELD_TYPES),
		/** `category.method` of the whitelist; Faker.js fields only. */
		fakerMethod: z.string().max(100).optional(),
		/** Id of a direct child resource; Child Resource fields only. */
		childId: z.string().regex(OBJECT_ID_PATTERN).optional(),
	})
	.superRefine((field, ctx) => {
		const issue = (path: string, message: string) =>
			ctx.addIssue({ code: "custom", path: [path], message });
		if (field.type === "Faker.js") {
			if (field.fakerMethod === undefined) {
				issue("fakerMethod", "Faker.js fields need a Faker method");
			} else if (!isFakerMethodId(field.fakerMethod)) {
				issue("fakerMethod", `Unknown Faker method "${field.fakerMethod}"`);
			}
		} else if (field.fakerMethod !== undefined) {
			issue("fakerMethod", "Only Faker.js fields have a Faker method");
		}
		if (field.type === "Child Resource") {
			if (field.childId === undefined) {
				issue("childId", "Child Resource fields need a child resource");
			}
		} else if (field.childId !== undefined) {
			issue("childId", "Only Child Resource fields have a child resource");
		}
	});
export type ResourceField = z.output<typeof resourceFieldSchema>;

export const resourceFieldsSchema = z
	.array(resourceFieldSchema)
	.max(MAX_SCHEMA_FIELDS, `A resource has at most ${MAX_SCHEMA_FIELDS} fields`)
	.superRefine((fields, ctx) => {
		const seen = new Set<string>();
		fields.forEach((field, index) => {
			if (field.name === OBJECT_ID_FIELD) {
				ctx.addIssue({
					code: "custom",
					path: [index, "name"],
					message: `"${OBJECT_ID_FIELD}" is generated and cannot be a schema field`,
				});
			} else if (seen.has(field.name)) {
				ctx.addIssue({
					code: "custom",
					path: [index, "name"],
					message: `Field "${field.name}" appears more than once`,
				});
			}
			seen.add(field.name);
		});
	});

/** Schema of a new resource besides `id` (as in the source). */
export const DEFAULT_RESOURCE_FIELDS: readonly ResourceField[] = Object.freeze([
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

/**
 * Body of `PUT /resources/:id`. Absent `schema`, `template` or `endpoints`
 * keep their stored value. The parent changes only through
 * `PUT /resources/:id/parent`, which resets data.
 */
export const resourceUpdateSchema = z.object({
	name: resourceNameSchema,
	schema: resourceFieldsSchema.optional(),
	template: objectTemplateSchema.optional(),
	endpoints: endpointsInputSchema.optional(),
});
export type ResourceUpdate = z.output<typeof resourceUpdateSchema>;

/**
 * Body of `POST /resources`. Defaults: root resource, `DEFAULT_RESOURCE_FIELDS`,
 * no template, the five endpoints enabled with `$mockData`.
 */
export const resourceCreateSchema = resourceUpdateSchema.extend({
	parentId: z.string().regex(OBJECT_ID_PATTERN).nullable().default(null),
});
export type ResourceCreate = z.output<typeof resourceCreateSchema>;
