import { internalAuthorization } from "@localman/tenancy";
import { createRemoteJWKSet } from "jose";
import { PRIMARY_TENANT_ID } from "../tenancy/primary-tenant.js";
import { currentTenant } from "../tenancy/tunnel-tenant.js";
import {
	type IdpTokenVerifier,
	createIdpTokenVerifier,
} from "./idp-token-verifier.js";

/** The IdP's internal API, as Tunelo reaches it (other tenants' keys). */
export interface InternalApiAccess {
	readonly origin: string;
	readonly secret: string;
}

/** Verifiers kept at most; one per tenant seen. */
const MAX_VERIFIERS = 1_000;

/**
 * Verifies a token against the IdP of the request's tenant: the primary
 * one as configured (`AUTH_ISSUER`, `AUTH_AUDIENCE`, its public JWKS),
 * another `https://auth.<domain>` with audience `https://tunnel.<domain>`
 * and its keys from the IdP's internal API, never its public DNS. A token
 * of one tenant is therefore refused on another tenant's domain.
 */
export function createTenantTokenVerifier(
	primary: IdpTokenVerifier,
	internal: InternalApiAccess | undefined,
): IdpTokenVerifier {
	const verifiers = new Map<string, IdpTokenVerifier>();
	const verifierOf = (): IdpTokenVerifier => {
		const tenant = currentTenant();
		if (tenant.id === PRIMARY_TENANT_ID) return primary;
		const known = verifiers.get(tenant.id);
		if (known) return known;
		if (!internal) {
			throw new Error("Another tenant needs the IdP's internal API settings");
		}
		const jwksUrl = new URL(
			`/internal/tenants/${encodeURIComponent(tenant.id)}/jwks`,
			internal.origin,
		);
		const verifier = createIdpTokenVerifier({
			issuer: tenant.issuer,
			audience: tenant.audience,
			keys: createRemoteJWKSet(jwksUrl, {
				headers: {
					authorization: internalAuthorization("tunelo", internal.secret),
				},
			}),
		});
		for (const oldest of verifiers.keys()) {
			if (verifiers.size < MAX_VERIFIERS) break;
			verifiers.delete(oldest);
		}
		verifiers.set(tenant.id, verifier);
		return verifier;
	};
	return {
		verify: (token, requiredScope) => verifierOf().verify(token, requiredScope),
	};
}
