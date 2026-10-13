import { createHmac } from "node:crypto";
import { type JWTVerifyGetKey, createRemoteJWKSet } from "jose";
import type * as oidc from "openid-client";
import { z } from "zod";
import { internalAuthorization } from "./idp-tenant-api.js";
import { loopbackFetch } from "./loopback-fetch.js";

/**
 * A static client's secret in a tenant: base64url HMAC-SHA256 of the
 * tenant id under the app's client key, as the IdP derives it.
 */
export function tenantClientSecret(
	clientKey: string,
	tenantId: string,
): string {
	return createHmac("sha256", clientKey)
		.update(tenantId, "utf8")
		.digest("base64url");
}

/**
 * Reaching an IdP without its public DNS (another tenant's domain): its
 * discovery document and keys from the IdP's internal API, its endpoints
 * through `fetch`.
 */
export interface IdpTransport {
	metadata(): Promise<oidc.ServerMetadata>;
	readonly jwks: JWTVerifyGetKey;
	readonly fetch: oidc.CustomFetch;
}

/** The IdP's internal API and loopback listener, as one app reaches them. */
export interface TenantIdpAccess {
	readonly internalUrl: string;
	/** The app's role on the internal API (`localman`, `tunelo`). */
	readonly role: string;
	readonly internalSecret: string;
	/** The IdP's public listener on loopback. */
	readonly loopbackUrl: string;
}

/**
 * The tenant's discovery document and keys from the IdP's internal API,
 * its endpoints through the IdP's loopback listener: nothing depends on
 * the DNS of the tenant's domain.
 */
export function tenantIdpTransport(
	access: TenantIdpAccess,
	tenant: { readonly id: string; readonly issuer: string },
): IdpTransport {
	const authorization = internalAuthorization(
		access.role,
		access.internalSecret,
	);
	const internal = (path: string): URL =>
		new URL(
			`/internal/tenants/${encodeURIComponent(tenant.id)}${path}`,
			access.internalUrl,
		);
	const discovery = z.custom<oidc.ServerMetadata>(
		(value) =>
			typeof value === "object" &&
			value !== null &&
			Reflect.get(value, "issuer") === tenant.issuer,
		"discovery of another issuer",
	);
	return {
		async metadata() {
			const response = await fetch(internal("/openid-configuration"), {
				headers: { authorization },
				redirect: "error",
				signal: AbortSignal.timeout(10_000),
			});
			if (!response.ok) {
				throw new Error(`IdP discovery answered ${response.status}`);
			}
			return discovery.parse(await response.json());
		},
		jwks: createRemoteJWKSet(internal("/jwks"), { headers: { authorization } }),
		fetch: loopbackFetch(access.loopbackUrl, new URL(tenant.issuer).origin),
	};
}
