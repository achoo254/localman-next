import express from "express";
import { SignJWT, errors, generateKeyPair } from "jose";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createErrorHandler } from "../../http/error-handler.js";
import { createLogger } from "../../logger.js";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";
import { registerBackchannelLogout } from "./backchannel-logout-route.js";
import { BACKCHANNEL_LOGOUT_EVENT } from "./logout-token.js";
import type { OidcApi } from "./oidc-api.js";
import type { SessionStore } from "./session-store.js";

const ISSUER = "https://idp.test";

/** A route whose IdP keys time out, as the JWKS fetch did in production. */
function appWithSlowKeys(destroyBySid: () => Promise<number>) {
	const oidc = {
		clientId: "localman-web",
		issuer: async () => ISSUER,
		jwks: async () => async () => {
			throw new errors.JWKSTimeout();
		},
	} as unknown as OidcApi;
	const sessions = {
		destroyBySid,
		destroyBySub: destroyBySid,
	} as unknown as SessionStore;
	const app = express();
	const router = express.Router();
	const logger = createLogger("silent");
	registerBackchannelLogout(router, { oidc, sessions, logger });
	app.use(router);
	app.use(createErrorHandler(logger));
	return app;
}

async function wellFormedToken(): Promise<string> {
	const { privateKey } = await generateKeyPair("ES256");
	return new SignJWT({ sid: "s1", events: { [BACKCHANNEL_LOGOUT_EVENT]: {} } })
		.setProtectedHeader({ alg: "ES256", typ: "logout+jwt", kid: "k1" })
		.setIssuer(ISSUER)
		.setAudience("localman-web")
		.setIssuedAt()
		.setJti("j1")
		.sign(privateKey);
}

describe("back-channel logout while the IdP keys cannot be fetched", () => {
	it("answers 503 AUTH_UNAVAILABLE (not 500) and ends no session", async () => {
		const destroy = vi.fn(async () => 1);
		const res = await request(appWithSlowKeys(destroy))
			.post(AUTH_PATHS.backchannelLogout)
			.type("form")
			.send({ logout_token: await wellFormedToken() });
		expect(res.status).toBe(503);
		expect(res.body.error.code).toBe("AUTH_UNAVAILABLE");
		expect(destroy).not.toHaveBeenCalled();
	});
});
