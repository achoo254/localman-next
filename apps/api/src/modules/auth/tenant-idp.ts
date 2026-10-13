import { createHmac } from "node:crypto";
import { createRemoteJWKSet } from "jose";
import type * as oidc from "openid-client";
import { z } from "zod";
import type { LocalmanTenant } from "../../tenancy/tenant-context.js";
import { loopbackFetch } from "./loopback-fetch.js";
import type { IdpTransport } from "./oidc-api.js";

/** How Localman reaches the IdP for tenants other than the primary one. */
export interface TenantIdpSettings {
	/** The IdP's internal API (`IDP_INTERNAL_URL`). */
	readonly internalUrl: string;
	/** Localman's Basic secret of that API (`IDP_INTERNAL_SECRET`). */
	readonly internalSecret: string;
	/** The IdP's public listener on loopback (`IDP_LOOPBACK_URL`). */
	readonly loopbackUrl: string;
	/** Key of `localman-web` (`LOCALMAN_CLIENT_KEY`). */
	readonly clientKey: string;
}

/**
 * `localman-web`'s secret in a tenant: base64url HMAC-SHA256 of the
 * tenant id under Localman's client key, as the IdP derives it.
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
 * The tenant's discovery document and keys from the IdP's internal API,
 * its endpoints through the IdP's loopback listener: nothing depends on
 * the DNS of the tenant's domain.
 */
export function tenantIdpTransport(
	settings: TenantIdpSettings,
	tenant: LocalmanTenant,
): IdpTransport {
	const authorization = `Basic ${Buffer.from(
		`localman:${settings.internalSecret}`,
	).toString("base64")}`;
	const internal = (path: string): URL =>
		new URL(
			`/internal/tenants/${encodeURIComponent(tenant.id)}${path}`,
			settings.internalUrl,
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
		fetch: loopbackFetch(settings.loopbackUrl, new URL(tenant.issuer).origin),
	};
}
