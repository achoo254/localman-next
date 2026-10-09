/**
 * Resources from an OpenAPI 3.x document through the phase 17 importer
 * (`schemaFromOpenApi`): every object schema of `components.schemas`
 * becomes a resource, and a property holding an array of another
 * component makes that component a child resource. A component keeps one
 * parent; a link that would repeat a parent, close a loop or nest past
 * `MAX_RESOURCE_DEPTH` stays an Array field with a warning. `$ref` cycles,
 * external `$ref` and the importer's size limits fail the whole import.
 */
import type { JsonObject } from "./json-value.js";
import { ComponentTree } from "./openapi-component-tree.js";
import { chooseSchema, openApiSchemaNames } from "./openapi-document.js";
import {
	MAX_OPENAPI_IMPORT_STEPS,
	SchemaWalker,
} from "./openapi-schema-walker.js";
import { parentKeyOf } from "./resource-constants.js";
import {
	type OpenApiImportResult,
	importOpenApiSchema,
} from "./schema-from-openapi.js";
import {
	type SchemaImportErrorCode,
	SchemaImportFailure,
	paramText,
} from "./schema-import-errors.js";
import {
	type InferenceContext,
	MAX_INFERRED_RESOURCES,
} from "./schema-inference-context.js";

/** Component errors that skip the component instead of failing. */
const SKIPPED: ReadonlySet<SchemaImportErrorCode> = new Set([
	"UNSUPPORTED",
	"NO_FIELDS",
]);
/** Components read at most, skipped ones included. */
export const MAX_COMPONENTS_TRIED = 4 * MAX_INFERRED_RESOURCES;

type Imported = Extract<OpenApiImportResult, { ok: true }>;

interface Component {
	readonly schema: string;
	readonly name: string;
	readonly result: Imported;
}

/** The component, or why it is skipped (not an object, no fields). */
function importComponent(
	root: JsonObject,
	walker: SchemaWalker,
	schema: string,
): Imported | SchemaImportFailure {
	try {
		return importOpenApiSchema(root, walker, { schema });
	} catch (error) {
		if (error instanceof SchemaImportFailure && SKIPPED.has(error.code)) {
			return error;
		}
		throw error;
	}
}

/**
 * Object schemas of `components.schemas`, within the resource cap and
 * `MAX_COMPONENTS_TRIED`.
 */
function componentsOf(
	ctx: InferenceContext,
	root: JsonObject,
	walker: SchemaWalker,
): Component[] {
	const components: Component[] = [];
	const names = openApiSchemaNames(root);
	for (const [tried, schema] of names.entries()) {
		if (tried >= MAX_COMPONENTS_TRIED || !ctx.reserve()) {
			ctx.warn(
				"",
				"TOO_MANY_RESOURCES",
				"Too many schemas; the rest were not imported",
				{ max: MAX_INFERRED_RESOURCES },
			);
			break;
		}
		const result = importComponent(root, walker, schema);
		if (result instanceof SchemaImportFailure) {
			ctx.release();
			ctx.warn(schema, "SKIPPED", `${result.message}; not imported`, {
				path: paramText(schema),
			});
			continue;
		}
		components.push({ schema, name: ctx.resourceName(schema), result });
	}
	return components;
}

/** Adds the resources of the checked OpenAPI document `root` to `ctx`. */
export function inferFromOpenApi(
	ctx: InferenceContext,
	root: JsonObject,
	fallbackName: string,
): void {
	chooseSchema(root, {}); // Refuses Swagger 2 and non-3.x versions.
	const walker = new SchemaWalker(root, MAX_OPENAPI_IMPORT_STEPS);
	if (openApiSchemaNames(root).length === 0) {
		const result = importOpenApiSchema(root, walker, {});
		const name = ctx.resourceName(result.name ?? fallbackName);
		ctx.addWarnings(name, result.warnings);
		ctx.resources.push({ name, parentName: null, fields: result.fields });
		return;
	}
	const components = componentsOf(ctx, root, walker);
	const bySchema = new Map(components.map((c) => [c.schema, c]));
	const tree = new ComponentTree();
	for (const { schema, name, result } of components) {
		for (const ref of result.references) {
			if (!ref.many || !bySchema.has(ref.schema)) continue;
			const problem = tree.link(schema, ref.schema, ref.field);
			if (problem !== null) {
				const path = `${name}.${ref.field}`;
				ctx.warn(path, "KEPT_AS_ARRAY", `${problem}; kept as an Array field`, {
					path: paramText(path),
				});
			}
		}
	}
	const add = (component: Component, parent: Component | null): void => {
		const { name, result } = component;
		const nested = new Set(
			[...tree.parent]
				.filter(([, link]) => link.schema === component.schema)
				.map(([, link]) => link.field),
		);
		const parentKey = parent === null ? null : parentKeyOf(parent.name);
		ctx.addWarnings(name, result.warnings);
		if (result.fields.some((field) => field.name === parentKey)) {
			const path = `${name}.${parentKey}`;
			ctx.warn(path, "SKIPPED", "Generated for the parent link; removed", {
				path,
			});
		}
		const link = tree.parent.get(component.schema);
		ctx.resources.push({
			name,
			source: component.schema,
			parentName: parent?.name ?? null,
			...(link === undefined ? {} : { parentField: link.field }),
			fields: result.fields.filter(
				(field) => !nested.has(field.name) && field.name !== parentKey,
			),
		});
		for (const child of components) {
			if (tree.parent.get(child.schema)?.schema === component.schema) {
				add(child, component);
			}
		}
	};
	for (const component of components) {
		if (!tree.parent.has(component.schema)) add(component, null);
	}
}
