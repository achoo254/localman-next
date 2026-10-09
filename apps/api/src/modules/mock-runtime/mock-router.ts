import { OperationError } from "@localman/operations";
import { limitsFor } from "@localman/shared";
import type { Request, RequestHandler, Response } from "express";
import type { Logger } from "../../logger.js";
import { effectivePlan } from "../billing/plan-guard.js";
import type { StoredResource } from "../resources/resource-model.js";
import { loadResources, parentKeyIn } from "../resources/resource-store.js";
import { runEndpoint } from "./mock-endpoints.js";
import { addressOf, maskSecret, requestIdOf } from "./mock-http.js";
import type { MockTarget } from "./mock-records.js";
import type { MockLimiters } from "./rate-limit.js";
import {
	enabledEndpoint,
	endpointKind,
	renderResponse,
	usesCount,
} from "./render-response.js";
import {
	type MockAddress,
	resolveProject,
	stripPrefix,
} from "./resolve-project.js";
import { matchRoute } from "./route-matcher.js";
import type { UsageMeter } from "./usage-meter.js";

/** The source answers unknown routes and records with this JSON string. */
const NOT_FOUND_BODY = "Not found";

function notFound(res: Response): void {
	res.status(404).json(NOT_FOUND_BODY);
}

function quotaExceeded(res: Response): void {
	res
		.status(429)
		.json(
			new OperationError(
				429,
				"MONTHLY_QUOTA_EXCEEDED",
				"The project owner's monthly mock request quota is used up",
			).toBody(),
		);
}

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

/** What the router needs besides the request. */
export interface MockRouterDeps {
	readonly logger: Logger;
	readonly meter: UsageMeter;
	/** Charged with the bytes of every response body. */
	readonly limiters: MockLimiters;
}

async function serve(
	req: Request,
	res: Response,
	address: MockAddress,
	{ meter, limiters }: MockRouterDeps,
): Promise<void> {
	const project = await resolveProject(address.secret);
	if (!project) return notFound(res);
	const limit = limitsFor(
		effectivePlan(project.ownerPlan),
	).mockRequestsPerMonth;
	if (!(await meter.admit(project.owner, limit))) return quotaExceeded(res);

	const segments = stripPrefix(address.segments, project.prefix);
	const resources = segments ? await loadResources(project.id) : [];
	const steps = segments ? matchRoute(routeNodes(resources), segments) : null;
	const last = steps?.at(-1);
	if (!steps || !last) return notFound(res);
	const { resource } = last.node;
	const kind = endpointKind(req.method, last.recordId !== null);
	const endpoint = kind ? enabledEndpoint(resource, kind) : null;
	if (!kind || !endpoint) return notFound(res);

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
	const result = await runEndpoint(
		kind,
		target,
		last.recordId,
		req,
		usesCount(endpoint.response),
	);
	if (result.data === null) return notFound(res);
	const rendered = renderResponse(endpoint.response, result.data, result.count);
	limiters.chargeResponse(address.secret, rendered.bytes);
	res.status(result.status).json(rendered.body);
}

/**
 * Catch-all of the mock runtime: resolves the project (Host or
 * `/m/:secret`), admits the request against the owner's monthly quota,
 * strips the prefix, walks the resource tree and runs the endpoint.
 * Requests that address no project pass on (`/healthz`, 404). Client
 * errors keep their status; anything else is logged without the path
 * (it may hold the secret) and answers 500 without details.
 */
export function createMockRouter(deps: MockRouterDeps): RequestHandler {
	return (req, res, next) => {
		const address = addressOf(req);
		if (!address) {
			next();
			return;
		}
		serve(req, res, address, deps).catch((error: unknown) => {
			if (error instanceof OperationError) {
				next(error);
				return;
			}
			deps.logger.error(
				{
					err: error,
					method: req.method,
					secret: maskSecret(address.secret),
					requestId: requestIdOf(res),
				},
				"Mock request failed",
			);
			if (res.headersSent) return;
			res
				.status(500)
				.json(
					new OperationError(
						500,
						"INTERNAL_ERROR",
						"Internal server error",
					).toBody(),
				);
		});
	};
}
