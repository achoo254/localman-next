import { type TenantSummary, createIdpTenantApi } from "@localman/tenancy";
import type { LocalmanTenant } from "./tenant-context.js";

/** `undefined`: the IdP has no serving tenant there (its 404). */
export type TenantAnswer = LocalmanTenant | undefined;

export interface IdpTenantClient {
	byHost(host: string): Promise<TenantAnswer>;
	byId(id: string): Promise<TenantAnswer>;
}

function toTenant(summary: TenantSummary): LocalmanTenant {
	const publicUrl = new URL(summary.resources.localman);
	return Object.freeze({
		id: summary.id,
		domain: summary.domain,
		displayName: summary.displayName,
		issuer: summary.issuer,
		publicUrl: publicUrl.origin,
		mockBaseDomain: publicUrl.host,
		ownerSubs: new Set(summary.ownerSubs),
	});
}

/** The IdP's internal API as Localman (Basic `localman:<secret>`). */
export function createIdpTenantClient(
	origin: string,
	secret: string,
	fetchImpl: typeof fetch = fetch,
): IdpTenantClient {
	const api = createIdpTenantApi({
		origin,
		role: "localman",
		secret,
		fetch: fetchImpl,
	});
	const tenantOf = (summary: TenantSummary | undefined): TenantAnswer =>
		summary ? toTenant(summary) : undefined;
	return {
		byHost: async (host) => tenantOf(await api.byHost(host)),
		byId: async (id) => tenantOf(await api.byId(id)),
	};
}
