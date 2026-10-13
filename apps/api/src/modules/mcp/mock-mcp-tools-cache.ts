import { createHash } from "node:crypto";
import type { ResourceEndpoint } from "@localman/shared";
import { tenantKey } from "../../tenancy/tenant-context.js";
import { TtlLruCache } from "../mock-runtime/ttl-lru-cache.js";
import type { StoredResource } from "../resources/resource-model.js";
import {
	type MockToolDefinition,
	type MockToolResource,
	buildMockTools,
} from "./mock-tool-factory.js";

/** A stored resource as the tool factory and the OpenAPI builder read it. */
export interface MockApiResource extends MockToolResource {
	readonly endpoints: readonly ResourceEndpoint[];
}

export function toMockApiResource(resource: StoredResource): MockApiResource {
	return {
		id: resource._id.toHexString(),
		parentId: resource.parentId?.toHexString() ?? null,
		name: resource.name,
		...(resource.parentKey !== undefined
			? { parentKey: resource.parentKey }
			: {}),
		schema: resource.schema,
		template: resource.template,
		endpoints: resource.endpoints,
	};
}

/**
 * Revision of what the tools are built from: the tree, Parent IDs, schemas,
 * templates and which endpoints are on. Records, counters and custom
 * responses do not change the tools, so mock traffic keeps the entry.
 */
export function toolsRevision(resources: readonly MockApiResource[]): string {
	const shape = resources.map((resource) => [
		resource.id,
		resource.parentId,
		resource.name,
		resource.parentKey ?? null,
		resource.schema,
		resource.template,
		resource.endpoints.map((e) => [e.method, e.path, e.enabled]),
	]);
	return createHash("sha256").update(JSON.stringify(shape)).digest("base64url");
}

interface CachedTools {
	readonly projectId: string;
	readonly revision: string;
	readonly tools: readonly MockToolDefinition[];
}

/**
 * Tools per project secret. Every MCP request loads the resources anyway
 * (one query, like a REST request), so an entry is checked against the
 * current revision and project and rebuilt when the tree changed; a
 * secret that no longer resolves is dropped (`forgetMockTools`).
 */
const cache = new TtlLruCache<CachedTools>(1_000, 10 * 60_000);

/** The project's tools, from the cache when its tree is unchanged. */
export function mockToolsFor(
	secret: string,
	projectId: string,
	resources: readonly MockApiResource[],
): readonly MockToolDefinition[] {
	const revision = toolsRevision(resources);
	const hit = cache.get(tenantKey(secret));
	if (hit?.projectId === projectId && hit.revision === revision) {
		return hit.tools;
	}
	const tools = buildMockTools(resources);
	cache.set(tenantKey(secret), { projectId, revision, tools });
	return tools;
}

/** Drops the tools of a secret that was rotated or whose project is gone. */
export function forgetMockTools(secret: string): void {
	cache.delete(tenantKey(secret));
}

/** TEST ONLY. */
export function clearMockToolsCache(): void {
	cache.clear();
}
