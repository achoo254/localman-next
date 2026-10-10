import type { Request } from "express";
import type { StoredResource } from "../resources/resource-model.js";
import { loadResources, parentKeyIn } from "../resources/resource-store.js";
import type { RestEndpointCall } from "./mock-behavior-rest.js";
import type { MockTarget } from "./mock-records.js";
import { enabledEndpoint, endpointKind } from "./render-response.js";
import {
	type MockAddress,
	type MockProject,
	stripPrefix,
} from "./resolve-project.js";
import { matchRoute } from "./route-matcher.js";

interface RouteNodeOf {
	readonly id: string;
	readonly parentId: string | null;
	readonly name: string;
	readonly resource: StoredResource;
}

function routeNodes(resources: readonly StoredResource[]): RouteNodeOf[] {
	return resources.map((resource) => ({
		id: resource._id.toHexString(),
		parentId: resource.parentId?.toHexString() ?? null,
		name: resource.name,
		resource,
	}));
}

/**
 * The endpoint a REST request reaches: the path below the prefix walks the
 * resource tree and the method picks an enabled endpoint. `null` when the
 * path is outside the prefix, matches no resource, or the method has no
 * enabled endpoint there; a hybrid mock sends exactly those upstream.
 */
export async function resolveRestCall(
	req: Request,
	address: MockAddress,
	project: MockProject,
): Promise<RestEndpointCall | null> {
	const segments = stripPrefix(address.segments, project.prefix);
	if (!segments) return null;
	const resources = await loadResources(project.id);
	const steps = matchRoute(routeNodes(resources), segments);
	const last = steps?.at(-1);
	if (!steps || !last) return null;
	const { resource } = last.node;
	const kind = endpointKind(req.method, last.recordId !== null);
	const endpoint = kind ? enabledEndpoint(resource, kind) : null;
	if (!kind || !endpoint) return null;
	const target: MockTarget = {
		projectId: project.id,
		resources,
		resource,
		parentKey: parentKeyIn(resources, resource),
		ancestors: steps
			.slice(0, -1)
			.flatMap((step) =>
				step.recordId === null
					? []
					: [{ resource: step.node.resource, recordId: step.recordId }],
			),
	};
	return { endpoint, kind, target, recordId: last.recordId };
}
