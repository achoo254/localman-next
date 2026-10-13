import { z } from "zod";
import type { LocalmanTenant } from "./tenant-context.js";

/** How long one call to the IdP's internal API may take. */
const LOOKUP_TIMEOUT_MS = 3_000;

/** What the IdP says about a tenant (`GET /internal/tenants/…`), nothing secret. */
const tenantSummary = z.object({
	id: z.string().min(1),
	domain: z.string().min(1),
	displayName: z.string(),
	issuer: z.url(),
	resources: z.object({ localman: z.url() }),
	ownerSubs: z.array(z.string()),
});

/** `undefined`: the IdP has no serving tenant there (its 404). */
export type TenantAnswer = LocalmanTenant | undefined;

export interface IdpTenantClient {
	byHost(host: string): Promise<TenantAnswer>;
	byId(id: string): Promise<TenantAnswer>;
}

function toTenant(body: unknown): LocalmanTenant {
	const summary = tenantSummary.parse(body);
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

/**
 * The IdP's internal API (loopback, Basic `localman:<secret>`). A 404 is
 * an answer (no such tenant); anything else that is not 200 throws, so
 * the directory keeps what it knew.
 */
export function createIdpTenantClient(
	origin: string,
	secret: string,
	fetchImpl: typeof fetch = fetch,
): IdpTenantClient {
	const authorization = `Basic ${Buffer.from(`localman:${secret}`).toString("base64")}`;
	const get = async (path: string): Promise<TenantAnswer> => {
		const response = await fetchImpl(new URL(path, origin), {
			headers: { authorization },
			redirect: "error",
			signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
		});
		if (response.status === 404) return undefined;
		if (!response.ok) {
			throw new Error(`IdP tenant lookup answered ${response.status}`);
		}
		return toTenant(await response.json());
	};
	return {
		byHost: (host) =>
			get(`/internal/tenants/lookup?host=${encodeURIComponent(host)}`),
		byId: (id) => get(`/internal/tenants/${encodeURIComponent(id)}`),
	};
}
