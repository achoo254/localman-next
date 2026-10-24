import { appDomainOf } from "@localman/tenancy";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { normalizeHostname } from "../api-client/ssrf-guard.js";

const under = (host: string, domain: string): boolean =>
	domain !== "" && (host === domain || host.endsWith(`.${domain}`));

/**
 * A host of Localman itself: the dashboard, mock hosts and Tunelo, of this
 * tenant or any other. A secret filled for an agent never goes there: a
 * mock stores what it receives and Tunelo shows traffic, where an agent
 * could read the value back (ADR-0009). `*.x` patterns are checked on `x`.
 */
export function isLocalmanHost(rawHost: string): boolean {
	const host = normalizeHostname(rawHost.replace(/^\*\./, ""));
	const settings = tenantSettings();
	const own = [
		normalizeHostname(new URL(settings.publicUrl).hostname),
		normalizeHostname(settings.mockBaseDomain.split(":")[0] ?? ""),
		...settings.tunnelDomains.map(normalizeHostname),
	];
	if (own.some((domain) => under(host, domain))) return true;
	return (
		appDomainOf(host, "localman") !== undefined ||
		appDomainOf(host, "tunnel") !== undefined
	);
}
