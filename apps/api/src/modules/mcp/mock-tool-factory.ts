import {
	type JsonObject,
	type MockToolAction,
	type MockToolNode,
	type ResourceFieldDefinition,
	mockToolEntries,
	parentKeyOf,
} from "@localman/shared";
import {
	ACTIONS,
	type MockToolAnnotations,
	describeTool,
} from "./mock-tool-actions.js";
import type { ToolInputSchema } from "./mock-tool-schemas.js";

export type { MockToolAction, MockToolAnnotations, ToolInputSchema };

/** A resource of the project, as stored (ids as strings). */
export interface MockToolResource extends MockToolNode {
	readonly schema: readonly ResourceFieldDefinition[];
	readonly template: JsonObject | null;
}

/** What the tool runs: one endpoint of one resource. */
export interface MockToolTarget {
	readonly resourceId: string;
	readonly action: MockToolAction;
	/** Ids of the ancestor resources, outermost first; `[]` for a root. */
	readonly parentChain: readonly string[];
}

export interface MockToolDefinition {
	readonly name: string;
	readonly title: string;
	readonly description: string;
	readonly inputSchema: ToolInputSchema;
	readonly annotations: MockToolAnnotations;
	readonly target: MockToolTarget;
}

/**
 * MCP tools of a project's mock. Which tools exist, their order and
 * their names come from `mockToolEntries` (`@localman/shared`, also used
 * by the web MCP tab): `list_`, `get_`, `create_`, `update_` and
 * `delete_<res>` for every resource, nested ones included, each only
 * while its REST endpoint is enabled. This adds titles, descriptions,
 * annotations and input schemas. Pure: the same tree gives the same tools.
 *
 * A nested resource takes only `parentId`, the id of the direct parent
 * record: record ids are unique within a resource and every record keeps
 * its parent's id, so the records further up follow from it. Asking for
 * one id per level (`userId`, `postId`, …) would only add ways to send
 * a mismatched path. `target.parentChain` gives the ancestor resources
 * needed to rebuild the nested route.
 */
export function buildMockTools(
	resources: readonly MockToolResource[],
): MockToolDefinition[] {
	const parents = new Set(resources.map((resource) => resource.parentId));
	return mockToolEntries(resources).map(
		({ name, action, resource, ancestors }): MockToolDefinition => {
			const parent = ancestors.at(-1) ?? null;
			const names = ancestors.map((node) => node.name);
			const place = {
				name: resource.name,
				ancestors: names,
				hasChildren: parents.has(resource.id),
			};
			return {
				name,
				title: `${ACTIONS[action].verb} ${[...names, resource.name].join("/")}`,
				description: describeTool(action, place),
				inputSchema: ACTIONS[action].input({
					schema: resource.schema,
					template: resource.template,
					parentKey: parent === null ? null : parentKeyOf(parent.name),
					parentName: parent?.name ?? null,
				}),
				annotations: ACTIONS[action].annotations,
				target: {
					resourceId: resource.id,
					action,
					parentChain: ancestors.map((node) => node.id),
				},
			};
		},
	);
}
