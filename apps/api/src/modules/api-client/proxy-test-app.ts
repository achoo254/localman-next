import type { Express } from "express";
import { Router } from "express";
import request from "supertest";
import { createDashboardApp } from "../../dashboard-server.js";
import { type Logger, createLogger } from "../../logger.js";
import type { ProxyConcurrency } from "./proxy-concurrency.js";
import { createProxyOperations } from "./proxy-operations.js";
import { testGuard } from "./proxy-test-server.js";
import type { SsrfGuard } from "./ssrf-guard.js";

const ORIGIN = "https://localman.test";
export const PROXY_TEST_USER = "acc_proxy";

export interface ProxyTestAppOptions {
	readonly guard?: SsrfGuard;
	/** Express `trust proxy`; off by default, so `X-Forwarded-For` is ignored. */
	readonly trustProxy?: string | false;
	readonly logger?: Logger;
	readonly concurrency?: ProxyConcurrency;
}

/**
 * TEST ONLY. The real dashboard app serving the proxy operation alone,
 * signed in by an `x-test-sub` header, with the test guard by default.
 */
export function proxyTestApp(options: ProxyTestAppOptions = {}): Express {
	const logger = options.logger ?? createLogger("silent");
	return createDashboardApp({
		logger: createLogger("silent"),
		allowedOrigins: [ORIGIN],
		trustProxy: options.trustProxy ?? false,
		operations: createProxyOperations({
			guard: options.guard ?? testGuard(),
			logger: () => logger,
			...(options.concurrency ? { concurrency: options.concurrency } : {}),
		}),
		auth: {
			router: Router(),
			csrfExempt: [],
			authenticate: async (req) => {
				const sub = req.headers["x-test-sub"];
				return typeof sub === "string" ? { id: `session-${sub}`, sub } : null;
			},
		},
	});
}

export const PROXY_TEST_ORIGIN = ORIGIN;

/** `POST /api/v1/proxy` with the allowed Origin, as `sub` (`null`: guest). */
export function postProxy(
	app: Express,
	body: object,
	sub: string | null = PROXY_TEST_USER,
): request.Test {
	const test = request(app).post("/api/v1/proxy").set("origin", ORIGIN);
	return (sub === null ? test : test.set("x-test-sub", sub)).send(body);
}
