import { type ResourceField, parentKeyOf } from "@localman/shared";
import {
	type CollectionNode,
	type HttpMethod,
	createRequestDraft,
	emptyRequestBody,
	orderKeysBetween,
} from "@localman/shared/api-client";
import { bodySample, exampleOf, prettyJson } from "./schema-sample.js";
import { type MockScope, folderKey, requestKey } from "./sync-keys.js";
import { type SyncNames, fillName } from "./sync-names.js";

/** What the mapper reads of a resource. */
export interface MockSyncResource {
	readonly id: string;
	readonly name: string;
	readonly parentId: string | null;
	readonly schema: readonly ResourceField[];
	readonly endpoints: readonly {
		readonly method: string;
		readonly path: string;
		readonly enabled: boolean;
	}[];
}

/** Nodes keyed like `sync-keys.ts`; `id` and `parentId` hold keys too. */
export type MockNodes = Record<string, CollectionNode>;

type RequestKind = Exclude<keyof SyncNames, `removed${string}` | "environment">;

/** The requests of an enabled endpoint (PUT also gives PATCH), in order. */
const REQUESTS_OF: Record<
	string,
	readonly [HttpMethod, MockScope, RequestKind][]
> = {
	"GET /:res": [["GET", "collection", "list"]],
	"GET /:res/:id": [["GET", "item", "get"]],
	"POST /:res": [["POST", "collection", "create"]],
	"PUT /:res/:id": [
		["PUT", "item", "update"],
		["PATCH", "item", "patch"],
	],
	"DELETE /:res/:id": [["DELETE", "item", "delete"]],
};

const WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

/** Variable holding a record id of the resource, e.g. `userId`. */
export const idVariableOf = (resourceName: string): string =>
	parentKeyOf(resourceName);

/**
 * Path of the resource's collection after `{{baseUrl}}`: each ancestor's
 * name and one of its record ids, then the resource's name.
 */
function collectionPathOf(
	resource: MockSyncResource,
	byId: ReadonlyMap<string, MockSyncResource>,
): string {
	const segments = [resource.name];
	let parentId = resource.parentId;
	while (parentId !== null) {
		const parent = byId.get(parentId);
		if (!parent) break;
		segments.unshift(parent.name, `{{${idVariableOf(parent.name)}}}`);
		parentId = parent.parentId;
	}
	return `/${segments.join("/")}`;
}

function requestNodes(
	resource: MockSyncResource,
	path: string,
	names: SyncNames,
): CollectionNode[] {
	const folder = folderKey(resource.id);
	const itemPath = `${path}/{{${idVariableOf(resource.name)}}}`;
	const enabled = resource.endpoints.filter((endpoint) => endpoint.enabled);
	const specs = enabled.flatMap(
		(endpoint) => REQUESTS_OF[`${endpoint.method} ${endpoint.path}`] ?? [],
	);
	const orders = orderKeysBetween(null, null, specs.length);
	return specs.flatMap(([method, scope, kind], index): CollectionNode[] => {
		const id = requestKey(resource.id, method, scope);
		const url = `{{baseUrl}}${scope === "collection" ? path : itemPath}`;
		const body = WITH_BODY.has(method)
			? {
					...emptyRequestBody(),
					type: "raw" as const,
					raw: prettyJson(bodySample(resource.schema)),
				}
			: emptyRequestBody();
		const draft = createRequestDraft({
			name: fillName(names[kind], resource.name),
			method,
			url,
			body,
		});
		const request: CollectionNode = {
			kind: "request",
			id,
			parentId: folder,
			order: orders[index] ?? "a0",
			name: draft.name,
			description: "",
			draft,
		};
		if (method !== "GET") return [request];
		return [request, exampleOf(id, draft, scope, resource.schema)];
	});
}

/**
 * The collection a mock project stands for: one folder per resource
 * (nested resources inside their parent's), holding a request per enabled
 * endpoint on `{{baseUrl}}`, with a sample body built from the schema and
 * an example answer for each GET. Pure; `resources` come parent first.
 */
export function mockToCollection(
	resources: readonly MockSyncResource[],
	names: SyncNames,
): MockNodes {
	const byId = new Map(resources.map((resource) => [resource.id, resource]));
	const nodes: MockNodes = {};
	const childFolders = new Map<string | null, MockSyncResource[]>();
	for (const resource of resources) {
		const parent = byId.has(resource.parentId ?? "") ? resource.parentId : null;
		const list = childFolders.get(parent) ?? [];
		list.push(resource);
		childFolders.set(parent, list);
	}
	for (const resource of resources) {
		const path = collectionPathOf(resource, byId);
		for (const node of requestNodes(resource, path, names)) {
			nodes[node.id] = node;
		}
	}
	for (const [parent, children] of childFolders) {
		// Folders go after the requests of the folder they sit in.
		const after =
			parent === null
				? null
				: Object.values(nodes)
						.filter((node) => node.parentId === folderKey(parent))
						.reduce<string | null>(
							(max, node) =>
								max === null || node.order > max ? node.order : max,
							null,
						);
		const orders = orderKeysBetween(after, null, children.length);
		children.forEach((resource, index) => {
			const id = folderKey(resource.id);
			nodes[id] = {
				kind: "folder",
				id,
				parentId: parent === null ? null : folderKey(parent),
				order: orders[index] ?? "a0",
				name: resource.name,
				description: "",
				auth: { type: "inherit" },
				scripts: { pre: "", post: "" },
			};
		});
	}
	return nodes;
}

/** One id variable per resource, in tree order, without repeats. */
export function idVariablesOf(
	resources: readonly MockSyncResource[],
): string[] {
	return [...new Set(resources.map((resource) => idVariableOf(resource.name)))];
}
