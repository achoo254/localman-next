import { z } from "zod";

/** How long one call to the IdP's internal API may take. */
const LOOKUP_TIMEOUT_MS = 3_000;

/** What the IdP says about a tenant (`GET /internal/tenants/…`), nothing secret. */
const tenantSummarySchema = z.object({
	id: z.string().min(1),
	domain: z.string().min(1),
	displayName: z.string(),
	issuer: z.url(),
	/** Only `active` tenants are served; a claimed one only has its /admin. */
	status: z.string(),
	resources: z.object({ localman: z.url(), tunnel: z.url() }),
	ownerSubs: z.array(z.string()),
});

export type TenantSummary = z.output<typeof tenantSummarySchema>;

/** One app's view of the IdP's internal API; `undefined` is its 404. */
export interface IdpTenantApi {
	byHost(host: string): Promise<TenantSummary | undefined>;
	byId(id: string): Promise<TenantSummary | undefined>;
}

/** `Authorization` of an app (`localman`, `tunelo`) on the internal API. */
export function internalAuthorization(role: string, secret: string): string {
	return `Basic ${Buffer.from(`${role}:${secret}`).toString("base64")}`;
}

/**
 * The IdP's internal API (loopback, the app's own Basic credentials). A
 * 404 or a tenant that is not `active` is "no tenant"; anything else that
 * is not 200 throws, so a cache keeps what it knew.
 */
export function createIdpTenantApi(options: {
	readonly origin: string;
	readonly role: string;
	readonly secret: string;
	readonly fetch?: typeof fetch;
}): IdpTenantApi {
	const authorization = internalAuthorization(options.role, options.secret);
	const fetchImpl = options.fetch ?? fetch;
	const get = async (path: string): Promise<TenantSummary | undefined> => {
		const response = await fetchImpl(new URL(path, options.origin), {
			headers: { authorization },
			redirect: "error",
			signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
		});
		if (response.status === 404) return undefined;
		if (!response.ok) {
			throw new Error(`IdP tenant lookup answered ${response.status}`);
		}
		const summary = tenantSummarySchema.parse(await response.json());
		return summary.status === "active" ? summary : undefined;
	};
	return {
		byHost: (host) =>
			get(`/internal/tenants/lookup?host=${encodeURIComponent(host)}`),
		byId: (id) => get(`/internal/tenants/${encodeURIComponent(id)}`),
	};
}

/**
 * The domain an app host belongs to: `<label>.<d>` (the app's apex) or
 * `<x>.<label>.<d>` (one label under it), e.g. label `localman` or
 * `tunnel`. Hosts with a port are never a tenant's.
 */
export function appDomainOf(host: string, label: string): string | undefined {
	if (host.includes(":")) return undefined;
	const labels = host.split(".");
	const at = labels[0] === label ? 1 : labels[1] === label ? 2 : -1;
	if (at < 0) return undefined;
	const domain = labels.slice(at);
	return domain.length >= 2 && domain.every(Boolean)
		? domain.join(".")
		: undefined;
}
