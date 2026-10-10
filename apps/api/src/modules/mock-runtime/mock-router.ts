import { OperationError } from "@localman/operations";
import { limitsFor } from "@localman/shared";
import type { Request, RequestHandler, Response } from "express";
import { requestIdOf } from "../../http/request-log.js";
import type { Logger } from "../../logger.js";
import { effectivePlan } from "../billing/plan-guard.js";
import { isInboxAddress, serveInbox } from "../webhook-inbox/inbox-route.js";
import { answeredByBehavior } from "./mock-behavior-rest.js";
import { runEndpoint } from "./mock-endpoints.js";
import { addressOf, maskSecret } from "./mock-http.js";
import { resolveRestCall } from "./mock-route-call.js";
import { type MockLimiters, owesWrite, tooManyRequests } from "./rate-limit.js";
import { renderResponse, usesCount } from "./render-response.js";
import { setLogSource, trackRequestLog } from "./request-log-capture.js";
import type { RequestLogService } from "./request-log-service.js";
import {
	type MockAddress,
	type MockProject,
	resolveProject,
} from "./resolve-project.js";
import { SOURCE_HEADER, UPSTREAM_HOP_HEADER } from "./upstream-headers.js";
import { type UpstreamDeps, serveFromUpstream } from "./upstream-proxy.js";
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

/** What the router needs besides the request. */
export interface MockRouterDeps {
	readonly logger: Logger;
	readonly meter: UsageMeter;
	/** Charged with the bytes of every response body or of the scan behind it. */
	readonly limiters: MockLimiters;
	/** Hybrid mock forwarding of unmatched requests. */
	readonly upstream: UpstreamDeps;
	/** Every admitted request is logged here. */
	readonly requestLog: RequestLogService;
}

async function serve(
	req: Request,
	res: Response,
	address: MockAddress,
	{ meter, limiters, upstream, requestLog }: MockRouterDeps,
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
	// Upstream requests count too: they cost the server's bandwidth.
	if (!(await admitMonthly(meter, project))) {
		res.status(429).json(monthlyQuotaExceeded().toBody());
		return;
	}
	trackRequestLog(req, res, project, address, requestLog);
	// `/_inbox/<name>` is the webhook inbox, before resources and upstream.
	if (isInboxAddress(address)) return serveInbox(req, res, project, address);
	const charge = (bytes: number) =>
		limiters.chargeResponse(address.secret, bytes);

	const call = await resolveRestCall(req, address, project);
	if (!call) {
		if (project.upstream.kind !== "none") {
			return serveFromUpstream(req, res, project, address, upstream, charge);
		}
		res.setHeader(SOURCE_HEADER, "mock");
		return notFound(res);
	}
	res.setHeader(SOURCE_HEADER, "mock");
	// Rules and chaos answer as `rule`; set before they may send.
	setLogSource(res, "rule");
	if (await answeredByBehavior(req, res, call, charge)) return;
	setLogSource(res, "mock");
	const { endpoint, kind, target, recordId } = call;
	const hop = req.headers[UPSTREAM_HOP_HEADER.toLowerCase()] !== undefined;
	const result = await runEndpoint(
		kind,
		target,
		recordId,
		{ query: req.query, body: req.body, hop },
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
