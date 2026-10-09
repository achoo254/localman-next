import { defineOperation } from "@localman/operations";
import { parentKeyOf } from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import { mockBaseUrlOf, projectUiUrlOf } from "../projects/project-view.js";
import type { StoredResource } from "./resource-model.js";
import { ACCESS_NOTE, projectIdParam } from "./resource-operation-params.js";
import { loadResources, toTreeNodes } from "./resource-store.js";
import { orderTree } from "./resource-tree.js";

const endpointUrl = z.object({
	method: z.string(),
	/** `{id}` and `{userId}`-style placeholders stand for record ids. */
	url: z.string(),
});

const resourceUrls = z.object({
	id: z.string(),
	name: z.string(),
	parentId: z.string().nullable(),
	depth: z.number().int().min(0),
	collectionUrl: z.string(),
	itemUrl: z.string(),
	/** Enabled endpoints only; PATCH shares the PUT endpoint. */
	endpoints: z.array(endpointUrl),
});

/**
 * Path of a resource's collection from the root: a nested resource sits
 * under one record of each ancestor (`/users/{userId}/posts`).
 */
function collectionPathOf(
	resource: StoredResource,
	byId: ReadonlyMap<string, StoredResource>,
): string {
	const segments = [resource.name];
	let parentId = resource.parentId?.toHexString() ?? null;
	while (parentId !== null) {
		const parent = byId.get(parentId);
		if (!parent) break;
		segments.unshift(parent.name, `{${parentKeyOf(parent.name)}}`);
		parentId = parent.parentId?.toHexString() ?? null;
	}
	return `/${segments.map(encodePathSegment).join("/")}`;
}

/** Names match `^[A-Za-z0-9][\w-]*$`; placeholders keep their braces. */
function encodePathSegment(segment: string): string {
	return segment.startsWith("{") ? segment : encodeURIComponent(segment);
}

function urlsOf(
	resource: StoredResource,
	depth: number,
	base: string,
	byId: ReadonlyMap<string, StoredResource>,
): z.input<typeof resourceUrls> {
	const collectionUrl = `${base}${collectionPathOf(resource, byId)}`;
	const itemUrl = `${collectionUrl}/{id}`;
	const endpoints = resource.endpoints
		.filter((endpoint) => endpoint.enabled)
		.flatMap((endpoint) => {
			const url = endpoint.path === "/:res" ? collectionUrl : itemUrl;
			return endpoint.method === "PUT"
				? [
						{ method: "PUT", url },
						{ method: "PATCH", url },
					]
				: [{ method: endpoint.method, url }];
		});
	return {
		id: resource._id.toHexString(),
		name: resource.name,
		parentId: resource.parentId?.toHexString() ?? null,
		depth,
		collectionUrl,
		itemUrl,
		endpoints,
	};
}

export const getMockUrls = defineOperation({
	id: "mock.getMockUrls",
	method: "GET",
	path: "/projects/:projectId/mock-urls",
	summary: "Get the REST and MCP URLs of a mock project",
	description: `The public mock API of the project: its base URL, the collection and item URL of every resource (nested resources under their parent's record, e.g. /users/{userId}/posts) with the enabled methods, and the URL of the project's hosted MCP endpoint, which exposes the same data as tools. Also links the project's page in the Localman web app (uiUrl). Anyone who knows these URLs can call them. ${ACCESS_NOTE}`,
	input: z.object({ projectId: projectIdParam }),
	output: z.object({
		projectId: z.string(),
		mockBaseUrl: z.string(),
		mcpUrl: z.string(),
		uiUrl: z.string(),
		resources: z.array(resourceUrls),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"read",
			input.projectId,
		);
		const projectId = project._id.toHexString();
		const base = mockBaseUrlOf(project.secret, project.prefix);
		const resources = await loadResources(project._id);
		const byId = new Map(resources.map((r) => [r._id.toHexString(), r]));
		return {
			projectId,
			mockBaseUrl: base,
			mcpUrl: `${base}/mcp`,
			uiUrl: projectUiUrlOf(projectId),
			resources: orderTree(toTreeNodes(resources)).flatMap(
				({ node, depth }) => {
					const resource = byId.get(node.id);
					return resource ? [urlsOf(resource, depth, base, byId)] : [];
				},
			),
		};
	},
});
