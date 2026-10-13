import type { Logger } from "../logger.js";
import type { IdpTenantClient, TenantAnswer } from "./idp-tenant-client.js";
import { TenantAnswerCache } from "./tenant-answer-cache.js";
import type { LocalmanTenant } from "./tenant-context.js";
import type { TenantDirectory } from "./tenant-directory.js";

/**
 * The domain a Localman host belongs to: `localman.<d>` (dashboard) or
 * `<label>.localman.<d>` (mocks). Hosts with a port are never a tenant's.
 */
export function localmanDomainOf(host: string): string | undefined {
	if (host.includes(":")) return undefined;
	const labels = host.split(".");
	const at = labels[0] === "localman" ? 1 : labels[1] === "localman" ? 2 : -1;
	if (at < 0) return undefined;
	const domain = labels.slice(at);
	return domain.length >= 2 && domain.every(Boolean)
		? domain.join(".")
		: undefined;
}

/**
 * Tenants of a multi-domain Localman: the primary tenant from the
 * environment for its own hosts (never asks the IdP, so hoandat.com runs
 * while the IdP is down), every other `localman.<d>` host from the IdP's
 * internal API through `TenantAnswerCache`.
 */
export function createIdpTenantDirectory(options: {
	readonly primary: LocalmanTenant;
	readonly client: IdpTenantClient;
	readonly logger: Logger;
	readonly now?: () => number;
}): TenantDirectory {
	const { primary, client } = options;
	const cache = new TenantAnswerCache(options.logger, options.now);
	const dashboardHost = new URL(primary.publicUrl).host;
	const mockBase = primary.mockBaseDomain;

	const isPrimaryHost = (host: string): boolean =>
		host === dashboardHost ||
		host === mockBase ||
		host.endsWith(`.${mockBase}`);
	const underPrimary = (domain: string): boolean =>
		domain === primary.domain || domain.endsWith(`.${primary.domain}`);
	// The IdP's own id for the primary tenant means our static one.
	const settle = (answer: TenantAnswer): TenantAnswer => {
		if (answer?.id === primary.id) return primary;
		if (answer) cache.set(`id:${answer.id}`, answer);
		return answer;
	};

	return {
		async byHost(rawHost) {
			const host = rawHost.toLowerCase();
			if (isPrimaryHost(host)) return primary;
			const domain = localmanDomainOf(host);
			if (!domain || underPrimary(domain)) return undefined;
			const answer = await cache.get(`domain:${domain}`, () =>
				client.byHost(`localman.${domain}`),
			);
			return settle(answer);
		},
		async byId(id) {
			if (id === primary.id) return primary;
			return settle(await cache.get(`id:${id}`, () => client.byId(id)));
		},
	};
}
