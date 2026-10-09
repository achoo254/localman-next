import type { Express } from "express";
import type { TrustProxy } from "./config/trust-proxy.js";
import { createBaseApp } from "./http/create-base-app.js";
import type { Logger } from "./logger.js";
import {
	addressOf,
	mockCors,
	mockRouteOf,
	readAddress,
} from "./modules/mock-runtime/mock-http.js";
import { createMockRouter } from "./modules/mock-runtime/mock-router.js";
import {
	MockLimiters,
	type MockRateLimits,
	mockRateLimit,
} from "./modules/mock-runtime/rate-limit.js";
import type { UsageMeter } from "./modules/mock-runtime/usage-meter.js";

export const DEFAULT_MOCK_RATE_LIMITS: MockRateLimits = Object.freeze({
	perSecret: 60,
	perIp: 30,
	writesPerSecret: 10,
	responseBytesPerSecret: 20 * 1024 * 1024,
});

export interface MockAppOptions {
	readonly logger: Logger;
	/** Counts requests against the owners' monthly quota (started by main). */
	readonly usageMeter: UsageMeter;
	/** Express `trust proxy` (TRUST_PROXY): the client IP of the IP limit. */
	readonly trustProxy?: TrustProxy;
	readonly rateLimits?: MockRateLimits;
}

/**
 * Public mock runtime (port 4100) on `{secret}.{MOCK_BASE_DOMAIN}` and
 * `/m/{secret}`. Order: request id and log line (secret masked), CORS
 * (preflights end here), project address, rate limits (before the body
 * is read), JSON body ≤ 100 KB, then the mock router; requests without
 * a project address fall through to `/healthz` and the 404. Helmet lets
 * other origins embed responses (`Cross-Origin-Resource-Policy:
 * cross-origin`), as a public API must.
 * Building the app never opens a socket.
 */
export function createMockApp(options: MockAppOptions): Express {
	const limiters = new MockLimiters(
		options.rateLimits ?? DEFAULT_MOCK_RATE_LIMITS,
	);
	return createBaseApp({
		logger: options.logger,
		trustProxy: options.trustProxy ?? false,
		helmet: { crossOriginResourcePolicy: { policy: "cross-origin" } },
		describeRoute: mockRouteOf,
		beforeBody: [mockCors, readAddress, mockRateLimit(limiters, addressOf)],
		mountRoutes: (app) => {
			app.use(
				createMockRouter({
					logger: options.logger,
					meter: options.usageMeter,
					limiters,
				}),
			);
		},
	});
}
