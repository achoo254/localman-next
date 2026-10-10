import express, { type Express, type RequestHandler } from "express";
import type { TrustProxy } from "./config/trust-proxy.js";
import { JSON_BODY_LIMIT, createBaseApp } from "./http/create-base-app.js";
import type { Logger } from "./logger.js";
import type { McpHandlerRegistry } from "./modules/mcp/mcp-handler-registry.js";
import { createMockMcpRouter } from "./modules/mcp/mock-mcp-server.js";
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
import { rememberRawBody } from "./modules/mock-runtime/request-log-capture.js";
import {
	type RequestLogService,
	requestLog,
} from "./modules/mock-runtime/request-log-service.js";
import {
	type UpstreamDeps,
	createUpstreamDeps,
} from "./modules/mock-runtime/upstream-proxy.js";
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
	/** Hosted Mock MCP handlers, closed by main at shutdown. */
	readonly mcpHandlers?: McpHandlerRegistry;
	/** Hybrid mock forwarding; the runtime SSRF guard and owner tunnels by default. */
	readonly upstream?: UpstreamDeps;
	/** Request log; the process's shared `requestLog` by default. */
	readonly requestLog?: RequestLogService;
}

/**
 * Policy of every mock runtime response (mock, rule, upstream, inbox,
 * errors): the body is data, never a document. `sandbox` gives any HTML
 * an opaque origin (no script, no cookies of `/m/`'s dashboard origin),
 * `default-src 'none'` loads nothing, `frame-ancestors 'none'` refuses
 * framing. nginx sends the same value on `/m/` as a second layer.
 */
export const MOCK_CONTENT_SECURITY_POLICY =
	"sandbox; default-src 'none'; frame-ancestors 'none'";

/** Set before anything answers, so preflights and errors carry it too. */
const mockSecurityHeaders: RequestHandler = (_req, res, next) => {
	res.setHeader("Content-Security-Policy", MOCK_CONTENT_SECURITY_POLICY);
	res.setHeader("X-Content-Type-Options", "nosniff");
	next();
};

/**
 * The runtime's JSON parser (same limit as the base app's, which then
 * skips the parsed body) that also keeps the raw bytes: the request log
 * and an upstream see exactly what the client sent.
 */
const jsonKeepingRaw = express.json({
	limit: JSON_BODY_LIMIT,
	verify: (req, _res, buf) => rememberRawBody(req, Buffer.from(buf)),
});

/**
 * Public mock runtime (port 4100) on `{secret}.{MOCK_BASE_DOMAIN}` and
 * `/m/{secret}`. Order: request id and log line (secret masked), CORS
 * (preflights end here), project address, rate limits (before the body
 * is read), JSON body ≤ 100 KB (raw bytes kept), then the project's MCP
 * endpoint (`{prefix}/mcp`) and the mock router (resources, else the
 * project's upstream; every admitted request logged); requests without
 * a project address fall through to `/healthz` and the 404. Helmet lets
 * other origins embed responses (`Cross-Origin-Resource-Policy:
 * cross-origin`), as a public API must; its CSP is replaced by
 * `MOCK_CONTENT_SECURITY_POLICY` (one CSP header, never two).
 * Building the app never opens a socket.
 */
export function createMockApp(options: MockAppOptions): Express {
	const limiters = new MockLimiters(
		options.rateLimits ?? DEFAULT_MOCK_RATE_LIMITS,
	);
	return createBaseApp({
		logger: options.logger,
		trustProxy: options.trustProxy ?? false,
		helmet: {
			contentSecurityPolicy: false,
			crossOriginResourcePolicy: { policy: "cross-origin" },
			xFrameOptions: { action: "deny" },
		},
		describeRoute: mockRouteOf,
		beforeBody: [
			mockSecurityHeaders,
			mockCors,
			readAddress,
			mockRateLimit(limiters, addressOf),
			jsonKeepingRaw,
		],
		mountRoutes: (app) => {
			const deps = {
				logger: options.logger,
				meter: options.usageMeter,
				limiters,
			};
			// `{prefix}/mcp` (Hosted Mock MCP) before the REST catch-all.
			app.use(createMockMcpRouter({ ...deps, handlers: options.mcpHandlers }));
			app.use(
				createMockRouter({
					...deps,
					upstream: options.upstream ?? createUpstreamDeps(),
					requestLog: options.requestLog ?? requestLog,
				}),
			);
		},
	});
}
