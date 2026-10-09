import { Router } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { createDashboardApp } from "../../../dashboard-server.js";
import { createLogger } from "../../../logger.js";
import {
	clearCollections,
	connectTestMongo,
} from "../../../test-support/test-mongo.js";
import { UserModel } from "../../users/user-model.js";
import { WebPushChannel } from "../channels/web-push-channel.js";
import { setNotificationService } from "../notification-runtime.js";
import { NotificationService } from "../notification-service.js";

const logger = createLogger("silent");
const ORIGIN = "https://localman.test";
export const ALICE = "acc_alice";
export const BOB = "acc_bob";

// Session lookup stubbed: these tests cover the operations, not sign-in.
export const app = createDashboardApp({
	logger,
	allowedOrigins: [ORIGIN],
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

/** Installs a notification service with or without Web Push. */
export function useChannels(webPush: boolean): void {
	setNotificationService(
		new NotificationService({
			logger,
			webPush: webPush
				? new WebPushChannel(
						{
							publicKey: "BPublicKey",
							privateKey: "p",
							subject: "mailto:a@b.c",
						},
						logger,
						async () => ({}),
					)
				: undefined,
		}),
	);
}

/** TEST ONLY. Mongo per file, two users, no optional channel by default. */
export function useOperationsFixture(): void {
	let teardownMongo: (() => Promise<void>) | undefined;
	beforeAll(async () => {
		teardownMongo = await connectTestMongo();
	});
	afterAll(async () => {
		await teardownMongo?.();
	});
	beforeEach(async () => {
		await clearCollections();
		useChannels(false);
		await UserModel.create([
			{ sub: ALICE, username: "alice" },
			{ sub: BOB, username: "bob" },
		]);
	});
}
