import { defineOperation } from "@localman/operations";
import {
	MAX_INFERRED_RESOURCES,
	MAX_RECORDS_PER_RESOURCE,
	resourceNameSchema,
} from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { requireProject } from "../projects/project-service.js";
import { projectUiUrlOf } from "../projects/project-view.js";
import { IMPORT_FORMATS, planImport } from "./resource-import-plan.js";
import {
	importWarningView,
	importedResourceView,
	previewOf,
} from "./resource-import-preview.js";
import {
	createImportedResources,
	resourcesLeftFor,
} from "./resource-import-service.js";
import {
	IMPORT_BODY_LIMIT,
	PLAN_NOTE,
	RESOURCES_PATH,
	SIZE_NOTE,
	projectIdParam,
} from "./resource-operation-params.js";
import { resourceView, toResourceView } from "./resource-view.js";

const importInput = z.object({
	projectId: projectIdParam,
	format: z.enum(IMPORT_FORMATS),
	// Text is measured by the importer (413 past 2 MB), not cut here.
	input: z.union([
		z.string().min(1),
		z.array(z.unknown()),
		z.record(z.string(), z.unknown()),
	]),
	name: resourceNameSchema.optional(),
	schema: z.string().trim().min(1).max(200).optional(),
	includeRelated: z.boolean().default(true),
	names: z
		.record(z.string().max(200), resourceNameSchema)
		.refine((names) => Object.keys(names).length <= MAX_INFERRED_RESOURCES, {
			message: `At most ${MAX_INFERRED_RESOURCES} names`,
		})
		.default({}),
});

export const importResources = defineOperation({
	id: "mock-advanced.importResources",
	method: "POST",
	path: `${RESOURCES_PATH}/import`,
	summary: "Create resources with seed data from sample JSON, OpenAPI or CSV",
	description: `Infers resources from \`input\` and creates them at the root in one go. format "json": an object or an array of objects (each object a record; arrays of objects inside become nested resources; an object of such arrays makes one resource per key). format "csv": the header names the fields, types come from the first 100 rows (UTF-8, quoted cells may hold commas). format "openapi": an OpenAPI 3.x JSON document; \`schema\` picks the components.schemas entry (default: the first top-level one) and includeRelated (default true) also creates the schemas it nests through array $ref; OpenAPI resources start empty. Input up to 2 MB; $ref outside the document is refused, never fetched. Field types and Faker methods are guessed from values and names; up to ${MAX_RECORDS_PER_RESOURCE} records per resource are kept. \`name\` renames the main (first) resource, \`names\` the others by the name a preview gave them. Call with dryRun first: it returns the resources (fields, up to 5 sample records), warnings with a code, \`resourcesLeft\` on the owner's plan and, for OpenAPI, \`schemaNames\`; nothing is created. Fails with 400/413 SCHEMA_IMPORT_FAILED (details.reason and its params, e.g. REF_CYCLE with cycle, EXTERNAL_REF with ref, CSV_QUOTE with row), 409 RESOURCE_NAME_TAKEN and 429 RATE_LIMITED (previews count too). ${PLAN_NOTE} ${SIZE_NOTE}`,
	input: importInput,
	output: z.object({
		dryRun: z.boolean(),
		/** Parents before children; the first one is the main resource. */
		resources: z.array(importedResourceView),
		warnings: z.array(importWarningView),
		/** OpenAPI: schemas that can become the main resource. */
		schemaNames: z.array(z.string()),
		selectedSchema: z.string().nullable(),
		/** OpenAPI: resources nested under the selected schema. */
		relatedCount: z.number().int().min(0),
		/** Resources the owner's plan still allows; `null` when uncapped. */
		resourcesLeft: z.number().int().min(0).nullable(),
		/** The created resources (empty for a dry run), in tree order. */
		created: z.array(resourceView),
		uiUrl: z.string(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "mock-advanced",
	mcp: true,
	dryRun: true,
	bodyLimit: IMPORT_BODY_LIMIT,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "editResources", input.projectId);
		await takeOperationSlot("import", sub, project._id.toHexString());
		const plan = planImport(input);
		const imported = ctx.dryRun
			? null
			: await createImportedResources(project, plan.resources);
		return {
			dryRun: ctx.dryRun,
			resources: previewOf(plan, input.format),
			warnings: [...plan.warnings],
			schemaNames: [...plan.schemaNames],
			selectedSchema: plan.selectedSchema,
			relatedCount: plan.relatedCount,
			resourcesLeft: await resourcesLeftFor(project),
			created: (imported?.created ?? []).map((resource) =>
				toResourceView(resource, imported?.resources ?? []),
			),
			uiUrl: projectUiUrlOf(project._id.toHexString()),
		};
	},
});
