import { defineOperation } from "@localman/operations";
import {
	FAKER_MATCH_CONFIDENCE,
	FIELD_NAME_MAX,
	FIELD_TYPES,
	MAX_SCHEMA_FIELDS,
	exportTypeScript,
	exportZodSchemas,
	fakerValueKindOf,
	matchFakerField,
} from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { requireProject } from "../projects/project-service.js";
import { importResources } from "./resource-import-tree-operations.js";
import {
	ACCESS_NOTE,
	projectIdParam,
	resourceIdParam,
} from "./resource-operation-params.js";
import { findResource, loadResources, parentKeyIn } from "./resource-store.js";

const TYPE_FORMATS = ["typescript", "zod"] as const;

export const exportResourceTypes = defineOperation({
	id: "mock-advanced.exportResourceTypes",
	method: "POST",
	path: "/projects/:projectId/resource-types",
	summary: "Export TypeScript interfaces or Zod schemas of a project's records",
	description: `Source code describing the records the mock API returns: format "typescript" gives one interface per resource (two when it has Parent or Child Resource fields), "zod" gives Zod schemas with inferred types (import { z } from "zod"). Covers every resource, or the \`resourceIds\` listed (relations to resources left out become plain objects). Uses the saved schemas and object templates. ${ACCESS_NOTE}`,
	input: z.object({
		projectId: projectIdParam,
		format: z.enum(TYPE_FORMATS),
		resourceIds: z.array(resourceIdParam).min(1).max(200).optional(),
	}),
	output: z.object({
		format: z.enum(TYPE_FORMATS),
		code: z.string(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock-advanced",
	mcp: true,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"read",
			input.projectId,
		);
		const resources = await loadResources(project._id);
		const wanted =
			input.resourceIds === undefined
				? null
				: new Set(
						input.resourceIds.map((id) =>
							findResource(resources, id)._id.toHexString(),
						),
					);
		const selected = resources
			.map((resource) => ({
				id: resource._id.toHexString(),
				name: resource.name,
				parentId: resource.parentId?.toHexString() ?? null,
				parentKey: parentKeyIn(resources, resource),
				schema: resource.schema,
				template: resource.template,
			}))
			.filter((resource) => wanted === null || wanted.has(resource.id));
		const code =
			input.format === "zod"
				? exportZodSchemas(selected)
				: exportTypeScript(selected);
		return { format: input.format, code };
	},
});

export const suggestFakerMethods = defineOperation({
	id: "mock-advanced.suggestFakerMethods",
	method: "POST",
	path: "/faker-methods/suggestions",
	summary: "Suggest Faker methods for schema fields from their names",
	description: `For each field, the whitelisted Faker method its name suggests (email → internet.email, createdAt → date.past, so_dien_thoai → phone.number; English and Vietnamese without accents), limited to methods whose output fits \`type\` (default "Faker.js": any). \`confidence\` is ${FAKER_MATCH_CONFIDENCE.exact} for a whole-name match, ${FAKER_MATCH_CONFIDENCE.edge} for a match at the start or end and ${FAKER_MATCH_CONFIDENCE.contains} for one inside; method is null when nothing fits. Advice only: set it as fakerMethod of a Faker.js field with update_resource. Fails with 429 RATE_LIMITED past the per-account limit.`,
	input: z.object({
		fields: z
			.array(
				z.object({
					name: z.string().trim().min(1).max(FIELD_NAME_MAX),
					type: z.enum(FIELD_TYPES).default("Faker.js"),
				}),
			)
			.min(1)
			.max(MAX_SCHEMA_FIELDS),
	}),
	output: z.object({
		suggestions: z.array(
			z.object({
				name: z.string(),
				type: z.enum(FIELD_TYPES),
				method: z.string().nullable(),
				confidence: z.number().nullable(),
			}),
		),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock-advanced",
	mcp: true,
	handler: async (ctx, input) => {
		await takeOperationSlot("suggestFaker", requireSubject(ctx), null);
		return {
			suggestions: input.fields.map(({ name, type }) => {
				const kind = fakerValueKindOf(type);
				const match = kind === null ? null : matchFakerField(name, kind);
				return {
					name,
					type,
					method: match?.method ?? null,
					confidence: match?.confidence ?? null,
				};
			}),
		};
	},
});

/** The `mock-advanced` toolset: imports, type export and Faker hints. */
export const mockAdvancedOperations = [
	importResources,
	exportResourceTypes,
	suggestFakerMethods,
] as const;
