import { type LocalmanTenant, currentTenant } from "./tenant-context.js";
import { tenantDirectory } from "./tenant-directory.js";

/**
 * The tenant whose IdP is `issuer` (`https://auth.<domain>`): the one
 * serving `localman.<domain>`. Only a hint for picking keys: the token
 * is then verified against that tenant's own issuer and keys.
 */
export async function tenantOfIssuer(
	issuer: string,
): Promise<LocalmanTenant | undefined> {
	if (issuer === currentTenant().issuer) return currentTenant();
	let host: string;
	try {
		host = new URL(issuer).host;
	} catch {
		return undefined;
	}
	if (!host.startsWith("auth.")) return undefined;
	return tenantDirectory().byHost(`localman.${host.slice("auth.".length)}`);
}
