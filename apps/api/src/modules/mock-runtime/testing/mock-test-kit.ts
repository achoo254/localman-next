import type { Express } from "express";
import request from "supertest";
import { type Mock, afterEach, beforeEach, expect, vi } from "vitest";
import type { RuntimeSettings } from "../../../config/runtime-settings.js";
import { createLogger } from "../../../logger.js";
import { createMockApp } from "../../../mock-server.js";
import {
	as,
	useDashboardTestDb,
} from "../../../test-support/dashboard-test-app.js";
import { UserModel } from "../../users/user-model.js";
import type { QuotaWarning } from "../quota-warnings.js";
import type { MockRateLimits } from "../rate-limit.js";
import { requestLog } from "../request-log-service.js";
import { clearMockProjectCache } from "../resolve-project.js";
import type { UpstreamDeps } from "../upstream-proxy.js";
import { UsageMeter } from "../usage-meter.js";

/** TEST ONLY. Base domain of mock hosts in tests. */
export const MOCK_DOMAIN = "localman.test";
export const OWNER = "acc_mock_owner";
/** Limits no ordinary test reaches. */
const RELAXED: MockRateLimits = {
	perSecret: 100_000,
	perIp: 100_000,
	writesPerSecret: 100_000,
	responseBytesPerSecret: Number.MAX_SAFE_INTEGER,
};

type Method = "get" | "post" | "put" | "patch" | "delete" | "head";

export interface MockClient {
	readonly app: Express;
	call(method: Method, path: string, body?: unknown): request.Test;
	get(path: string): request.Test;
}

export interface ClientOptions {
	/** Client address sent as X-Forwarded-For (loopback is trusted). */
	readonly ip?: string;
	/** A dedicated app with these limits, the rest relaxed (fresh counters). */
	readonly limits?: Partial<MockRateLimits>;
}

export interface MockTestKit {
	readonly warn: Mock<(owner: string, warning: QuotaWarning) => Promise<void>>;
	meter(): UsageMeter;
	/** Requests on `{secret}.localman.test`. */
	client(secret: string, options?: ClientOptions): MockClient;
}

export interface MockTestKitOptions {
	/** Upstream forwarding of the apps (fresh per test); runtime defaults otherwise. */
	readonly upstream?: () => UpstreamDeps;
	/** Runtime settings on top of the test mock domain. */
	readonly settings?: () => Partial<RuntimeSettings>;
}

/**
 * TEST ONLY. Mongo per file (dashboard settings with the test domain),
 * an owner user, an empty project cache and a fresh usage meter (never
 * started: tests flush it) before each test. The shared request log is
 * flushed after each test, so no line leaks into the next one.
 */
export function useMockTestKit(options: MockTestKitOptions = {}): MockTestKit {
	useDashboardTestDb(() => ({
		mockBaseDomain: MOCK_DOMAIN,
		...options.settings?.(),
	}));
	const logger = createLogger("silent");
	const warn = vi.fn(async (_owner: string, _warning: QuotaWarning) => {});
	let meter = new UsageMeter({ logger, warn });
	const build = (limits: MockRateLimits) =>
		createMockApp({
			logger,
			usageMeter: meter,
			trustProxy: "loopback",
			rateLimits: limits,
			...(options.upstream ? { upstream: options.upstream() } : {}),
		});
	let shared = build(RELAXED);
	beforeEach(async () => {
		clearMockProjectCache();
		warn.mockClear();
		meter = new UsageMeter({ logger, warn });
		shared = build(RELAXED);
		await UserModel.create({ sub: OWNER, username: "owner" });
	});
	afterEach(() => requestLog.flush());
	return {
		warn,
		meter: () => meter,
		client: (secret, { ip = "203.0.113.7", limits } = {}) => {
			const app = limits ? build({ ...RELAXED, ...limits }) : shared;
			const call = (method: Method, path: string, body?: unknown) => {
				const test = request(app)
					[method](path)
					.set("host", `${secret}.${MOCK_DOMAIN}`)
					.set("x-forwarded-for", ip);
				return body === undefined ? test : test.send(body as object);
			};
			return { app, call, get: (path) => call("get", path) };
		},
	};
}

/** TEST ONLY. A project of `OWNER` (prefix optional); its id and secret. */
export async function createMockProject(
	prefix = "",
): Promise<{ id: string; secret: string }> {
	const created = await as(OWNER).send("post", "/projects", {
		name: "Mock",
		prefix,
	});
	expect(created.status, JSON.stringify(created.body)).toBe(201);
	return { id: created.body.id, secret: created.body.secret };
}
