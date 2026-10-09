import {
	type ApiRequestDraft,
	createRequestDraft,
} from "@localman/shared/api-client";
import { Router } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { createDashboardApp } from "../../../dashboard-server.js";
import { createLogger } from "../../../logger.js";
import {
	clearCollections,
	connectTestMongo,
} from "../../../test-support/test-mongo.js";
import { clientStoreOperations } from "../client-store-operations.js";

const ORIGIN = "https://localman.test";
export const ALICE = "acc_alice";
export const BOB = "acc_bob";

/**
 * TEST ONLY. The dashboard app with just the client-store operations (they
 * join the registry later) and the session lookup stubbed by `x-test-sub`.
 */
const app = createDashboardApp({
	logger: createLogger("silent"),
	allowedOrigins: [ORIGIN],
	operations: clientStoreOperations,
	auth: {
		router: Router(),
		csrfExempt: [],
		authenticate: async (req) => {
			const sub = req.headers["x-test-sub"];
			return typeof sub === "string" ? { id: `session-${sub}`, sub } : null;
		},
	},
});

/** Requests as a signed-in user; mutations carry the allowed Origin. */
export const as = (sub: string) => ({
	get: (path: string) =>
		request(app).get(`/api/v1${path}`).set("x-test-sub", sub),
	send: (method: "post" | "put" | "delete", path: string, body: object = {}) =>
		request(app)
			[method](`/api/v1${path}`)
			.set("x-test-sub", sub)
			.set("origin", ORIGIN)
			.send(body),
});

/** A request holding a `{{token}}` placeholder in auth, header and URL. */
export function draftWithSecretVar(
	overrides: Partial<ApiRequestDraft> = {},
): ApiRequestDraft {
	return createRequestDraft({
		name: "List users",
		method: "GET",
		url: "https://api.example.com/users?key={{token}}",
		headers: [
			{ id: "h1", key: "X-Api-Key", value: "{{token}}", enabled: true },
		],
		auth: { type: "bearer", token: "{{token}}" },
		...overrides,
	});
}

/** TEST ONLY. Mongo per file, emptied before each test. */
export function useClientStoreDb(): void {
	let teardown: (() => Promise<void>) | undefined;
	beforeAll(async () => {
		teardown = await connectTestMongo();
	});
	afterAll(async () => {
		await teardown?.();
	});
	beforeEach(async () => {
		await clearCollections();
	});
}
