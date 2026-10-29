import { createHash } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { BACKCHANNEL_LOGOUT_EVENT } from "../logout-token.js";
import {
	type CodeGrant,
	type FakeIssuer,
	type Grant,
	createFakeSigner,
	discoveryDocument,
	followRedirect,
	hasClientCredentials,
	json,
	random,
	readForm,
} from "./fake-oidc-support.js";

/**
 * TEST ONLY. A minimal OpenID provider shaped like auth.hoandat.com for the
 * confidential client `tunelo-web`: discovery, JWKS, an authorization
 * endpoint that signs the one account in at once, the token endpoint (code
 * with PKCE S256, rotating single-use refresh tokens), revocation and an
 * end-session endpoint and userinfo (`/me`, opaque access tokens, profile
 * claims only there). ID tokens and logout tokens are ES256.
 */
export async function startFakeIssuer(publicUrl: string): Promise<FakeIssuer> {
	const server = http.createServer();
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	const clientId = "tunelo-web";
	const clientSecret = random();
	const redirectUri = `${publicUrl}/auth/callback`;
	const signer = await createFakeSigner(issuer, clientId);
	const codes = new Map<string, CodeGrant>();
	const refreshTokens = new Map<string, Grant>();
	/** Opaque access token -> subject, for userinfo. */
	const accessTokens = new Map<string, string>();

	const fake: FakeIssuer = {
		issuer,
		clientId,
		clientSecret,
		account: { sub: "acc_alice", sid: "sid-alice-1", userinfo: {} },
		refreshCount: 0,
		revoked: [],
		refreshDelayMs: 0,
		tokenRequests: 0,
		tokenFailureStatus: null,
		userinfoCount: 0,
		userinfoFails: false,
		authorize: followRedirect,
		revokeAllGrants: () => refreshTokens.clear(),
		logoutToken: (claims = {}) =>
			signer.logoutToken({
				iss: issuer,
				aud: clientId,
				iat: Math.floor(Date.now() / 1000),
				jti: random(),
				sub: fake.account.sub,
				sid: fake.account.sid,
				events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
				...claims,
			}),
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	};

	async function issueTokens(grant: Grant, nonce?: string) {
		const refreshToken = random();
		refreshTokens.set(refreshToken, { sub: grant.sub, sid: grant.sid });
		const accessToken = random();
		accessTokens.set(accessToken, grant.sub);
		return {
			access_token: accessToken,
			token_type: "Bearer",
			expires_in: 900,
			refresh_token: refreshToken,
			id_token: await signer.idToken({ ...grant, nonce }),
			scope: "openid profile email",
		};
	}

	async function token(req: http.IncomingMessage, res: http.ServerResponse) {
		fake.tokenRequests += 1;
		if (fake.tokenFailureStatus !== null) {
			return json(res, fake.tokenFailureStatus, {
				error: "temporarily_unavailable",
			});
		}
		if (!hasClientCredentials(req, clientId, clientSecret)) {
			return json(res, 401, { error: "invalid_client" });
		}
		const body = await readForm(req);
		if (body.get("grant_type") === "authorization_code") {
			const code = body.get("code") ?? "";
			const grant = codes.get(code);
			codes.delete(code);
			const challenge = createHash("sha256")
				.update(body.get("code_verifier") ?? "")
				.digest("base64url");
			if (
				!grant ||
				grant.challenge !== challenge ||
				body.get("redirect_uri") !== redirectUri
			) {
				return json(res, 400, { error: "invalid_grant" });
			}
			return json(res, 200, await issueTokens(grant, grant.nonce));
		}
		if (body.get("grant_type") === "refresh_token") {
			const presented = body.get("refresh_token") ?? "";
			const grant = refreshTokens.get(presented);
			await new Promise((resolve) => setTimeout(resolve, fake.refreshDelayMs));
			// Single use: a replayed or revoked token is refused.
			if (!grant) return json(res, 400, { error: "invalid_grant" });
			refreshTokens.delete(presented);
			fake.refreshCount += 1;
			return json(res, 200, await issueTokens(grant));
		}
		return json(res, 400, { error: "unsupported_grant_type" });
	}

	function authorization(params: URLSearchParams, res: http.ServerResponse) {
		if (
			params.get("client_id") !== clientId ||
			params.get("redirect_uri") !== redirectUri ||
			params.get("code_challenge_method") !== "S256"
		) {
			return json(res, 400, { error: "invalid_request" });
		}
		const code = random();
		codes.set(code, {
			sub: fake.account.sub,
			sid: fake.account.sid,
			nonce: params.get("nonce") ?? "",
			challenge: params.get("code_challenge") ?? "",
		});
		const back = new URL(redirectUri);
		back.searchParams.set("code", code);
		back.searchParams.set("state", params.get("state") ?? "");
		res.writeHead(303, { location: back.href });
		res.end();
	}

	async function revocation(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	) {
		if (!hasClientCredentials(req, clientId, clientSecret)) {
			return json(res, 401, { error: "invalid_client" });
		}
		const value = (await readForm(req)).get("token") ?? "";
		fake.revoked.push(value);
		refreshTokens.delete(value);
		res.writeHead(200);
		res.end();
	}

	const discovery = discoveryDocument(issuer);

	server.on(
		"request",
		(req: http.IncomingMessage, res: http.ServerResponse) => {
			const url = new URL(req.url ?? "/", issuer);
			const fail = (error: unknown) => json(res, 500, { error: String(error) });
			switch (`${req.method} ${url.pathname}`) {
				case "GET /.well-known/openid-configuration":
					return json(res, 200, discovery);
				case "GET /jwks":
					return json(res, 200, { keys: [signer.publicJwk] });
				case "GET /auth":
					return authorization(url.searchParams, res);
				case "POST /token":
					token(req, res).catch(fail);
					return;
				case "GET /me": {
					fake.userinfoCount += 1;
					const bearer = req.headers.authorization?.replace(/^Bearer /, "");
					const sub = accessTokens.get(bearer ?? "");
					if (fake.userinfoFails) return json(res, 500, {});
					if (!sub) return json(res, 401, { error: "invalid_token" });
					return json(res, 200, { ...fake.account.userinfo, sub });
				}
				case "POST /token/revocation":
					revocation(req, res).catch(fail);
					return;
				default:
					return json(res, 404, { error: "not_found" });
			}
		},
	);
	return fake;
}
