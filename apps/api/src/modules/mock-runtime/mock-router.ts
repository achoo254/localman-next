import { OperationError } from "@localman/operations";
import { limitsFor } from "@localman/shared";
import type { Request, RequestHandler, Response } from "express";
import { requestIdOf } from "../../http/request-log.js";
import type { Logger } from "../../logger.js";
import { effectivePlan } from "../billing/plan-guard.js";
import type { StoredResource } from "../resources/resource-model.js";
import { loadResources, parentKeyIn } from "../resources/resource-store.js";
import { answeredByBehavior } from "./mock-behavior-rest.js";
import { runEndpoint } from "./mock-endpoints.js";
import { addressOf, maskSecret } from "./mock-http.js";
import type { MockTarget } from "./mock-records.js";
import { type MockLimiters, owesWrite, tooManyRequests } from "./rate-limit.js";
import {
	enabledEndpoint,
	endpointKind,
	renderResponse,
	usesCount,
} from "./render-response.js";
import {
	type MockAddress,
	type MockProject,
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

export function monthlyQuotaExceeded(): OperationError {
	return new OperationError(
		429,
		"MONTHLY_QUOTA_EXCEEDED",
		"The project owner's monthly mock request quota is used up",
	);
}

/**
 * Counts one request (REST call or MCP tool call) against the owner's
 * monthly quota and the project's activity; false once it is used up.
 */
export function admitMonthly(
	meter: UsageMeter,
	project: MockProject,
): Promise<boolean> {
	const limit = limitsFor(
		effectivePlan(project.ownerPlan),
	).mockRequestsPerMonth;
	return meter.admit(project.owner, limit, project.id.toHexString());
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
	/** Charged with the bytes of every response body or of the scan behind it. */
	readonly limiters: MockLimiters;
}

async function serve(
	req: Request,
	res: Response,
	address: MockAddress,
	{ meter, limiters }: MockRouterDeps,
): Promise<void> {
	if (owesWrite(req.method, address)) {
		const write = limiters.admitWrite(address.secret);
		if (!write.ok) return tooManyRequests(res, write.retryAfterSeconds);
	}
	const project = await resolveProject(address.secret);
	if (!project) return notFound(res);
	const projectId = project.id.toHexString();
	// Read by the request log line.
	res.locals.projectId = projectId;
	if (!(await admitMonthly(meter, project))) {
		res.status(429).json(monthlyQuotaExceeded().toBody());
		return;
	}

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
	const call = { endpoint, kind, target, recordId: last.recordId };
	const charge = (bytes: number) =>
		limiters.chargeResponse(address.secret, bytes);
	if (await answeredByBehavior(req, res, call, charge)) return;
	const result = await runEndpoint(
		kind,
		target,
		last.recordId,
		req,
		usesCount(endpoint.response),
	);
	if (result.data === null) return notFound(res);
	const rendered = renderResponse(endpoint.response, result.data, result.count);
	// A scan costs its reads even when little of it is sent.
	limiters.chargeResponse(
		address.secret,
		Math.max(rendered.bytes, result.readBytes),
	);
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
