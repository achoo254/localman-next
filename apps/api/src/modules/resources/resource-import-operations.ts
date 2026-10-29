import { defineOperation, validationError } from "@localman/operations";
import {
	MAX_OPENAPI_BYTES,
	OBJECT_ID_PATTERN,
	type SchemaImportResult,
	resourceCreateSchema,
	resourceNameSchema,
	schemaFromOpenApi,
	schemaFromTypeScript,
} from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import { projectUiUrlOf } from "../projects/project-view.js";
import { importWarningView } from "./resource-import-preview.js";
import { createImportedResources } from "./resource-import-service.js";
import {
	IMPORT_BODY_LIMIT,
	PLAN_NOTE,
	RESOURCES_PATH,
	projectIdParam,
} from "./resource-operation-params.js";
import { resourceView, toResourceView } from "./resource-view.js";
import { schemaImportError } from "./schema-import-error.js";

const SCHEMA_FORMATS = ["typescript", "openapi", "json-schema"] as const;

const importInput = z.object({
	projectId: projectIdParam,
	name: resourceNameSchema,
	parentId: z.string().regex(OBJECT_ID_PATTERN).nullable().default(null),
	format: z.enum(SCHEMA_FORMATS),
	source: z.union([
		z.string().min(1).max(MAX_OPENAPI_BYTES),
		z.record(z.string(), z.unknown()),
	]),
	schemaName: z.string().trim().min(1).max(200).optional(),
	openApiPath: z.string().min(1).max(2048).optional(),
});
type ImportInput = z.output<typeof importInput>;

/** Fields of the pasted source; never evaluated, bounded by the parsers. */
function importFields(input: ImportInput): SchemaImportResult {
	if (input.format === "typescript") {
		return schemaFromTypeScript(input.source, { name: input.schemaName });
	}
	return schemaFromOpenApi(input.source, {
		schema: input.schemaName,
		path: input.openApiPath,
	});
}

export const createResourceFromSchema = defineOperation({
	id: "mock.createResourceFromSchema",
	method: "POST",
	path: `${RESOURCES_PATH}/from-schema`,
	summary: "Create a resource from a TypeScript, OpenAPI or JSON Schema type",
	description: `Creates a resource (at the root or under parentId) whose schema fields come from \`source\`: a TypeScript interface or type alias (format "typescript", text up to 20 KB; schemaName picks the declaration, default the first object type), an OpenAPI 3.x document or Schema Object (format "openapi", JSON text or object up to 2 MB; schemaName picks components.schemas, openApiPath the request body of a path) or a JSON Schema object (format "json-schema"). Nothing is evaluated. Types map to Localman field types and, where the name or format suggests one, a Faker method; unsupported parts come back as warnings. Fails with 400 SCHEMA_IMPORT_FAILED (details.reason with its params, e.g. ref or cycle; 413 for INPUT_TOO_LARGE) when no fields can be read. Sibling names must be unique (409 RESOURCE_NAME_TAKEN). Then fill it with generate_resource_data. ${PLAN_NOTE}`,
	input: importInput,
	output: z.object({
		resource: resourceView,
		/** Declaration or schema the fields came from, when it has a name. */
		importedFrom: z.string().nullable(),
		warnings: z.array(importWarningView),
		uiUrl: z.string(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "mock",
	mcp: true,
	bodyLimit: IMPORT_BODY_LIMIT,
	successStatus: 201,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"editResources",
			input.projectId,
		);
		const imported = importFields(input);
		if (!imported.ok) throw schemaImportError(imported.error);
		const create = resourceCreateSchema.safeParse({
			name: input.name,
			parentId: input.parentId,
			schema: imported.fields,
		});
		if (!create.success) throw validationError(create.error);
		const { created, resources } = await createImportedResources(
			project,
			[
				{
					key: create.data.name,
					name: create.data.name,
					parent: null,
					parentName: null,
					fields: create.data.schema ?? [],
					childFields: [],
					records: [],
					truncated: false,
				},
			],
			create.data.parentId,
		);
		const [resource] = created;
		if (resource === undefined) throw new Error("Import created nothing");
		return {
			resource: toResourceView(resource, resources),
			importedFrom: imported.name,
			warnings: [...imported.warnings],
			uiUrl: projectUiUrlOf(project._id.toHexString()),
		};
	},
});
