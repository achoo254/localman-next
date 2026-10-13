import { PRIMARY_TENANT_ID } from "../../tenancy/primary-tenant.js";
import { currentTenant } from "../../tenancy/tenant-context.js";
import type { OidcApi } from "./oidc-api.js";
import { type AuthorizationRequest, OidcClient } from "./oidc-client.js";
import {
	type TenantIdpSettings,
	tenantClientSecret,
	tenantIdpTransport,
} from "./tenant-idp.js";

/** Clients kept at most; one per tenant seen. */
const MAX_CLIENTS = 1_000;

/**
 * The OIDC client of the request's tenant, behind the one client's
 * interface: the primary tenant uses the client from the environment,
 * another tenant `localman-web` at `https://auth.<domain>` with its
 * derived secret, reached through `tenantIdpTransport`. Each client
 * discovers its IdP once (and again after a failure).
 */
export class TenantOidcClients implements OidcApi {
	private readonly clients = new Map<string, OidcClient>();

	constructor(
		private readonly primary: OidcClient,
		private readonly tenantIdp: TenantIdpSettings | undefined,
	) {}

	/** The current tenant's client. */
	current(): OidcClient {
		const tenant = currentTenant();
		if (tenant.id === PRIMARY_TENANT_ID) return this.primary;
		const known = this.clients.get(tenant.id);
		if (known) return known;
		if (!this.tenantIdp) {
			throw new Error("Another tenant needs the IdP's internal API settings");
		}
		const client = new OidcClient({
			issuer: tenant.issuer,
			clientId: this.primary.clientId,
			clientSecret: tenantClientSecret(this.tenantIdp.clientKey, tenant.id),
			publicUrl: tenant.publicUrl,
			transport: tenantIdpTransport(this.tenantIdp, tenant),
		});
		for (const oldest of this.clients.keys()) {
			if (this.clients.size < MAX_CLIENTS) break;
			this.clients.delete(oldest);
		}
		this.clients.set(tenant.id, client);
		return client;
	}

	get redirectUri(): string {
		return this.current().redirectUri;
	}

	get postLogoutRedirectUri(): string {
		return this.current().postLogoutRedirectUri;
	}

	get clientId(): string {
		return this.primary.clientId;
	}

	issuer: OidcApi["issuer"] = () => this.current().issuer();
	jwks: OidcApi["jwks"] = () => this.current().jwks();
	authorizationUrl = (request: AuthorizationRequest): Promise<URL> =>
		this.current().authorizationUrl(request);
	exchangeCode: OidcApi["exchangeCode"] = (url, checks) =>
		this.current().exchangeCode(url, checks);
	refresh: OidcApi["refresh"] = (token) => this.current().refresh(token);
	userInfo: OidcApi["userInfo"] = (token, sub) =>
		this.current().userInfo(token, sub);
	exchangeToken: OidcApi["exchangeToken"] = (token, resource, scope) =>
		this.current().exchangeToken(token, resource, scope);
	endSessionUrl: OidcApi["endSessionUrl"] = (hint) =>
		this.current().endSessionUrl(hint);
}
