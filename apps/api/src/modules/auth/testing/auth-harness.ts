import { randomBytes } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import request, { type Response } from "supertest";
import { createDashboardApp } from "../../../dashboard-server.js";
import { createLogger } from "../../../logger.js";
import { WebPushChannel } from "../../notifications/channels/web-push-channel.js";
import { setNotificationService } from "../../notifications/notification-runtime.js";
import { NotificationService } from "../../notifications/notification-service.js";
import { type AuthModule, createAuthModule } from "../auth-module.js";
import { type FakeAccount, type FakeIdp, startFakeIdp } from "./fake-idp.js";
import { TestBrowser } from "./test-browser.js";

/** https, so the production cookie names and flags are exercised. */
export const PUBLIC_URL = "https://localman.test";
export const SESSION_COOKIE = "__Host-lm_session";
export const LOGIN_COOKIE = "__Host-lm_login";
/** Basic credentials the fake IdP would use for audit pushes. */
export const AUDIT_CREDENTIALS = {
	clientId: "hoandat-auth",
	clientSecret: randomBytes(32).toString("base64"),
};

export interface SignIn {
	/** `name=value` of the session cookie, ready for a Cookie header. */
	readonly cookie: string;
	readonly callback: Response;
	/** Holds the IdP session cookie (for logging out at the IdP). */
	readonly browser: TestBrowser;
}

export interface AuthHarness {
	readonly app: Express;
	readonly auth: AuthModule;
	readonly idp: FakeIdp;
	readonly issuer: string;
	readonly account: FakeAccount;
	signIn(query?: Record<string, string>): Promise<SignIn>;
	close(): Promise<void>;
}

function listen(server: Server): Promise<number> {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			resolve((server.address() as AddressInfo).port);
		});
	});
}

function close(server: Server): Promise<void> {
	server.closeAllConnections();
	return new Promise((resolve) => server.close(() => resolve()));
}

/** Every `Set-Cookie` header of a response. */
export function setCookies(res: Response): string[] {
	const header: unknown = res.headers["set-cookie"];
	if (Array.isArray(header)) {
		return header.filter((c): c is string => typeof c === "string");
	}
	return typeof header === "string" ? [header] : [];
}

/** `name=value` of a cookie set by `res`, or `undefined`. */
export function cookieFrom(res: Response, name: string): string | undefined {
	const found = setCookies(res).find((c) => c.startsWith(`${name}=`));
	const pair = found?.split(";")[0];
	return pair && pair !== `${name}=` ? pair : undefined;
}

/**
 * TEST ONLY. A fake IdP and the dashboard app wired together over real
 * sockets: the IdP must reach the app for back-channel logout. MongoDB
 * must already be connected (see test-support/test-mongo.ts).
 */
export async function startAuthHarness(): Promise<AuthHarness> {
	const logger = createLogger("silent");
	const clientSecret = randomBytes(24).toString("base64url");
	const idpServer = createServer();
	const issuer = `http://127.0.0.1:${await listen(idpServer)}`;

	const auth = createAuthModule(
		{
			issuer,
			clientId: "localman-web",
			clientSecret,
			publicUrl: PUBLIC_URL,
			sessionEncryptionKey: `k1:${randomBytes(32).toString("base64")}`,
			// Tests sign in far more often than a person would.
			loginLimitPerMinute: 10_000,
			audit: AUDIT_CREDENTIALS,
		},
		logger,
	);
	// Web Push on (sender stubbed) so push devices can be registered.
	setNotificationService(
		new NotificationService({
			logger,
			webPush: new WebPushChannel(
				{ publicKey: "BTestKey", privateKey: "p", subject: "mailto:t@e.st" },
				logger,
				async () => ({}),
			),
		}),
	);
	const app = createDashboardApp({
		logger,
		allowedOrigins: [PUBLIC_URL],
		auth,
	});
	const appServer = createServer(app);
	const appPort = await listen(appServer);

	const account: FakeAccount = {
		sub: "acc_test_1",
		username: "hoandat",
		email: "hoandat@example.com",
		name: "Hoan Dat",
	};
	const idp = await startFakeIdp({
		server: idpServer,
		issuer,
		clientSecret,
		localmanPublicUrl: PUBLIC_URL,
		backchannelLogoutUri: `http://127.0.0.1:${appPort}/auth/backchannel-logout`,
		account,
	});

	return {
		app,
		auth,
		idp,
		issuer,
		account,
		async signIn(query = {}) {
			const browser = new TestBrowser();
			const start = await request(app).get("/auth/login").query(query);
			if (start.status !== 303) throw new Error(`login: ${start.status}`);
			const { stoppedAt } = await browser.navigate(
				start.headers.location,
				`${PUBLIC_URL}/auth/callback`,
			);
			if (!stoppedAt) throw new Error("the IdP did not return to Localman");
			const callback = await request(app)
				.get(`${stoppedAt.pathname}${stoppedAt.search}`)
				.set("cookie", cookieFrom(start, LOGIN_COOKIE) ?? "");
			const cookie = cookieFrom(callback, SESSION_COOKIE);
			if (!cookie) throw new Error(`callback: ${callback.status}`);
			return { cookie, callback, browser };
		},
		async close() {
			await Promise.all([close(appServer), close(idpServer)]);
		},
	};
}
