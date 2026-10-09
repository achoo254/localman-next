import type { ResourceEndpoint } from "@localman/shared";
import type { Request, Response } from "express";
import { type BehaviorResult, runEndpointBehavior } from "./mock-behavior.js";
import type { MockTarget } from "./mock-records.js";
import { tooManyRequests } from "./rate-limit.js";
import type { EndpointKind } from "./render-response.js";

/** A signal that aborts when the response closes (client gone or sent). */
export function closeSignal(res: Response): AbortSignal {
	const controller = new AbortController();
	res.once("close", () => controller.abort());
	return controller.signal;
}

/**
 * Sends what rules or chaos decided over REST; `false` when the endpoint
 * runs as usual. `charge` takes the bytes of a rule response.
 */
export function sendBehavior(
	res: Response,
	result: BehaviorResult,
	charge: (bytes: number) => void,
): boolean {
	switch (result.kind) {
		case "proceed":
			return false;
		case "aborted":
			return true;
		case "fault":
			if (result.retryAfterSeconds !== null) {
				tooManyRequests(res, result.retryAfterSeconds);
			} else {
				res.status(result.error.status).json(result.error.toBody());
			}
			return true;
		case "respond":
			charge(result.bytes);
			for (const header of result.headers)
				res.setHeader(header.name, header.value);
			res.status(result.status).json(result.body);
			return true;
	}
}

/** Where a REST request is going once its endpoint is known. */
export interface RestEndpointCall {
	readonly endpoint: ResourceEndpoint;
	readonly kind: EndpointKind;
	readonly target: MockTarget;
	readonly recordId: string | null;
}

/**
 * Runs the endpoint's rules and chaos for a REST request and sends their
 * answer; `false` when the endpoint should run its CRUD as usual.
 */
export async function answeredByBehavior(
	req: Request,
	res: Response,
	{ endpoint, kind, target, recordId }: RestEndpointCall,
	charge: (bytes: number) => void,
): Promise<boolean> {
	const result = await runEndpointBehavior(endpoint, kind, target, recordId, {
		headers: req.headers,
		query: req.query,
		body: req.body,
		signal: closeSignal(res),
	});
	return sendBehavior(res, result, charge);
}
