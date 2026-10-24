import { createHash } from "node:crypto";
import {
	type JsonObject,
	RELATION_FIELD_TYPES,
	type ResourceField,
	resourceParentKey,
} from "@localman/shared";
import { recordSample } from "../live-mock-sync/schema-sample.js";

/** What docs read of a resource (tree order, parents first). */
export interface DocsResource {
	readonly id: string;
	readonly name: string;
	readonly parentId: string | null;
	readonly parentKey?: string | null;
	readonly schema: readonly ResourceField[];
	readonly endpoints: readonly {
		readonly method: string;
		readonly path: string;
		readonly enabled: boolean;
	}[];
}

export interface DocsField {
	readonly name: string;
	readonly type: string;
	/** Faker method, or the related resource of a relation field. */
	readonly detail: string | null;
}

export interface DocsEndpoint {
	readonly method: string;
	/** On `{baseUrl}`, record ids as `{id}` / `{userId}`. */
	readonly path: string;
}

export interface DocsResourceView {
	readonly name: string;
	readonly depth: number;
	readonly fields: DocsField[];
	readonly endpoints: DocsEndpoint[];
	readonly example: JsonObject;
}

export interface ProjectDocs {
	readonly name: string;
	readonly resources: DocsResourceView[];
	/** Hash of the content: changes exactly when the docs change. */
	readonly version: string;
}

function collectionPath(
	resource: DocsResource,
	byId: ReadonlyMap<string, DocsResource>,
): { path: string; depth: number } {
	const segments = [resource.name];
	let child = resource;
	let depth = 0;
	let parentId = resource.parentId;
	while (parentId !== null) {
		const parent = byId.get(parentId);
		if (!parent) break;
		segments.unshift(parent.name, `{${resourceParentKey(child, parent.name)}}`);
		child = parent;
		parentId = parent.parentId;
		depth += 1;
	}
	return { path: `/${segments.join("/")}`, depth };
}

function fieldOf(
	field: ResourceField,
	byId: ReadonlyMap<string, DocsResource>,
	parentName: string | null,
): DocsField {
	let detail: string | null = field.fakerMethod ?? null;
	if (field.type === "Child Resource") {
		detail = byId.get(field.childId ?? "")?.name ?? null;
	} else if (field.type === "Parent Resource") {
		detail = parentName;
	}
	return { name: field.name, type: field.type, detail };
}

/**
 * The docs of a mock project: each resource with its fields, the
 * endpoints it serves (enabled ones; PUT also answers PATCH) and an
 * example record from the schema. The mock's URL is never in them: paths
 * sit on `{baseUrl}`, since the URL carries the project secret.
 */
export function renderProjectDocs(
	name: string,
	resources: readonly DocsResource[],
): ProjectDocs {
	const byId = new Map(resources.map((r) => [r.id, r]));
	const views = resources.map((resource): DocsResourceView => {
		const { path, depth } = collectionPath(resource, byId);
		const parentName =
			resource.parentId === null
				? null
				: (byId.get(resource.parentId)?.name ?? null);
		const endpoints = resource.endpoints
			.filter((e) => e.enabled)
			.flatMap((e): DocsEndpoint[] => {
				const at = e.path === "/:res" ? path : `${path}/{id}`;
				return e.method === "PUT"
					? [
							{ method: "PUT", path: at },
							{ method: "PATCH", path: at },
						]
					: [{ method: e.method, path: at }];
			});
		return {
			name: resource.name,
			depth,
			fields: resource.schema.map((f) => fieldOf(f, byId, parentName)),
			endpoints,
			example: recordSample(
				resource.schema.filter((f) => !RELATION_FIELD_TYPES.has(f.type)),
			),
		};
	});
	const version = createHash("sha256")
		.update(JSON.stringify({ name, views }))
		.digest("base64url")
		.slice(0, 22);
	return { name, resources: views, version };
}
