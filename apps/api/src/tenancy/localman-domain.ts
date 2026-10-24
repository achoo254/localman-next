import { appDomainOf } from "@localman/tenancy";

/**
 * The domain a Localman host belongs to: `localman.<d>` (dashboard) or
 * `<label>.localman.<d>` (mocks), of this deployment or any other one.
 * Hosts with a port are never matched.
 */
export function localmanDomainOf(host: string): string | undefined {
	return appDomainOf(host, "localman");
}
