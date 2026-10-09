import { OperationError } from "@localman/operations";
import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";

/**
 * Requests per client IP and minute that the IdP's server-to-server
 * calls (back-channel logout, audit pushes) may make: far above what one
 * IdP sends, low enough that a flood of forged calls is cut short.
 */
export const DEFAULT_SERVER_LIMIT_PER_MINUTE = 600;

/**
 * Caps a route per client IP and minute (`trust proxy` makes that the
 * real client behind nginx), answering 429 `RATE_LIMITED` in JSON.
 */
export function ipRateLimit(limitPerMinute: number): RequestHandler {
	return rateLimit({
		windowMs: 60_000,
		limit: limitPerMinute,
		standardHeaders: "draft-8",
		legacyHeaders: false,
		handler: (_req, res) => {
			res
				.status(429)
				.json(
					new OperationError(
						429,
						"RATE_LIMITED",
						"Too many requests, slow down",
					).toBody(),
				);
		},
	});
}
