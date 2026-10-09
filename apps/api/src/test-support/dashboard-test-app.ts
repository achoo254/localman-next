import { Router } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	type RuntimeSettings,
	configureRuntime,
} from "../config/runtime-settings.js";
import { createDashboardApp } from "../dashboard-server.js";
import { createLogger } from "../logger.js";
import { clearKnownSubjects } from "../modules/mcp/localman-mcp-limits.js";
import { clearCollections, connectTestMongo } from "./test-mongo.js";

const ORIGIN = "https://localman.test";

/**
 * TEST ONLY. The real dashboard app with the session lookup stubbed by an
 * `x-test-sub` header, and loopback trusted so `x-forwarded-for` sets the
 * client IP seen by operations.
 */
export const testApp = createDashboardApp({
	logger: createLogger("silent"),
	allowedOrigins: [ORIGIN],
	trustProxy: "loopback",
	auth: {
		router: Router(),
		csrfExempt: [],
		authenticate: async (req) => {
			const sub = req.headers["x-test-sub"];
			return typeof sub === "string" ? { id: `session-${sub}`, sub } : null;
		},
	},
});

type Method = "post" | "put" | "delete";

export interface TestCaller {
	get(path: string): request.Test;
	send(method: Method, path: string, body?: object): request.Test;
}

function caller(sub: string | null, ip: string): TestCaller {
	const withIdentity = (test: request.Test): request.Test => {
		test.set("x-forwarded-for", ip);
		return sub === null ? test : test.set("x-test-sub", sub);
	};
	return {
		get: (path) => withIdentity(request(testApp).get(`/api/v1${path}`)),
		send: (method, path, body = {}) =>
			withIdentity(
				request(testApp)[method](`/api/v1${path}`).set("origin", ORIGIN),
			).send(body),
	};
}

/** Requests as a signed-in user (mutations carry the allowed Origin). */
export const as = (sub: string, ip = "198.51.100.1"): TestCaller =>
	caller(sub, ip);

/** Requests without a session. */
export const guest = (ip = "198.51.100.2"): TestCaller => caller(null, ip);

/**
 * TEST ONLY. Mongo per file, emptied before each test, and runtime
 * settings reset to the defaults merged with `settings`.
 */
export function useDashboardTestDb(
	settings: () => Partial<RuntimeSettings> = () => ({}),
): void {
	let teardown: (() => Promise<void>) | undefined;
	beforeAll(async () => {
		teardown = await connectTestMongo();
	});
	afterAll(async () => {
		configureRuntime(DEFAULT_RUNTIME_SETTINGS);
		await teardown?.();
	});
	beforeEach(async () => {
		await clearCollections();
		// The users collection was emptied: forget the users known to exist.
		clearKnownSubjects();
		configureRuntime({ ...DEFAULT_RUNTIME_SETTINGS, ...settings() });
	});
}
