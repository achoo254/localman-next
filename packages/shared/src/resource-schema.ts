import { z } from "zod";
import { isFakerMethodId } from "./faker-method-catalog.js";
import { FORBIDDEN_KEYS } from "./json-value.js";
import {
	FIELD_NAME_MAX,
	FIELD_NAME_PATTERN,
	FIELD_TYPES,
	MAX_SCHEMA_FIELDS,
	MOCK_MCP_SEGMENT,
	OBJECT_ID_FIELD,
	OBJECT_ID_PATTERN,
	RESERVED_RESOURCE_NAMES,
	RESOURCE_NAME_MAX,
	RESOURCE_NAME_PATTERN,
	relationSourceOf,
} from "./resource-constants.js";
import {
	endpointsInputSchema,
	objectTemplateSchema,
} from "./resource-templates.js";

// Constants live in the zod-free module; re-exported for older imports.
export {
	DEFAULT_GENERATE_COUNT,
	DEFAULT_RESOURCE_FIELDS,
	FIELD_NAME_MAX,
	FIELD_NAME_PATTERN,
	FIELD_TYPES,
	type FieldType,
	MAX_GENERATE_COUNT,
	MAX_RECORDS_PER_RESOURCE,
	MAX_RESOURCE_DEPTH,
	MAX_SCHEMA_FIELDS,
	OBJECT_ID_FIELD,
	OBJECT_ID_PATTERN,
	RECORD_ID_MAX,
	RELATION_FIELD_TYPES,
	RESOURCE_NAME_MAX,
	RESOURCE_NAME_PATTERN,
} from "./resource-constants.js";
export { parentKeyOf } from "./parent-key.js";

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
	)
	.refine((name) => !RESERVED_RESOURCE_NAMES.includes(name), {
		message: `"${MOCK_MCP_SEGMENT}" is reserved for the project's MCP endpoint ({prefix}/${MOCK_MCP_SEGMENT}); choose another name`,
	});

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
		const sources = new Map<string, string>();
		fields.forEach((field, index) => {
			const source = relationSourceOf(field);
			const first = source === null ? undefined : sources.get(source);
			if (source !== null && first === undefined) {
				sources.set(source, field.name);
			} else if (first !== undefined) {
				const isParent = field.type === "Parent Resource";
				const verb = isParent ? "embeds" : "lists";
				ctx.addIssue({
					code: "custom",
					path: [index, isParent ? "type" : "childId"],
					message: `Field "${field.name}" ${verb} the same resource as "${first}"`,
				});
			}
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

/**
 * Body of `PUT /resources/:id`. Absent `schema`, `template`, `endpoints`
 * or `parentKey` keep their stored value. The parent changes only through
 * `PUT /resources/:id/parent`, which resets data. `parentKey` is checked
 * by the API (`parentKeyIssue`, no clash with a field): a key equal to the
 * current one is accepted as is, even one an older rule built.
 */
export const resourceUpdateSchema = z.object({
	name: resourceNameSchema,
	/** Parent ID field name of a nested resource's records (`userId`). */
	parentKey: z.string().optional(),
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
