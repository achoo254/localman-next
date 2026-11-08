/**
 * Minimal OAuth client for the shared identity provider (RFC 8628 device
 * flow, refresh, revocation). Endpoints always come from discovery.
 * Tokens never reach logs or error messages.
 */
import { TUNNEL_SCOPES } from "./shared/constants.js";

export const IDP_DEFAULTS = {
	issuer: "https://auth.hoandat.com",
	clientId: "tunelo-cli",
	/** Resource indicator (RFC 8707) = the access token's `aud`. */
	resource: "https://tunnel.hoandat.com",
	scope: `openid offline_access ${TUNNEL_SCOPES.OPEN} ${TUNNEL_SCOPES.READ}`,
} as const;

const HTTP_TIMEOUT_MS = 10_000;
export const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

export interface IdpEndpoints {
	deviceAuthorization: string;
	token: string;
	revocation: string | null;
}

export interface TokenSet {
	accessToken: string;
	refreshToken: string | null;
	idToken: string | null;
	/** Seconds. */
	expiresIn: number;
}

/** OAuth error answered by the IdP (`invalid_grant`, `slow_down`…). */
export class OAuthResponseError extends Error {
	constructor(
		public readonly error: string,
		public readonly status: number,
	) {
		super(`Identity provider refused the request (${error})`);
		this.name = "OAuthResponseError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function str(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/** https, or http on loopback for local IdPs. */
function endpoint(value: unknown, name: string): string {
	const raw = str(value);
	if (!raw) throw new Error(`Identity provider discovery lacks ${name}`);
	const url = new URL(raw);
	const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
	if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
		throw new Error(`Identity provider ${name} must use https`);
	}
	return url.href;
}

async function readJson(res: Response): Promise<unknown> {
	const text = await res.text();
	// RFC 7009 revocation answers 200 with an empty body.
	if (text.trim() === "") return {};
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new Error(`Identity provider answered HTTP ${res.status}, not JSON`);
	}
}

const discoveryCache = new Map<string, Promise<IdpEndpoints>>();

export function discover(issuer: string): Promise<IdpEndpoints> {
	const cached = discoveryCache.get(issuer);
	if (cached) return cached;
	const pending = (async (): Promise<IdpEndpoints> => {
		const res = await fetch(`${issuer}/.well-known/openid-configuration`, {
			signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
		});
		if (!res.ok) throw new Error(`Discovery failed: HTTP ${res.status}`);
		const doc = await readJson(res);
		if (!isRecord(doc) || doc.issuer !== issuer) {
			throw new Error("Discovery document does not match the issuer");
		}
		return {
			deviceAuthorization: endpoint(
				doc.device_authorization_endpoint,
				"device_authorization_endpoint",
			),
			token: endpoint(doc.token_endpoint, "token_endpoint"),
			revocation: doc.revocation_endpoint
				? endpoint(doc.revocation_endpoint, "revocation_endpoint")
				: null,
		};
	})();
	// A failed lookup must not stick: drop it so the next call retries.
	pending.catch(() => discoveryCache.delete(issuer));
	discoveryCache.set(issuer, pending);
	return pending;
}

/** A form field given more than once (`resource`) is a list. */
export type FormFields = Record<string, string | readonly string[]>;

export async function postForm(
	url: string,
	form: FormFields,
): Promise<{ status: number; body: unknown }> {
	const body = new URLSearchParams();
	for (const [name, value] of Object.entries(form)) {
		for (const item of typeof value === "string" ? [value] : value) {
			body.append(name, item);
		}
	}
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
			accept: "application/json",
		},
		body: body.toString(),
		signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
	});
	return { status: res.status, body: await readJson(res) };
}

/** Turns a token-endpoint reply into tokens, or throws its OAuth error. */
export function tokenSetOf(reply: { status: number; body: unknown }): TokenSet {
	const { status, body } = reply;
	if (!isRecord(body))
		throw new Error(`Token endpoint answered HTTP ${status}`);
	if (status >= 400 || body.error) {
		throw new OAuthResponseError(str(body.error) ?? "server_error", status);
	}
	const accessToken = str(body.access_token);
	if (!accessToken) throw new Error("Token response has no access_token");
	return {
		accessToken,
		refreshToken: str(body.refresh_token),
		idToken: str(body.id_token),
		expiresIn: typeof body.expires_in === "number" ? body.expires_in : 300,
	};
}

/**
 * Exchanges a refresh token for an access token of `resource`, which must
 * be one the grant holds. The IdP rotates the refresh token: use the new
 * one. `clientId` is the client the grant was made for (`tunelo-cli` by
 * default).
 */
export async function refreshTokens(
	endpoints: IdpEndpoints,
	refreshToken: string,
	resource: string,
	clientId: string = IDP_DEFAULTS.clientId,
): Promise<TokenSet> {
	return tokenSetOf(
		await postForm(endpoints.token, {
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: clientId,
			resource,
		}),
	);
}

/** Revokes a refresh token (and with it the grant of this machine). */
export async function revokeToken(
	endpoints: IdpEndpoints,
	refreshToken: string,
	clientId: string = IDP_DEFAULTS.clientId,
): Promise<void> {
	if (!endpoints.revocation) return;
	const reply = await postForm(endpoints.revocation, {
		token: refreshToken,
		token_type_hint: "refresh_token",
		client_id: clientId,
	});
	if (reply.status >= 400) {
		const error = isRecord(reply.body) ? str(reply.body.error) : null;
		throw new OAuthResponseError(error ?? "server_error", reply.status);
	}
}

/** `sub` from an ID token. Display only: the IdP is trusted over TLS here. */
export function subjectOf(idToken: string | null): string | null {
	const payload = idToken?.split(".")[1];
	if (!payload) return null;
	try {
		const claims: unknown = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf-8"),
		);
		return isRecord(claims) ? str(claims.sub) : null;
	} catch {
		return null;
	}
}
