import {
	type TenantIdpAccess,
	tenantClientSecret,
	tenantIdpTransport,
} from "@localman/tenancy";
import type { RequestHandler, Router } from "express";
import type pino from "pino";
import { PRIMARY_TENANT_ID } from "../tenancy/primary-tenant.js";
import { currentTenant } from "../tenancy/tunnel-tenant.js";
import type { WebConfig } from "./web-config.js";
import { createWebConsole } from "./web-console.js";

/** Consoles kept at most; one per tenant seen. */
const MAX_CONSOLES = 1_000;

/** What a tenant's console needs besides the primary console's settings. */
export interface TenantWebSettings {
	readonly access: TenantIdpAccess;
	/** `TUNELO_CLIENT_KEY`: the IdP's key of `tunelo-web`. */
	readonly clientKey: string;
}

/**
 * The web console of the request's tenant: the primary one as configured,
 * another tenant's at `https://tunnel.<domain>` signing in with
 * `tunelo-web` of `https://auth.<domain>` (secret derived from Tunelo's
 * client key, IdP reached without the domain's DNS). Sessions, client id
 * and session key are shared; cookies are host-only, sessions per tenant.
 * Without tenant settings, other tenants have no console.
 */
export function tenantWebConsoles(options: {
	readonly primary: { readonly router: Router; readonly config: WebConfig };
	readonly tenants: TenantWebSettings | undefined;
	readonly logger: pino.Logger;
}): RequestHandler {
	const consoles = new Map<string, Router>();
	const consoleOf = (): Router | undefined => {
		const tenant = currentTenant();
		if (tenant.id === PRIMARY_TENANT_ID) return options.primary.router;
		const { tenants } = options;
		if (!tenants) return undefined;
		const known = consoles.get(tenant.id);
		if (known) return known;
		const router = createWebConsole({
			config: {
				...options.primary.config,
				issuer: tenant.issuer,
				publicUrl: `https://${tenant.tunnelDomain}`,
				clientSecret: tenantClientSecret(tenants.clientKey, tenant.id),
			},
			logger: options.logger,
			tunnelDomain: tenant.tunnelDomain,
			transport: tenantIdpTransport(tenants.access, tenant),
		});
		for (const oldest of consoles.keys()) {
			if (consoles.size < MAX_CONSOLES) break;
			consoles.delete(oldest);
		}
		consoles.set(tenant.id, router);
		return router;
	};
	return (req, res, next) => {
		const router = consoleOf();
		if (router) router(req, res, next);
		else next();
	};
}
