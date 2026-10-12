import { randomBytes } from "node:crypto";
import type http from "node:http";
import { type JWK, SignJWT, exportJWK, generateKeyPair, importJWK } from "jose";

/** TEST ONLY. Helpers of the fake OpenID provider (fake-oidc-issuer.ts). */

/** The one account a sign-in completes as; tests change it in place. */
export interface FakeAccount {
	sub: string;
	sid: string;
	/** Profile claims released at userinfo (none go into the ID token). */
	userinfo: Record<string, unknown>;
}

export interface FakeIssuer {
	readonly issuer: string;
	readonly clientId: string;
	readonly clientSecret: string;
	readonly account: FakeAccount;
	/** Successful refresh_token grants so far. */
	refreshCount: number;
	/** Refresh tokens revoked through the revocation endpoint. */
	readonly revoked: string[];
	/** Delay of each refresh response, to make concurrent requests overlap. */
	refreshDelayMs: number;
	/** Token endpoint calls so far, whatever the outcome. */
	tokenRequests: number;
	/** When set, the token endpoint answers this status (e.g. 503). */
	tokenFailureStatus: number | null;
	/** Userinfo calls so far. */
	userinfoCount: number;
	/** Makes userinfo answer 500, as an IdP in trouble would. */
	userinfoFails: boolean;
	/** Plays the browser at the IdP: returns the redirect back to the app. */
	authorize(authorizationUrl: string): Promise<URL>;
	/** Revokes every grant (as "revoke" at /account does). */
	revokeAllGrants(): void;
	/** A logout token; `claims` override or (with `undefined`) drop claims. */
	logoutToken(claims?: Record<string, unknown>): Promise<string>;
	close(): Promise<void>;
}

export interface Grant {
	sub: string;
	sid: string;
}

export interface CodeGrant extends Grant {
	nonce: string;
	challenge: string;
}

export const random = (): string => randomBytes(24).toString("base64url");

export function readForm(req: http.IncomingMessage): Promise<URLSearchParams> {
	return new Promise((resolve, reject) => {
		let raw = "";
		req.on("data", (chunk: Buffer) => {
			raw += chunk.toString("utf8");
		});
		req.on("end", () => resolve(new URLSearchParams(raw)));
		req.on("error", reject);
	});
}

export function json(
	res: http.ServerResponse,
	status: number,
	body: unknown,
): void {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}

/** client_secret_basic: both parts are form-urlencoded (RFC 6749 2.3.1). */
export function hasClientCredentials(
	req: http.IncomingMessage,
	clientId: string,
	clientSecret: string,
): boolean {
	const header = req.headers.authorization ?? "";
	if (!header.startsWith("Basic ")) return false;
	const [id = "", secret = ""] = Buffer.from(header.slice(6), "base64")
		.toString("utf8")
		.split(":")
		.map((part) => decodeURIComponent(part.replace(/\+/g, " ")));
	return id === clientId && secret === clientSecret;
}

/** Plays the browser at the IdP: the 303 back to the app, as a URL. */
export async function followRedirect(url: string): Promise<URL> {
	const res = await fetch(url, { redirect: "manual" });
	const location = res.headers.get("location");
	if (res.status !== 303 || !location) {
		throw new Error(`authorize: ${res.status} ${await res.text()}`);
	}
	return new URL(location);
}

export function discoveryDocument(issuer: string): Record<string, unknown> {
	return {
		issuer,
		authorization_endpoint: `${issuer}/auth`,
		token_endpoint: `${issuer}/token`,
		jwks_uri: `${issuer}/jwks`,
		userinfo_endpoint: `${issuer}/me`,
		revocation_endpoint: `${issuer}/token/revocation`,
		end_session_endpoint: `${issuer}/session/end`,
		response_types_supported: ["code"],
		subject_types_supported: ["public"],
		id_token_signing_alg_values_supported: ["ES256"],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["client_secret_basic"],
	};
}

export interface IdTokenInput {
	sub: string;
	sid: string;
	nonce?: string;
}

/** One ES256 key that signs the fake IdP's ID tokens and logout tokens. */
export interface FakeSigner {
	readonly publicJwk: JWK;
	idToken(input: IdTokenInput): Promise<string>;
	/** Signs `payload` as is; claims set to `undefined` are left out. */
	logoutToken(payload: Record<string, unknown>): Promise<string>;
}

export async function createFakeSigner(
	issuer: string,
	clientId: string,
): Promise<FakeSigner> {
	const { privateKey, publicKey } = await generateKeyPair("ES256", {
		extractable: true,
	});
	const key = await importJWK(
		{ ...(await exportJWK(privateKey)), alg: "ES256" },
		"ES256",
	);
	return {
		publicJwk: {
			...(await exportJWK(publicKey)),
			kid: "fake-key",
			alg: "ES256",
			use: "sig",
		},
		idToken(input) {
			return new SignJWT({
				sid: input.sid,
				...(input.nonce ? { nonce: input.nonce } : {}),
			})
				.setProtectedHeader({ alg: "ES256", kid: "fake-key" })
				.setIssuer(issuer)
				.setAudience(clientId)
				.setSubject(input.sub)
				.setIssuedAt()
				.setExpirationTime("15m")
				.sign(key);
		},
		logoutToken(payload) {
			const present = Object.fromEntries(
				Object.entries(payload).filter(([, value]) => value !== undefined),
			);
			return new SignJWT(present)
				.setProtectedHeader({
					alg: "ES256",
					kid: "fake-key",
					typ: "logout+jwt",
				})
				.sign(key);
		},
	};
}
